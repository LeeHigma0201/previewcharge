"use client";

import { useState, useEffect, useMemo } from "react";
import type { RaceInfo, SimulationResult, PredictionRow, TicketSpec } from "./lib/types";
import { runSimulation, keeneRaceToRaceInfo } from "./lib/data";
import { KEE_APRIL_18_2026, type KeeneRace } from "./lib/keeneland-apr18";

// ── Keeneland Saturday April 18, 2026 — Hyper-focused build ──
const SPLASH_MODE = true;

export default function Home() {
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const session = localStorage.getItem("horsegpt_auth");
      if (session === "jason") setAuthed(true);
    }
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (username.toLowerCase() === "jason" && password === "horse") {
      setAuthed(true);
      setLoginError("");
      localStorage.setItem("horsegpt_auth", "jason");
    } else {
      setLoginError("Invalid credentials");
    }
  }

  if (SPLASH_MODE && !authed) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-black text-white">
        <h1 className="text-6xl font-black tracking-tight mb-4">HorseGPT</h1>
        <p className="text-2xl text-gray-300 mb-6 text-center">
          Keeneland &mdash; Saturday April 18, 2026
        </p>
        <div className="text-lg text-gray-500 text-center max-w-md mb-10">
          Three-stage exotic engine: <span className="text-white">pure data</span> → Monte Carlo → EV overlay.
          Odds never touch ability scoring.
        </div>

        <div className="w-full max-w-lg mb-10">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 text-center">
            Today&rsquo;s Card &mdash; 11 Races
          </h2>
          <div className="grid grid-cols-1 gap-1.5">
            {KEE_APRIL_18_2026.map((r) => (
              <div
                key={r.raceNumber}
                className={`flex items-center justify-between px-4 py-2 rounded-lg ${
                  r.raceType.startsWith("G") || r.raceType.includes("G2") || r.raceType.includes("G3")
                    ? "bg-yellow-900/30 border border-yellow-700/40"
                    : "bg-gray-900/60 border border-gray-800/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-sm font-black">
                    {r.raceNumber}
                  </span>
                  <span className="text-xs text-gray-500">{r.postTime}</span>
                  <span className="text-sm">
                    {r.raceType.includes("G") ? (
                      <span className="text-yellow-400 font-bold">{r.raceType}</span>
                    ) : (
                      <span className="text-gray-400">{r.raceType}</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className={r.surface === "Turf" ? "text-green-500" : "text-amber-600"}>
                    {r.surface}
                  </span>
                  <span>{r.distance}</span>
                  <span className="font-semibold text-gray-400">${(r.purse / 1000).toFixed(0)}K</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleLogin} className="w-full max-w-xs">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="flex-1 px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-600 text-sm focus:border-blue-500 focus:outline-none"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-600 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              className="px-5 py-3 rounded-lg bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors"
            >
              Go
            </button>
          </div>
          {loginError && <p className="text-red-500 text-sm mt-2 text-center">{loginError}</p>}
        </form>

        <div className="mt-8 text-sm text-gray-700">
          Brisnet Ultimate PPs &middot; Henery Monte Carlo &middot; Continuous PPS &middot; A/B/C tiering
        </div>
      </main>
    );
  }

  return <KeenelandApp />;
}

type IntelData = {
  weather?: {
    temperature_f?: number;
    conditions?: string;
    wind_mph?: number;
    precipitation_chance_pct?: number;
    impact_summary?: string;
  };
  track_condition?: {
    dirt?: string;
    turf?: string;
    bias_today?: string;
  };
  late_scratches?: string[];
  jockey_changes?: string[];
  sharp_money?: string[];
  key_insight?: string;
};

function KeenelandApp() {
  const [selectedRaceNum, setSelectedRaceNum] = useState<number | null>(null);
  const [simCount, setSimCount] = useState(0); // 0 = auto
  // oddsOverrides: program -> live decimal odds (e.g. "3.5" for 7/2)
  const [oddsOverrides, setOddsOverrides] = useState<Record<string, Record<string, number>>>({});
  const [intel, setIntel] = useState<Record<number, IntelData | null>>({});
  const [intelLoading, setIntelLoading] = useState<number | null>(null);

  const raceData = useMemo(() => {
    if (!selectedRaceNum) return null;
    const r = KEE_APRIL_18_2026.find((x) => x.raceNumber === selectedRaceNum);
    if (!r) return null;
    const raceInfo = keeneRaceToRaceInfo(r);
    // Apply odds overrides if any exist for this race
    const raceKey = String(r.raceNumber);
    const overrides = oddsOverrides[raceKey] ?? {};
    const patchedEntries = raceInfo.entries.map((e) => {
      const o = overrides[e.program];
      return o !== undefined && o > 0 ? { ...e, mlOdds: o } : e;
    });
    return { keene: r, race: { ...raceInfo, entries: patchedEntries } };
  }, [selectedRaceNum, oddsOverrides]);

  const result = useMemo((): SimulationResult | null => {
    if (!raceData) return null;
    return runSimulation(raceData.race.entries, simCount || undefined, raceData.race);
  }, [raceData, simCount]);

  function updateOdds(raceKey: string, program: string, odds: number) {
    setOddsOverrides((prev) => ({
      ...prev,
      [raceKey]: { ...(prev[raceKey] ?? {}), [program]: odds },
    }));
  }

  function resetOdds(raceKey: string) {
    setOddsOverrides((prev) => {
      const next = { ...prev };
      delete next[raceKey];
      return next;
    });
  }

  async function fetchIntel(raceNum: number) {
    const r = KEE_APRIL_18_2026.find((x) => x.raceNumber === raceNum);
    if (!r) return;
    setIntelLoading(raceNum);
    try {
      const res = await fetch("/api/race-intel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raceNumber: raceNum,
          postTime: r.postTime,
          distance: r.distance,
          surface: r.surface,
        }),
      });
      const json = await res.json();
      setIntel((prev) => ({ ...prev, [raceNum]: json.intel ?? null }));
    } catch {
      setIntel((prev) => ({ ...prev, [raceNum]: null }));
    } finally {
      setIntelLoading(null);
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-5xl font-black tracking-tight mb-1">
        HorseGPT <span className="text-blue-600">Keeneland</span>
      </h1>
      <p className="text-gray-500 text-lg mb-8">
        Saturday April 18, 2026 &middot; Data-first Monte Carlo &middot; Odds used only for EV
      </p>

      {/* Race picker */}
      <div className="mb-2 text-sm font-bold text-gray-500 uppercase tracking-wide">
        Select Race
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {KEE_APRIL_18_2026.map((r) => {
          const conf = r.dataConfidence ?? "UNKNOWN";
          const confDot = conf === "HIGH" ? "bg-green-500" :
            conf === "MED" ? "bg-yellow-400" :
            conf === "LOW" ? "bg-red-500" : "bg-gray-400";
          return (
            <button
              key={r.raceNumber}
              onClick={() => setSelectedRaceNum(r.raceNumber)}
              title={`Data confidence: ${conf}`}
              className={`relative px-3 py-3 min-w-14 text-lg font-black rounded-xl border-2 transition-colors ${
                selectedRaceNum === r.raceNumber
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white border-gray-200 hover:border-blue-500 hover:bg-blue-50"
              }`}
            >
              <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${confDot}`} />
              <div>{r.raceNumber}</div>
              <div
                className={`text-[10px] font-normal mt-0.5 ${
                  selectedRaceNum === r.raceNumber
                    ? "text-blue-200"
                    : r.surface === "Turf"
                      ? "text-green-600"
                      : "text-amber-700"
                }`}
              >
                {r.surface[0]}{r.raceType.includes("G") ? " ★" : ""}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mb-6 flex gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />HIGH confidence (3 sources agree)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400" />MED (2 of 3 agree)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />LOW — verify via NotebookLM before betting</span>
      </div>

      {!raceData && (
        <div className="p-10 rounded-xl bg-gray-50 border-2 border-gray-200 text-center text-gray-500 text-lg">
          Pick a race above. Each race card shows its data confidence dot.
        </div>
      )}

      {raceData && result && (
        <ResultsView
          keene={raceData.keene}
          race={raceData.race}
          result={result}
          simCount={simCount}
          setSimCount={setSimCount}
          oddsOverrides={oddsOverrides[String(raceData.keene.raceNumber)] ?? {}}
          onOddsChange={(prog, odds) => updateOdds(String(raceData.keene.raceNumber), prog, odds)}
          onOddsReset={() => resetOdds(String(raceData.keene.raceNumber))}
          intel={intel[raceData.keene.raceNumber] ?? null}
          intelLoading={intelLoading === raceData.keene.raceNumber}
          onFetchIntel={() => fetchIntel(raceData.keene.raceNumber)}
        />
      )}
    </main>
  );
}

function ResultsView({ keene, race, result, simCount, setSimCount, oddsOverrides, onOddsChange, onOddsReset, intel, intelLoading, onFetchIntel }: {
  keene: KeeneRace; race: RaceInfo; result: SimulationResult;
  simCount: number; setSimCount: (n: number) => void;
  oddsOverrides: Record<string, number>;
  onOddsChange: (program: string, odds: number) => void;
  onOddsReset: () => void;
  intel: IntelData | null;
  intelLoading: boolean;
  onFetchIntel: () => void;
}) {
  const { predictions, paceScenario, tickets } = result;
  const [showAllExotics, setShowAllExotics] = useState(false);

  const tierCount = (t: "A" | "B" | "C") => predictions.filter((p) => p.tier === t).length;

  return (
    <>
      {/* Data confidence banner */}
      {keene.dataConfidence && keene.dataConfidence !== "HIGH" && (
        <div className={`mb-4 p-4 rounded-xl border-2 ${
          keene.dataConfidence === "MED"
            ? "bg-yellow-50 border-yellow-300 text-yellow-900"
            : "bg-red-50 border-red-300 text-red-900"
        }`}>
          <div className="font-black text-base mb-1">
            Data Confidence: {keene.dataConfidence}
          </div>
          <div className="text-sm">
            {keene.dataConfidence === "MED"
              ? "Most horses verified across 3 sources. A few stats may need NotebookLM cross-check before betting."
              : "Significant disagreement between Gemini extractions and hand-typed data. VERIFY lineup and stats via NotebookLM before placing bets."}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 p-6 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
        <h2 className="text-3xl font-black">
          Keeneland &mdash; Race {race.raceNumber}
        </h2>
        <p className="text-lg text-gray-700 mt-1">
          {keene.postTime} &middot; {race.distance} &middot;{" "}
          <span className={race.surface === "Turf" ? "text-green-700" : "text-amber-700"}>
            {race.surface}
          </span>{" "}
          &middot; {race.raceType} &middot; ${race.purse.toLocaleString()}
        </p>
        <p className="text-sm text-gray-600 mt-1">{keene.conditions}</p>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-gray-500 text-xs uppercase font-bold">Pace</div>
            <div className="font-black text-xl text-blue-700">{paceScenario.scenario}</div>
            <div className="text-xs text-gray-500 mt-0.5">PPS {paceScenario.pps}/100</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-gray-500 text-xs uppercase font-bold">Speed Bias (Meet)</div>
            <div className="font-black text-xl">{((keene.speedBiasMeet ?? 0) * 100).toFixed(0)}%</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Wire: {((keene.wirePctMeet ?? 0) * 100).toFixed(0)}%
            </div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-gray-500 text-xs uppercase font-bold">Field</div>
            <div className="font-black text-xl">{race.entries.length} horses</div>
            <div className="text-xs text-gray-500 mt-0.5">Scratches filtered</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-gray-500 text-xs uppercase font-bold">Tiering</div>
            <div className="font-black text-xl">
              <span className="text-green-700">A:{tierCount("A")}</span>{" "}
              <span className="text-blue-700">B:{tierCount("B")}</span>{" "}
              <span className="text-purple-700">C:{tierCount("C")}</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-3 italic">{paceScenario.description}</p>
      </div>

      {/* 3-stage disclosure */}
      <div className="mb-6 p-4 rounded-xl bg-green-50 border-2 border-green-200">
        <div className="text-xs font-bold uppercase text-green-800 mb-1">Algorithm Order</div>
        <div className="text-sm text-gray-700">
          <span className="font-bold">Stage 1</span> Pure data &rarr; ability score (speed, pace, class, form, connections, post, track bias). NO odds.{" "}
          <span className="font-bold">Stage 2</span> Henery Monte Carlo &rarr; 100K+ simulated finish orders.{" "}
          <span className="font-bold">Stage 3</span> Odds overlay &rarr; EV edge, A/B/C tier, ticket construction.
        </div>
      </div>

      {/* Race Intel Panel */}
      <div className="mb-6 p-5 rounded-xl bg-amber-50 border-2 border-amber-200">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-lg font-black text-amber-900">Race-Day Intel</h3>
          <button
            onClick={onFetchIntel}
            disabled={intelLoading}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 disabled:opacity-50"
          >
            {intelLoading ? "Fetching..." : intel ? "Refresh Intel" : "Fetch Live Intel"}
          </button>
        </div>
        {intel ? (
          <div className="space-y-3 text-sm">
            {intel.weather && (
              <div>
                <span className="font-bold text-amber-900">Weather: </span>
                {intel.weather.temperature_f ?? "?"}&deg;F, {intel.weather.conditions ?? "?"}
                {intel.weather.wind_mph ? `, ${intel.weather.wind_mph} mph wind` : ""}
                {typeof intel.weather.precipitation_chance_pct === "number" ? `, ${intel.weather.precipitation_chance_pct}% precip` : ""}
                {intel.weather.impact_summary && (
                  <div className="text-xs text-gray-700 italic mt-0.5">{intel.weather.impact_summary}</div>
                )}
              </div>
            )}
            {intel.track_condition && (
              <div>
                <span className="font-bold text-amber-900">Track: </span>
                Dirt {intel.track_condition.dirt ?? "?"} &middot; Turf {intel.track_condition.turf ?? "?"}
                {intel.track_condition.bias_today && (
                  <div className="text-xs text-gray-700 italic mt-0.5">{intel.track_condition.bias_today}</div>
                )}
              </div>
            )}
            {(intel.late_scratches?.length ?? 0) > 0 && (
              <div>
                <span className="font-bold text-red-700">Late Scratches: </span>
                {intel.late_scratches!.join(", ")}
              </div>
            )}
            {(intel.jockey_changes?.length ?? 0) > 0 && (
              <div>
                <span className="font-bold text-amber-900">Jockey Changes: </span>
                {intel.jockey_changes!.join(" / ")}
              </div>
            )}
            {(intel.sharp_money?.length ?? 0) > 0 && (
              <div>
                <span className="font-bold text-amber-900">Sharp Money: </span>
                <ul className="list-disc ml-6 text-gray-700">
                  {intel.sharp_money!.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {intel.key_insight && (
              <div className="p-2 rounded bg-amber-100 border border-amber-300">
                <span className="font-bold">Key Insight: </span>
                {intel.key_insight}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            Click &ldquo;Fetch Live Intel&rdquo; to get Gemini to pull live weather at Keeneland, today&rsquo;s track bias, late scratches, jockey changes, and sharp money observations.
          </p>
        )}
      </div>

      {/* Sim count control */}
      <div className="mb-6 p-4 rounded-xl bg-gray-50 border-2 border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-base">Monte Carlo Simulations</span>
          <span className="font-mono text-lg font-black text-blue-600">
            {simCount === 0 ? "Auto" : simCount.toLocaleString()}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={500000}
          step={10000}
          value={simCount}
          onChange={(e) => setSimCount(Number(e.target.value))}
          className="w-full h-3 rounded-lg appearance-none cursor-pointer accent-blue-600"
          style={{
            background: `linear-gradient(to right, #2563eb ${(simCount / 500000) * 100}%, #e5e7eb ${(simCount / 500000) * 100}%)`,
          }}
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Auto</span>
          <span>100K</span>
          <span>250K</span>
          <span>500K</span>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Sim: {result.simInfo.totalSims.toLocaleString()} races in {result.simInfo.batchesRun} batches
          {result.simInfo.converged ? " (converged)" : " (max reached)"}
        </div>
      </div>

      {/* ====== STAGE 1-2: Data-only ability ranking (STABLE) ====== */}
      <h3 className="text-2xl font-black mb-1">Data-First Ability Ranking</h3>
      <p className="text-sm text-gray-500 mb-4">
        Stable. Does NOT change when odds move. Pure Monte Carlo output from speed, pace, class, form, connections, post, track bias.
      </p>
      <div className="space-y-2 mb-6">
        {predictions.map((p, i) => (
          <AbilityRow key={p.program} p={p} rank={i + 1} />
        ))}
      </div>

      {/* ====== STAGE 3: Live odds → EV / tier / play ====== */}
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h3 className="text-2xl font-black">Live Odds &rarr; Betting Layer</h3>
          <p className="text-sm text-gray-500">
            Update odds here as they move toward post. Tiers and tickets recalculate instantly.
            {Object.keys(oddsOverrides).length > 0 && (
              <span className="ml-2 text-blue-700 font-semibold">
                {Object.keys(oddsOverrides).length} live override{Object.keys(oddsOverrides).length > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        {Object.keys(oddsOverrides).length > 0 && (
          <button
            onClick={onOddsReset}
            className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-300"
          >
            Reset to ML
          </button>
        )}
      </div>
      <div className="space-y-2 mb-10">
        {predictions.map((p, i) => (
          <BettingRow
            key={p.program}
            p={p}
            rank={i + 1}
            isOverride={oddsOverrides[p.program] !== undefined}
            onOddsChange={(odds) => onOddsChange(p.program, odds)}
          />
        ))}
      </div>

      {/* Recommended Tickets */}
      {tickets.length > 0 && (
        <div className="mb-10">
          <h3 className="text-2xl font-black mb-1">Recommended Exotic Tickets</h3>
          <p className="text-sm text-gray-500 mb-4">
            A/B/C staggered construction. Small wagers, upside leverage.
          </p>
          <div className="space-y-3">
            {tickets.map((t, i) => (
              <TicketCard key={i} ticket={t} predictions={predictions} />
            ))}
          </div>
        </div>
      )}

      {/* Raw Exotic Combos (collapsed) */}
      <div className="mb-10">
        <button
          onClick={() => setShowAllExotics(!showAllExotics)}
          className="text-lg font-bold text-blue-600 hover:text-blue-800"
        >
          {showAllExotics ? "Hide" : "Show"} raw exotic combinations ({result.exactas.combos.length} exactas, {result.trifectas.combos.length} trifectas, {result.superfectas.combos.length} superfectas)
        </button>

        {showAllExotics && (
          <div className="mt-4 space-y-8">
            <ExoticSection title="EXACTA" cost="$2.00" list={result.exactas} />
            <ExoticSection title="TRIFECTA" cost="$1.00" list={result.trifectas} />
            <ExoticSection title="SUPERFECTA" cost="$0.10" list={result.superfectas} />
          </div>
        )}
      </div>
    </>
  );
}

const STYLE_LABEL: Record<string, string> = {
  E: "Speed", EP: "Presser", P: "Stalker", S: "Closer", C: "Deep Closer", "?": "Unknown",
};
const STYLE_COLOR: Record<string, string> = {
  E: "text-red-600", EP: "text-orange-600", P: "text-yellow-700",
  S: "text-blue-600", C: "text-purple-600", "?": "text-gray-600",
};

function AbilityRow({ p, rank }: { p: PredictionRow; rank: number }) {
  const isTop3 = rank <= 3;
  const bg = rank === 1 ? "bg-green-50 border-green-300"
    : isTop3 ? "bg-white border-gray-300"
    : "bg-white border-gray-200";
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border-2 ${bg}`}>
      <div className="w-6 text-center font-bold text-gray-400">{rank}</div>
      <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center text-xl font-black shrink-0">
        {p.program}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold truncate">{p.name}</span>
          <span className={`text-sm font-semibold shrink-0 ${STYLE_COLOR[p.style] ?? "text-gray-600"}`}>
            {STYLE_LABEL[p.style] ?? p.style}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-2xl font-black text-green-700">{p.winPct.toFixed(1)}%</div>
        <div className="text-xs text-gray-500">
          P {p.placePct.toFixed(0)}% &middot; S {p.showPct.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

function BettingRow({ p, rank, isOverride, onOddsChange }: {
  p: PredictionRow; rank: number;
  isOverride: boolean;
  onOddsChange: (odds: number) => void;
}) {
  const tierStyle: Record<string, string> = {
    A: "bg-green-500 text-white border-green-600",
    B: "bg-blue-500 text-white border-blue-600",
    C: "bg-purple-500 text-white border-purple-600",
    exclude: "bg-gray-300 text-gray-700 border-gray-400",
  };
  const rowBg =
    p.tier === "A" ? "bg-green-50 border-green-300" :
    p.tier === "B" ? "bg-blue-50 border-blue-200" :
    p.tier === "C" ? "bg-purple-50 border-purple-200" :
    "bg-gray-50 border-gray-100 opacity-70";

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border-2 ${rowBg}`}>
      <div className="w-6 text-center font-bold text-gray-400">{rank}</div>
      <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center text-xl font-black shrink-0">
        {p.program}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-lg font-bold truncate">{p.name}</div>
        <div className="text-xs text-gray-500">{p.tierReason}</div>
      </div>

      {/* Editable odds input */}
      <div className="text-right shrink-0">
        <label className="text-xs text-gray-400 block mb-0.5">
          {isOverride ? <span className="text-blue-700 font-semibold">Live</span> : "ML"} odds
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            step="0.1"
            min="0"
            value={p.mlOdds}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v >= 0) onOddsChange(v);
            }}
            className={`w-16 px-2 py-1 rounded border-2 text-right font-mono font-bold text-sm ${
              isOverride ? "bg-blue-50 border-blue-400" : "bg-white border-gray-300"
            }`}
          />
          <span className="text-xs text-gray-500">/1</span>
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          &rarr; {(p.marketProb * 100).toFixed(0)}%
        </div>
      </div>

      <div className="text-right shrink-0 min-w-20">
        <div className="text-xs text-gray-400">EV edge</div>
        <div className={`text-xl font-black ${p.evEdge >= 1.10 ? "text-green-700" : p.evEdge >= 0.90 ? "text-gray-600" : "text-red-600"}`}>
          {p.evEdge.toFixed(2)}
        </div>
      </div>

      <div className={`px-3 py-2 rounded-lg text-sm font-black border-2 ${tierStyle[p.tier]}`}>
        {p.tier === "exclude" ? "×" : p.tier}
      </div>
    </div>
  );
}

function TicketCard({ ticket, predictions }: { ticket: TicketSpec; predictions: PredictionRow[] }) {
  const nameFor = (prog: string) => predictions.find((p) => p.program === prog)?.name ?? prog;

  const structureBadge: Record<string, { label: string; color: string }> = {
    "straight":    { label: "STRAIGHT",    color: "bg-red-600 text-white" },
    "key":         { label: "KEY",         color: "bg-green-600 text-white" },
    "box":         { label: "BOX",         color: "bg-blue-600 text-white" },
    "wheel":       { label: "WHEEL",       color: "bg-purple-600 text-white" },
    "part-wheel":  { label: "PART WHEEL",  color: "bg-indigo-600 text-white" },
    "key-box":     { label: "KEY-BOX",     color: "bg-teal-600 text-white" },
  };

  const riskBadge: Record<string, { label: string; color: string }> = {
    "conservative": { label: "Conservative", color: "bg-gray-100 text-gray-700 border-gray-300" },
    "balanced":     { label: "Balanced",     color: "bg-blue-100 text-blue-800 border-blue-300" },
    "aggressive":   { label: "Aggressive",   color: "bg-orange-100 text-orange-800 border-orange-300" },
    "variance":     { label: "Variance",     color: "bg-purple-100 text-purple-800 border-purple-300" },
  };

  const poolBadge: Record<string, string> = {
    "exacta":      "Exacta",
    "trifecta":    "Trifecta",
    "superfecta":  "Superfecta",
  };

  const sb = structureBadge[ticket.structure];
  const rb = riskBadge[ticket.risk];
  const evColor = ticket.expectedValue >= 0 ? "text-green-700" : "text-red-700";
  const hitPct = ticket.hitProbability * 100;

  return (
    <div className="p-5 rounded-xl border-2 border-gray-300 bg-white">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className={`px-2 py-0.5 rounded text-xs font-black ${sb.color}`}>{sb.label}</span>
          <span className="text-sm text-gray-500 font-semibold">{poolBadge[ticket.pool]}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${rb.color}`}>
            {rb.label}
          </span>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-gray-500 uppercase font-bold">Cost</div>
          <div className="text-2xl font-black text-green-700">${ticket.totalCost.toFixed(2)}</div>
          <div className="text-xs text-gray-500">{ticket.combinations} combo{ticket.combinations === 1 ? "" : "s"}</div>
        </div>
      </div>

      <div className="text-base font-bold text-gray-900 mb-3">{ticket.label}</div>

      {/* Math box */}
      <div className="grid grid-cols-4 gap-2 mb-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
        <div>
          <div className="text-[10px] text-gray-500 uppercase font-bold">Hit rate</div>
          <div className="text-lg font-black text-blue-700">{hitPct.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 uppercase font-bold">If hits</div>
          <div className="text-lg font-black text-green-700">~${ticket.estimatedPayoff.toFixed(0)}</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 uppercase font-bold">Expected $</div>
          <div className={`text-lg font-black ${evColor}`}>
            {ticket.expectedValue >= 0 ? "+" : ""}${ticket.expectedValue.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 uppercase font-bold">Breakeven</div>
          <div className="text-lg font-black text-gray-700">{(ticket.breakevenOdds * 100).toFixed(1)}%</div>
        </div>
      </div>

      {/* Leg breakdown */}
      {ticket.legs && (
        <div className="space-y-1 mb-3">
          {ticket.legs.map((leg, i) => {
            const slotLabels = ["1st", "2nd", "3rd", "4th"];
            return (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="w-10 text-xs font-bold uppercase text-gray-500 shrink-0 pt-0.5">{slotLabels[i]}</span>
                <div className="flex flex-wrap gap-x-2 flex-1">
                  {leg.map((p) => (
                    <span key={p}>
                      <span className="font-bold">#{p}</span>{" "}
                      <span className="text-gray-600 text-xs">{nameFor(p)}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {ticket.wheelPrograms && !ticket.legs && (
        <div className="space-y-1 mb-3 text-sm">
          {ticket.keyPositions && ticket.keyPositions.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="w-14 text-xs font-bold uppercase text-gray-500 shrink-0 pt-0.5">Key</span>
              <div className="flex flex-wrap gap-x-2 flex-1">
                {ticket.keyPositions[0].programs.map((p) => (
                  <span key={p}>
                    <span className="font-bold">#{p}</span> <span className="text-gray-600 text-xs">{nameFor(p)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-start gap-2">
            <span className="w-14 text-xs font-bold uppercase text-gray-500 shrink-0 pt-0.5">Box</span>
            <div className="flex flex-wrap gap-x-2 flex-1">
              {ticket.wheelPrograms.map((p) => (
                <span key={p}>
                  <span className="font-bold">#{p}</span> <span className="text-gray-600 text-xs">{nameFor(p)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-600 italic mb-3">{ticket.rationale}</p>

      {/* TwinSpires betting instructions — exact click path */}
      <TwinSpiresInstructions ticket={ticket} />
    </div>
  );
}

function TwinSpiresInstructions({ ticket }: { ticket: TicketSpec }) {
  const poolLabel = ticket.pool === "exacta" ? "Exacta" : ticket.pool === "trifecta" ? "Trifecta" : "Superfecta";
  const structureLabel: Record<string, string> = {
    "straight": "Straight (no box, no key)",
    "key": "Key (check KEY box)",
    "box": "Box (check BOX)",
    "wheel": "Wheel",
    "part-wheel": "Part Wheel",
    "key-box": "Key-Box (check KEY + BOX)",
  };
  const amountLabel =
    ticket.pool === "exacta" ? "$2.00" :
    ticket.pool === "trifecta" ? "$1.00" :
    "$0.10";

  const legs = ticket.legs;
  const keyProgs = ticket.keyPositions?.[0]?.programs;
  const wheel = ticket.wheelPrograms;

  return (
    <details className="mt-2 border border-gray-300 rounded-lg">
      <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 rounded-lg">
        ▸ TwinSpires betting steps
      </summary>
      <div className="px-3 py-3 text-xs text-gray-800 space-y-1.5 bg-gray-50 rounded-b-lg border-t border-gray-200">
        <div><span className="font-bold text-gray-500">1.</span> Track &amp; Race: <span className="font-mono font-bold">Keeneland — Race N</span></div>
        <div><span className="font-bold text-gray-500">2.</span> Pool: <span className="font-mono font-bold">{poolLabel}</span></div>
        <div><span className="font-bold text-gray-500">3.</span> Amount: <span className="font-mono font-bold">{amountLabel} per combination</span></div>
        <div><span className="font-bold text-gray-500">4.</span> Structure: <span className="font-mono font-bold">{structureLabel[ticket.structure]}</span></div>

        {ticket.structure === "straight" && legs && (
          <div>
            <span className="font-bold text-gray-500">5.</span> Pick runners in order:
            <ol className="ml-6 mt-0.5 list-decimal">
              {legs.map((leg, i) => (
                <li key={i}>
                  {["Win (1st)", "Place (2nd)", "Show (3rd)", "4th"][i]}: <span className="font-mono font-bold">#{leg.join(", #")}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {ticket.structure === "key" && keyProgs && legs && (
          <div>
            <span className="font-bold text-gray-500">5.</span> KEY: <span className="font-mono font-bold">#{keyProgs.join(", #")}</span> in 1st
            <div className="ml-4 mt-0.5">Then select for 2nd/3rd: <span className="font-mono font-bold">#{legs[1]?.join(", #")}</span></div>
          </div>
        )}

        {ticket.structure === "box" && wheel && (
          <div>
            <span className="font-bold text-gray-500">5.</span> BOX these horses: <span className="font-mono font-bold">#{wheel.join(", #")}</span>
            <div className="ml-4 text-gray-500 mt-0.5">Wins in any order among these {wheel.length} horses</div>
          </div>
        )}

        {ticket.structure === "key-box" && keyProgs && wheel && (
          <div>
            <span className="font-bold text-gray-500">5.</span> KEY: <span className="font-mono font-bold">#{keyProgs.join(", #")}</span> in 1st
            <div className="ml-4 mt-0.5">BOX for 2nd{ticket.pool === "trifecta" || ticket.pool === "superfecta" ? "/3rd" : ""}{ticket.pool === "superfecta" ? "/4th" : ""}: <span className="font-mono font-bold">#{wheel.join(", #")}</span></div>
          </div>
        )}

        {ticket.structure === "part-wheel" && keyProgs && legs && (
          <div>
            <span className="font-bold text-gray-500">5.</span> KEY: <span className="font-mono font-bold">#{keyProgs.join(", #")}</span> in 1st
            <div className="ml-4 mt-0.5">For 2nd: <span className="font-mono font-bold">#{legs[1]?.join(", #")}</span></div>
            {legs[2] && <div className="ml-4">For 3rd: <span className="font-mono font-bold">#{legs[2]?.join(", #")}</span></div>}
            {legs[3] && <div className="ml-4">For 4th: <span className="font-mono font-bold">#{legs[3]?.join(", #")}</span></div>}
          </div>
        )}

        <div className="pt-1.5 mt-1.5 border-t border-gray-300">
          <span className="font-bold text-gray-500">6.</span> Verify: <span className="font-mono font-bold">{ticket.combinations} combos × {amountLabel} = ${ticket.totalCost.toFixed(2)}</span>
        </div>
        <div>
          <span className="font-bold text-gray-500">7.</span> Tap <span className="font-mono font-bold">Bet Now</span> → Confirm
        </div>
      </div>
    </details>
  );
}

function ExoticSection({ title, cost, list }: {
  title: string; cost: string; list: { combos: Array<{ rank: number; programs: string[]; names: string[]; probability: number; estimatedPayoff: number; aboveCutoff: boolean }>; totalAboveCutoff: number; costAboveCutoff: number };
}) {
  if (!list.combos.length) return null;
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-2">
        <h3 className="text-xl font-black">{title}</h3>
        <span className="text-gray-500 text-sm">{cost} per combo</span>
      </div>
      <p className="text-sm text-gray-500 mb-3">
        {list.totalAboveCutoff} playable combos &middot; Cost: ${list.costAboveCutoff.toFixed(2)}
      </p>
      <div className="space-y-1">
        {list.combos.slice(0, 10).map((c) => (
          <div
            key={c.rank}
            className={`flex items-center gap-3 px-4 py-2 rounded-lg border text-sm ${
              c.aboveCutoff ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-60"
            }`}
          >
            <div className="w-6 text-center font-bold text-gray-400">{c.rank}</div>
            <div className="flex-1">
              {c.programs.map((p, i) => (
                <span key={i} className="whitespace-nowrap">
                  {i > 0 && <span className="text-gray-300 mx-1 font-bold">/</span>}
                  <span className="font-black">#{p}</span>{" "}
                  <span className="text-gray-600 text-xs">{c.names[i]}</span>
                </span>
              ))}
            </div>
            <div className="text-right">
              <div className="font-black text-green-700">{(c.probability * 100).toFixed(c.probability < 0.01 ? 2 : 1)}%</div>
              <div className="text-xs text-gray-400">~${c.estimatedPayoff.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
