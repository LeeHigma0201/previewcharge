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
      const sim = runSimulation(entries, 100000);
      setResult(sim);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-1">HorseGPT Exotic Bet Engine</h1>
      <p className="text-zinc-400 mb-6 text-sm">
        6-layer model: ML odds + pace scenario + Beyer trend + connections +
        class/form + Henery Monte Carlo (100K sims)
      </p>

      <div className="flex gap-3 mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRun()}
          placeholder="e.g. Churchill Downs Race 5 today, Belmont R8 June 14"
          className="flex-1 px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleRun}
          disabled={loading || !query.trim()}
          className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
        >
          {loading ? "Researching..." : "Run Model"}
        </button>
      </div>

      {/* Today's Tracks */}
      <div className="mb-6">
        <button
          onClick={findTodayRaces}
          disabled={loadingTracks}
          className="text-sm px-4 py-2 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          {loadingTracks ? "Searching tracks..." : "Find Today's Races"}
        </button>
        {todayTracks && todayTracks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {todayTracks.map((t) => (
              <button
                key={t.code}
                onClick={() => setQuery(`${t.name} Race 1 today`)}
                className="px-3 py-1.5 text-sm rounded bg-zinc-800 border border-zinc-700 hover:bg-blue-900/50 hover:border-blue-600 transition-colors"
              >
                {t.name} ({t.code})
              </button>
            ))}
          </div>
        )}
        {todayTracks && todayTracks.length === 0 && (
          <p className="mt-2 text-sm text-zinc-500">No tracks found with entries today.</p>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-900/50 border border-red-700 text-red-200">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-zinc-400">
          <div className="text-lg mb-2">Gemini is researching the race card...</div>
          <div className="text-sm">Then running 100,000 Monte Carlo simulations with 6 probability layers</div>
        </div>
      )}

      {race && result && (
        <>
          <div className="mb-6 p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
            <h2 className="text-xl font-bold">
              {race.trackName || race.track} — Race {race.raceNumber}
            </h2>
            <p className="text-zinc-400 text-sm">
              {race.date} | {race.distance} | {race.surface} | {race.raceType} | ${race.purse.toLocaleString()} | {race.condition}
            </p>
            <p className="text-zinc-500 text-xs mt-1">
              Pace: {result.paceScenario.scenario} — {result.paceScenario.description}
            </p>
          </div>

          <Section title="Win Probabilities (6-Layer Adjusted)">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-400 border-b border-zinc-700">
                  <th className="text-left py-2">#</th>
                  <th className="text-left py-2">Horse</th>
                  <th className="text-left py-2">ML</th>
                  <th className="text-left py-2">Style</th>
                  <th className="text-right py-2">Win %</th>
                  <th className="text-right py-2">Place %</th>
                  <th className="text-right py-2">Show %</th>
                </tr>
              </thead>
              <tbody>
                {result.predictions.map((p) => (
                  <tr key={p.program} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                    <td className="py-2 font-mono">{p.program}</td>
                    <td className="py-2 font-semibold">{p.name}</td>
                    <td className="py-2 text-zinc-400">{p.mlOdds.toFixed(1)}</td>
                    <td className="py-2"><StyleBadge style={p.style} /></td>
                    <td className="py-2 text-right font-mono font-bold text-green-400">{p.winPct.toFixed(1)}%</td>
                    <td className="py-2 text-right font-mono text-zinc-300">{p.placePct.toFixed(1)}%</td>
                    <td className="py-2 text-right font-mono text-zinc-400">{p.showPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <ExoticTable title="Exacta — $2.00 per combo" list={result.exactas} />
          <ExoticTable title="Trifecta — $1.00 per combo" list={result.trifectas} />
          <ExoticTable title="Superfecta — $0.10 per combo" list={result.superfectas} />
        </>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-bold mb-3 text-zinc-200">{title}</h3>
      {children}
    </div>
  );
}

function StyleBadge({ style }: { style: string }) {
  const colors: Record<string, string> = {
    E: "bg-red-900/50 text-red-300",
    EP: "bg-orange-900/50 text-orange-300",
    P: "bg-yellow-900/50 text-yellow-300",
    S: "bg-blue-900/50 text-blue-300",
    C: "bg-purple-900/50 text-purple-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono ${colors[style] ?? "bg-zinc-700 text-zinc-300"}`}>
      {style}
    </span>
  );
}

function ExoticTable({ title, list }: { title: string; list: RankedExoticList }) {
  if (!list.combos.length) return null;
  return (
    <Section title={title}>
      <p className="text-zinc-500 text-xs mb-3">
        {list.totalAboveCutoff} combos above probability cutoff | Cost: ${list.costAboveCutoff.toFixed(2)}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-400 border-b border-zinc-700">
              <th className="text-left py-2 w-12">#</th>
              <th className="text-left py-2">Finish Order</th>
              <th className="text-right py-2">Probability</th>
              <th className="text-right py-2">Est. Payoff</th>
              <th className="text-right py-2">Cost</th>
              <th className="text-center py-2">Bet</th>
            </tr>
          </thead>
          <tbody>
            {list.combos.map((c) => (
              <tr key={c.rank} className={`border-b border-zinc-800 ${c.aboveCutoff ? "hover:bg-zinc-800/50" : "opacity-40"}`}>
                <td className="py-2 font-mono text-zinc-500">{c.rank}</td>
                <td className="py-2">
                  {c.programs.map((p, i) => (
                    <span key={i}>
                      {i > 0 && <span className="text-zinc-600 mx-1">/</span>}
                      <span className="font-mono text-zinc-300">#{p}</span>{" "}
                      <span className="text-zinc-400">{c.names[i]}</span>
                    </span>
                  ))}
                </td>
                <td className="py-2 text-right font-mono font-bold text-green-400">
                  {(c.probability * 100).toFixed(c.probability < 0.01 ? 3 : 2)}%
                </td>
                <td className="py-2 text-right font-mono text-zinc-300">
                  ${c.estimatedPayoff.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
                <td className="py-2 text-right font-mono text-zinc-500">${c.unitCost.toFixed(2)}</td>
                <td className="py-2 text-center">
                  {c.aboveCutoff && (
                    <span className="px-2 py-0.5 rounded bg-green-900/50 text-green-300 text-xs font-bold">BET</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
