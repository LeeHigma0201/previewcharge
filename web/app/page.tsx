"use client";

import { useState } from "react";
import type {
  HorseEntry,
  RaceInfo,
  SimulationResult,
  RankedExoticList,
} from "./lib/types";
import { runSimulation } from "./lib/data";

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [race, setRace] = useState<RaceInfo | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [todayTracks, setTodayTracks] = useState<{ code: string; name: string }[] | null>(null);
  const [loadingTracks, setLoadingTracks] = useState(false);

  // Results tracking state
  const [showResults, setShowResults] = useState(false);
  const [actualFinish, setActualFinish] = useState<string[]>(["", "", "", ""]);
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("horsegpt_history") ?? "[]");
    } catch { return []; }
  });

  async function findTodayRaces() {
    setLoadingTracks(true);
    try {
      const res = await fetch("/api/today");
      const data = await res.json();
      setTodayTracks(data.tracks ?? []);
    } catch {
      setTodayTracks([]);
    } finally {
      setLoadingTracks(false);
    }
  }

  async function handleRun() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setRace(null);
    setResult(null);
    setShowResults(false);
    setActualFinish(["", "", "", ""]);

    try {
      const res = await fetch("/api/race", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const entries: HorseEntry[] = (data.horses ?? []).map(
        (h: Record<string, unknown>) => ({
          pp: Number(h.post_position ?? 0),
          program: String(h.program_number ?? ""),
          name: String(h.name ?? "Unknown"),
          jockey: String(h.jockey ?? ""),
          trainer: String(h.trainer ?? ""),
          mlOdds: Number(h.morning_line_odds ?? 5.0),
          style: String(h.running_style ?? "P"),
          speed: ((h.last_3_beyer as number[]) ?? [])[0] ?? 80,
          e1Pace: 80,
          latePace: 80,
          wins: Number(h.wins ?? 0),
          starts: Number(h.starts ?? 0),
          last3Beyer: (h.last_3_beyer as number[]) ?? [],
          jockeyWinPct: Number(h.jockey_win_pct ?? 0),
          trainerWinPct: Number(h.trainer_win_pct ?? 0),
          distanceWins: Number(h.distance_wins ?? 0),
          distanceStarts: Number(h.distance_starts ?? 0),
          surfaceWins: Number(h.surface_wins ?? 0),
          surfaceStarts: Number(h.surface_starts ?? 0),
          isClassDrop: Boolean(h.is_class_drop),
          isClassRaise: Boolean(h.is_class_raise),
          daysSinceLast: Number(h.days_since_last ?? 21),
          equipmentChange: Boolean(h.equipment_change),
        }),
      );

      const raceInfo: RaceInfo = {
        track: String(data.track_code ?? ""),
        trackName: String(data.track_name ?? ""),
        date: String(data.race_date ?? ""),
        raceNumber: Number(data.race_number ?? 0),
        distance: String(data.distance ?? ""),
        surface: String(data.surface ?? ""),
        raceType: String(data.race_type ?? ""),
        purse: Number(data.purse ?? 0),
        condition: String(data.condition ?? ""),
        entries,
      };

      setRace(raceInfo);
      const sim = runSimulation(entries);
      setResult(sim);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function saveResult() {
    if (!race || !result) return;
    const entry: HistoryEntry = {
      id: Date.now().toString(),
      date: race.date,
      track: race.trackName || race.track,
      raceNumber: race.raceNumber,
      predictions: result.predictions.slice(0, 4).map((p) => ({
        program: p.program,
        name: p.name,
        winPct: p.winPct,
      })),
      actualFinish: actualFinish.filter((f) => f.trim() !== ""),
      topExacta: result.exactas.combos[0]
        ? { programs: result.exactas.combos[0].programs, prob: result.exactas.combos[0].probability }
        : null,
      topTrifecta: result.trifectas.combos[0]
        ? { programs: result.trifectas.combos[0].programs, prob: result.trifectas.combos[0].probability }
        : null,
      hit: false,
    };

    // Check if our top predictions matched
    if (entry.actualFinish.length >= 2 && entry.topExacta) {
      entry.hit =
        entry.actualFinish[0] === entry.topExacta.programs[0] &&
        entry.actualFinish[1] === entry.topExacta.programs[1];
    }

    const updated = [entry, ...history].slice(0, 100);
    setHistory(updated);
    localStorage.setItem("horsegpt_history", JSON.stringify(updated));
    setShowResults(false);
  }

  // Compute accuracy stats from history
  const stats = computeStats(history);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">
        HorseGPT <span className="text-blue-400">Exotic Engine</span>
      </h1>
      <p className="text-zinc-400 mb-8">
        7-layer probability model with 500K Henery Monte Carlo simulations
      </p>

      {/* Search */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRun()}
          placeholder="Keeneland Race 5 today"
          className="flex-1 px-5 py-4 text-lg rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleRun}
          disabled={loading || !query.trim()}
          className="px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 font-bold text-lg transition-colors"
        >
          {loading ? "Running..." : "Run"}
        </button>
      </div>

      {/* Today's Tracks */}
      <div className="mb-8">
        <button
          onClick={findTodayRaces}
          disabled={loadingTracks}
          className="text-sm px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors disabled:opacity-50"
        >
          {loadingTracks ? "Checking Equibase..." : "Find Today's Races"}
        </button>
        {todayTracks && todayTracks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {todayTracks.map((t) => (
              <button
                key={t.code}
                onClick={() => setQuery(`${t.name} Race 1 today`)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-blue-900/40 hover:border-blue-500 transition-colors"
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
        {todayTracks && todayTracks.length === 0 && (
          <span className="ml-3 text-sm text-zinc-500">No entries posted yet today</span>
        )}
      </div>

      {error && (
        <div className="mb-8 p-5 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-base">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-16 text-zinc-400">
          <div className="text-xl mb-2 font-semibold">Fetching race data from Equibase...</div>
          <div className="text-base">Running 500,000 Monte Carlo simulations</div>
        </div>
      )}

      {race && result && (
        <>
          {/* Race Header */}
          <div className="mb-8 p-6 rounded-xl bg-zinc-900 border border-zinc-800">
            <h2 className="text-2xl font-bold mb-1">
              {race.trackName || race.track} — Race {race.raceNumber}
            </h2>
            <p className="text-zinc-400 text-base">
              {race.date} &middot; {race.distance} &middot; {race.surface} &middot; {race.raceType} &middot; ${race.purse.toLocaleString()}
            </p>
            <div className="mt-3 inline-block px-3 py-1 rounded-lg bg-zinc-800 text-sm">
              <span className="text-zinc-500">Pace:</span>{" "}
              <span className="font-semibold text-zinc-200">{result.paceScenario.scenario}</span>{" "}
              <span className="text-zinc-500">— {result.paceScenario.description}</span>
            </div>
          </div>

          {/* Win Probabilities */}
          <div className="mb-10">
            <h3 className="text-xl font-bold mb-4">Win Probabilities</h3>
            <div className="grid gap-3">
              {result.predictions.map((p, i) => (
                <div
                  key={p.program}
                  className={`flex items-center gap-4 p-4 rounded-xl border ${
                    i === 0
                      ? "bg-green-950/30 border-green-800/50"
                      : i < 3
                        ? "bg-zinc-900 border-zinc-800"
                        : "bg-zinc-950 border-zinc-800/50"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-lg">
                    {p.program}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-lg truncate">{p.name}</div>
                    <div className="text-sm text-zinc-500">
                      ML {p.mlOdds.toFixed(1)} &middot; <StyleBadge style={p.style} /> &middot; {p.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-extrabold text-green-400">{p.winPct.toFixed(1)}%</div>
                    <div className="text-xs text-zinc-500">
                      Place {p.placePct.toFixed(0)}% &middot; Show {p.showPct.toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Exotic Bets */}
          <ExoticSection title="EXACTA" subtitle="$2.00 per combo" list={result.exactas} />
          <ExoticSection title="TRIFECTA" subtitle="$1.00 per combo" list={result.trifectas} />
          <ExoticSection title="SUPERFECTA" subtitle="$0.10 per combo" list={result.superfectas} />

          {/* Enter Results */}
          <div className="mt-10 p-6 rounded-xl bg-zinc-900 border border-zinc-800">
            <button
              onClick={() => setShowResults(!showResults)}
              className="text-lg font-bold hover:text-blue-400 transition-colors"
            >
              {showResults ? "Hide" : "Enter Race Results"} (Track Accuracy)
            </button>
            {showResults && (
              <div className="mt-4">
                <p className="text-zinc-400 text-sm mb-4">
                  After the race, enter the actual finish order (program numbers) to track model accuracy.
                </p>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {["1st", "2nd", "3rd", "4th"].map((label, i) => (
                    <div key={label}>
                      <label className="text-xs text-zinc-500 block mb-1">{label} Place</label>
                      <input
                        type="text"
                        value={actualFinish[i]}
                        onChange={(e) => {
                          const next = [...actualFinish];
                          next[i] = e.target.value;
                          setActualFinish(next);
                        }}
                        placeholder="#"
                        className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-center text-lg font-mono"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={saveResult}
                  className="px-6 py-2 rounded-lg bg-green-700 hover:bg-green-600 font-semibold transition-colors"
                >
                  Save Result
                </button>
              </div>
            )}
          </div>

          {/* Accuracy History */}
          {history.length > 0 && (
            <div className="mt-8 p-6 rounded-xl bg-zinc-900 border border-zinc-800">
              <h3 className="text-lg font-bold mb-3">Model Accuracy Tracker</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <Stat label="Races Tracked" value={stats.total.toString()} />
                <Stat label="Top Pick Won" value={`${stats.topPickWinPct}%`} sub={`${stats.topPickWins}/${stats.withResults}`} />
                <Stat label="Exacta Hit" value={`${stats.exactaHitPct}%`} sub={`${stats.exactaHits}/${stats.withResults}`} />
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800">
                      <th className="text-left py-2">Race</th>
                      <th className="text-left py-2">Predicted 1st</th>
                      <th className="text-left py-2">Actual 1st</th>
                      <th className="text-center py-2">Hit?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 20).map((h) => (
                      <tr key={h.id} className="border-b border-zinc-800/50">
                        <td className="py-2 text-zinc-400">{h.track} R{h.raceNumber}</td>
                        <td className="py-2">#{h.predictions[0]?.program} {h.predictions[0]?.name}</td>
                        <td className="py-2">{h.actualFinish[0] ? `#${h.actualFinish[0]}` : "—"}</td>
                        <td className="py-2 text-center">
                          {h.actualFinish[0] && h.predictions[0]?.program === h.actualFinish[0]
                            ? <span className="text-green-400 font-bold">W</span>
                            : h.actualFinish[0]
                              ? <span className="text-zinc-600">L</span>
                              : "—"
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

// --- Components ---

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-3 rounded-lg bg-zinc-800">
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
      {sub && <div className="text-xs text-zinc-600">{sub}</div>}
    </div>
  );
}

function StyleBadge({ style }: { style: string }) {
  const colors: Record<string, string> = {
    E: "text-red-400",
    EP: "text-orange-400",
    P: "text-yellow-400",
    S: "text-blue-400",
    C: "text-purple-400",
  };
  const labels: Record<string, string> = {
    E: "Speed",
    EP: "Presser",
    P: "Stalker",
    S: "Closer",
    C: "Deep Closer",
  };
  return <span className={`font-medium ${colors[style] ?? "text-zinc-400"}`}>{labels[style] ?? style}</span>;
}

function ExoticSection({ title, subtitle, list }: { title: string; subtitle: string; list: RankedExoticList }) {
  if (!list.combos.length) return null;

  return (
    <div className="mb-10">
      <div className="flex items-baseline gap-3 mb-1">
        <h3 className="text-xl font-extrabold tracking-wide">{title}</h3>
        <span className="text-zinc-500 text-sm">{subtitle}</span>
      </div>
      <p className="text-sm text-zinc-500 mb-4">
        {list.totalAboveCutoff} playable combos &middot; Total cost: ${list.costAboveCutoff.toFixed(2)}
      </p>
      <div className="space-y-2">
        {list.combos.slice(0, 20).map((c) => (
          <div
            key={c.rank}
            className={`flex items-center gap-4 px-4 py-3 rounded-xl border ${
              c.aboveCutoff
                ? c.rank <= 3
                  ? "bg-green-950/20 border-green-900/40"
                  : "bg-zinc-900 border-zinc-800"
                : "bg-zinc-950 border-zinc-800/30 opacity-50"
            }`}
          >
            <div className="w-8 text-center font-mono text-zinc-600 text-sm">{c.rank}</div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-x-2 text-base">
                {c.programs.map((p, i) => (
                  <span key={i} className="whitespace-nowrap">
                    {i > 0 && <span className="text-zinc-700 mr-1">/</span>}
                    <span className="font-bold text-white">#{p}</span>{" "}
                    <span className="text-zinc-400">{c.names[i]}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-bold text-green-400">
                {(c.probability * 100).toFixed(c.probability < 0.01 ? 2 : 1)}%
              </div>
              <div className="text-xs text-zinc-600">
                pays ~${c.estimatedPayoff.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            {c.aboveCutoff && c.rank <= 5 && (
              <div className="shrink-0">
                <span className="px-3 py-1 rounded-lg bg-green-800/40 text-green-300 text-xs font-bold">
                  PLAY
                </span>
              </div>
            )}
          </div>
        ))}
        {list.combos.length > 20 && (
          <p className="text-sm text-zinc-600 text-center pt-2">
            + {list.combos.length - 20} more combos
          </p>
        )}
      </div>
    </div>
  );
}

// --- History/Accuracy Types ---

interface HistoryEntry {
  id: string;
  date: string;
  track: string;
  raceNumber: number;
  predictions: { program: string; name: string; winPct: number }[];
  actualFinish: string[];
  topExacta: { programs: string[]; prob: number } | null;
  topTrifecta: { programs: string[]; prob: number } | null;
  hit: boolean;
}

function computeStats(history: HistoryEntry[]) {
  const withResults = history.filter((h) => h.actualFinish.length > 0 && h.actualFinish[0]);
  const topPickWins = withResults.filter(
    (h) => h.predictions[0]?.program === h.actualFinish[0],
  ).length;
  const exactaHits = withResults.filter((h) => h.hit).length;

  return {
    total: history.length,
    withResults: withResults.length,
    topPickWins,
    topPickWinPct: withResults.length > 0 ? Math.round((topPickWins / withResults.length) * 100) : 0,
    exactaHits,
    exactaHitPct: withResults.length > 0 ? Math.round((exactaHits / withResults.length) * 100) : 0,
  };
}
