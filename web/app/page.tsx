"use client";

import { useState } from "react";
import type {
  HorseEntry,
  RaceInfo,
  SimulationResult,
  RankedExoticList,
  OverlayInfo,
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
  const [showResults, setShowResults] = useState(false);
  const [actualFinish, setActualFinish] = useState(["", "", "", ""]);
  const [dataSource, setDataSource] = useState<"search" | "tvg">("search");
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("horsegpt_history") ?? "[]"); }
    catch { return []; }
  });

  // TVG screenshot data — one slot per category
  type CatKey = "summary" | "snapshot" | "speed" | "pace" | "jockey";
  const [tvgData, setTvgData] = useState<Record<CatKey, unknown>>(
    { summary: null, snapshot: null, speed: null, pace: null, jockey: null }
  );
  const [tvgLoading, setTvgLoading] = useState<CatKey | null>(null);
  const [tvgUploaded, setTvgUploaded] = useState<Set<CatKey>>(new Set());

  async function uploadTvgScreenshot(file: File, cat: CatKey) {
    setTvgLoading(cat);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", cat);
      const res = await fetch("/api/parse-pp", { method: "POST", body: fd });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setTvgData((prev) => ({ ...prev, [cat]: json.data }));
      setTvgUploaded((prev) => new Set(prev).add(cat));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setTvgLoading(null);
    }
  }

  function runFromTvg() {
    setError(null);
    setRace(null);
    setResult(null);

    // Merge all TVG categories into horse entries
    const summaryData = tvgData.summary as { race?: Record<string, unknown>; horses?: Record<string, unknown>[] } | null;
    const snapshotData = tvgData.snapshot as Record<string, unknown>[] | null;
    const speedData = tvgData.speed as Record<string, unknown>[] | null;
    const paceData = tvgData.pace as Record<string, unknown>[] | null;
    const jockeyData = tvgData.jockey as Record<string, unknown>[] | null;

    if (!summaryData?.horses?.length) {
      setError("Upload the Summary screenshot first — it provides the horse names and basic race info.");
      return;
    }

    const horses = summaryData.horses.filter((h) => !h.scratched);

    // Build entries by merging all categories
    const entries: HorseEntry[] = horses.map((h) => {
      const name = String(h.name ?? "").toLowerCase();
      const prog = String(h.program_number ?? "");

      // Find matching data from other categories
      const snap = snapshotData?.find((s) => String(s.program_number) === prog || String(s.name ?? "").toLowerCase() === name);
      const spd = speedData?.find((s) => String(s.program_number) === prog || String(s.name ?? "").toLowerCase() === name);
      const pac = paceData?.find((p) => String(p.program_number) === prog || String(p.name ?? "").toLowerCase() === name);
      const jky = jockeyData?.find((j) => String(j.program_number) === prog || String(j.name ?? "").toLowerCase() === name);

      const speedFigs = (spd?.speed_figures as number[]) ?? [];

      return {
        pp: Number(h.program_number ?? 0),
        program: prog,
        name: String(h.name ?? ""),
        jockey: String(jky?.jockey ?? h.jockey ?? ""),
        trainer: String(jky?.trainer ?? h.trainer ?? ""),
        mlOdds: Number(h.morning_line_odds ?? 5.0),
        style: String(pac?.running_style ?? "P"),
        speed: speedFigs[0] ?? 0,
        e1Pace: Number(pac?.early_pace ?? 80),
        latePace: Number(pac?.late_pace ?? 80),
        last3Beyer: speedFigs.length > 0 ? speedFigs.slice(0, 3) : [],
        wins: Number(h.wins ?? 0),
        starts: Number(h.starts ?? 0),
        jockeyWinPct: Number(jky?.jockey_win_pct ?? 0),
        trainerWinPct: Number(jky?.trainer_win_pct ?? 0),
        lastFinishPosition: Number(snap?.last_finish_position ?? 0) || undefined,
        daysSinceLast: Number(snap?.days_since_last ?? 0) || undefined,
        isClassDrop: Boolean(spd?.class_rating && Number(spd.class_rating) < Number(h.morning_line_odds)),
        weight: Number(h.weight ?? 122),
      };
    });

    const raceInfo: RaceInfo = {
      track: String(summaryData.race?.track_code ?? ""),
      trackName: String(summaryData.race?.track_name ?? ""),
      date: String(summaryData.race?.race_date ?? ""),
      raceNumber: Number(summaryData.race?.race_number ?? 0),
      distance: String(summaryData.race?.distance ?? ""),
      surface: String(summaryData.race?.surface ?? ""),
      raceType: String(summaryData.race?.race_type ?? ""),
      purse: Number(summaryData.race?.purse ?? 0),
      condition: String(summaryData.race?.condition ?? ""),
      entries,
    };

    setRace(raceInfo);
    setDataSource("tvg");
    setResult(runSimulation(entries));
  }

  // Keep old chart upload for backward compat
  const [uploadLoading, setUploadLoading] = useState(false);
  async function handleChartUpload(file: File) {
    setUploadLoading(true);
    setError(null);
    setRace(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "summary");
      const res = await fetch("/api/parse-pp", { method: "POST", body: formData });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const data = json.data as { race?: Record<string, unknown>; horses?: Record<string, unknown>[] };
      const raceInfo: RaceInfo = {
        track: String(data.race?.track_code ?? ""),
        trackName: String(data.race?.track_name ?? ""),
        date: String(data.race?.race_date ?? ""),
        raceNumber: Number(data.race?.race_number ?? 0),
        distance: String(data.race?.distance ?? ""),
        surface: String(data.race?.surface ?? ""),
        raceType: String(data.race?.race_type ?? ""),
        purse: Number(data.race?.purse ?? 0),
        condition: String(data.race?.condition ?? ""),
        entries: (data.horses ?? []).filter((h) => !h.scratched).map((h) => ({
          pp: Number(h.program_number ?? 0),
          program: String(h.program_number ?? ""),
          name: String(h.name ?? ""),
          jockey: String(h.jockey ?? ""),
          trainer: String(h.trainer ?? ""),
          mlOdds: Number(h.morning_line_odds ?? 5.0),
          style: "P" as string, speed: 0, e1Pace: 80, latePace: 80,
          weight: Number(h.weight ?? 122),
        })),
      };
      setRace(raceInfo);
      setDataSource("tvg");
      setResult(runSimulation(raceInfo.entries));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadLoading(false);
    }
  }

  async function findTodayRaces() {
    setLoadingTracks(true);
    try {
      const res = await fetch("/api/today");
      const data = await res.json();
      setTodayTracks(data.tracks ?? []);
    } catch { setTodayTracks([]); }
    finally { setLoadingTracks(false); }
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
          e1Pace: 80, latePace: 80,
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
          lastFinishPosition: h.last_finish_position ? Number(h.last_finish_position) : undefined,
          weight: h.weight ? Number(h.weight) : undefined,
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
      setDataSource("search");
      setResult(runSimulation(entries));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally { setLoading(false); }
  }

  function saveResult() {
    if (!race || !result) return;
    const entry: HistoryEntry = {
      id: Date.now().toString(),
      date: race.date, track: race.trackName || race.track,
      raceNumber: race.raceNumber,
      predicted1st: result.predictions[0]?.program ?? "",
      predicted1stName: result.predictions[0]?.name ?? "",
      actualFinish: actualFinish.filter((f) => f.trim() !== ""),
    };
    const updated = [entry, ...history].slice(0, 100);
    setHistory(updated);
    localStorage.setItem("horsegpt_history", JSON.stringify(updated));
    setShowResults(false);
  }

  const stats = computeStats(history);

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-5xl font-black tracking-tight mb-1">
        HorseGPT <span className="text-blue-600">Exotic Engine</span>
      </h1>
      <p className="text-gray-500 text-lg mb-8">
        7-layer probability model &middot; 500K Monte Carlo simulations
      </p>

      {/* Search */}
      <div className="flex gap-3 mb-4">
        <input
          type="text" value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRun()}
          placeholder="Keeneland Race 5 today"
          className="flex-1 px-5 py-4 text-xl rounded-xl border-2 border-gray-300 text-black placeholder-gray-400 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={handleRun} disabled={loading || !query.trim()}
          className="px-8 py-4 rounded-xl bg-blue-600 text-white font-bold text-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {loading ? "Running..." : "Run"}
        </button>
      </div>

      {/* Today's Tracks */}
      <div className="mb-8">
        <button onClick={findTodayRaces} disabled={loadingTracks}
          className="text-base px-5 py-2.5 rounded-lg border-2 border-gray-300 hover:border-blue-500 font-medium transition-colors disabled:opacity-50">
          {loadingTracks ? "Checking Equibase..." : "Find Today's Races"}
        </button>
        {todayTracks && todayTracks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {todayTracks.map((t) => (
              <button key={t.code} onClick={() => setQuery(`${t.name} Race 1 today`)}
                className="px-4 py-2 text-base font-semibold rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors">
                {t.name}
              </button>
            ))}
          </div>
        )}
        {todayTracks && todayTracks.length === 0 && (
          <span className="ml-3 text-base text-gray-500">No entries posted yet</span>
        )}
      </div>

      {/* TVG Screenshots — 5 categories */}
      <div className="mb-8 p-6 rounded-xl border-2 border-gray-200 bg-gray-50">
        <h3 className="text-xl font-black mb-1">TVG Past Performances</h3>
        <p className="text-sm text-gray-500 mb-4">
          Upload screenshots from TVG for each category. Summary is required. Others add more signal to the model.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-4">
          {([
            { key: "summary" as CatKey, label: "Summary", desc: "Horse names, odds, jockeys", required: true },
            { key: "snapshot" as CatKey, label: "Snapshot", desc: "Quick overview, ratings", required: false },
            { key: "speed" as CatKey, label: "Speed & Class", desc: "Speed figures, class levels", required: false },
            { key: "pace" as CatKey, label: "Pace", desc: "Running styles, early speed", required: false },
            { key: "jockey" as CatKey, label: "Jockey/Trainer", desc: "Win %, meet stats", required: false },
          ]).map(({ key, label, desc, required }) => (
            <label key={key}
              className={`flex flex-col items-center p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                tvgUploaded.has(key)
                  ? "bg-green-50 border-green-400"
                  : tvgLoading === key
                    ? "bg-blue-50 border-blue-300"
                    : "bg-white border-gray-200 hover:border-blue-400"
              }`}>
              <div className="text-base font-bold">{label}</div>
              <div className="text-xs text-gray-500 text-center mt-1">{desc}</div>
              {required && !tvgUploaded.has(key) && (
                <div className="text-xs text-red-500 font-semibold mt-1">Required</div>
              )}
              {tvgUploaded.has(key) && (
                <div className="text-xs text-green-700 font-bold mt-1">Uploaded</div>
              )}
              {tvgLoading === key && (
                <div className="text-xs text-blue-600 font-bold mt-1">Parsing...</div>
              )}
              <input type="file" accept="image/*,.pdf" className="hidden"
                disabled={tvgLoading !== null}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadTvgScreenshot(f, key);
                }} />
            </label>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={runFromTvg}
            disabled={!tvgUploaded.has("summary") || loading}
            className="px-8 py-3 rounded-xl bg-green-600 text-white font-bold text-lg hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            Run Model from TVG Data
          </button>
          <span className="text-sm text-gray-500">
            {tvgUploaded.size}/5 categories uploaded
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-8 p-5 rounded-xl bg-red-50 border-2 border-red-300 text-red-800 text-lg">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-16">
          <div className="text-2xl font-bold mb-2">Fetching race data...</div>
          <div className="text-lg text-gray-500">Running 500,000 Monte Carlo simulations</div>
        </div>
      )}

      {race && result && (
        <>
          {/* Race Header */}
          <div className="mb-8 p-6 rounded-xl bg-gray-50 border-2 border-gray-200">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-3xl font-black">
                {race.trackName || race.track} &mdash; Race {race.raceNumber}
              </h2>
              <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                dataSource === "tvg"
                  ? "bg-green-100 text-green-800 border border-green-300"
                  : "bg-yellow-100 text-yellow-800 border border-yellow-300"
              }`}>
                {dataSource === "tvg" ? "TVG Data (Full)" : "Search Data (Partial)"}
              </span>
            </div>
            <p className="text-lg text-gray-600">
              {race.date} &middot; {race.distance} &middot; {race.surface} &middot; {race.raceType} &middot; ${race.purse.toLocaleString()}
            </p>
            <p className="mt-2 text-base">
              <span className="font-bold">Pace:</span>{" "}
              <span className="text-blue-700 font-semibold">{result.paceScenario.scenario}</span>{" "}
              &mdash; {result.paceScenario.description}
            </p>
          </div>

          {/* Simulation info */}
          <div className="mb-6 text-sm text-gray-500">
            Simulation: {result.simInfo.totalSims.toLocaleString()} races simulated in {result.simInfo.batchesRun} batches
            {result.simInfo.converged ? " (converged)" : " (max reached)"}
          </div>

          {/* Win Probabilities — ranked by ABILITY (not odds) */}
          <h3 className="text-2xl font-black mb-1">Win Probabilities</h3>
          <p className="text-sm text-gray-500 mb-4">Ranked by ability model (speed, pace, class, form, connections). Odds used ONLY for overlay detection.</p>
          <div className="space-y-3 mb-10">
            {result.predictions.map((p, i) => {
              // Find this horse's overlay info
              const progIdx = race.entries.findIndex((e) => e.program === p.program);
              const ov = progIdx >= 0 ? result.overlays[progIdx] : null;
              return (
              <div key={p.program}
                className={`flex items-center gap-5 p-5 rounded-xl border-2 ${
                  i === 0 ? "bg-green-50 border-green-400" :
                  i < 3 ? "bg-gray-50 border-gray-200" :
                  "border-gray-100"
                }`}>
                <div className="w-14 h-14 rounded-full bg-black text-white flex items-center justify-center text-2xl font-black shrink-0">
                  {p.program}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xl font-bold truncate">{p.name}</div>
                  <div className="text-base text-gray-500">
                    ML {p.mlOdds.toFixed(1)} &middot;{" "}
                    <span className={
                      p.style === "E" ? "text-red-600 font-semibold" :
                      p.style === "EP" ? "text-orange-600 font-semibold" :
                      p.style === "P" ? "text-yellow-600 font-semibold" :
                      p.style === "S" ? "text-blue-600 font-semibold" :
                      p.style === "C" ? "text-purple-600 font-semibold" :
                      "text-gray-600"
                    }>
                      {({E:"Speed",EP:"Presser",P:"Stalker",S:"Closer",C:"Deep Closer"} as Record<string,string>)[p.style] ?? p.style}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-3xl font-black text-green-700">{p.winPct.toFixed(1)}%</div>
                  <div className="text-sm text-gray-500">
                    P {p.placePct.toFixed(0)}% &middot; S {p.showPct.toFixed(0)}%
                  </div>
                </div>
                {ov && (
                  <div className="shrink-0 text-right">
                    {ov.isOverlay ? (
                      <div>
                        <span className="inline-block px-3 py-1 rounded-lg bg-green-600 text-white text-sm font-bold">
                          VALUE
                        </span>
                        <div className="text-xs text-green-700 mt-1">
                          Model: {(ov.modelProb * 100).toFixed(1)}%<br/>
                          Market: {(ov.marketProb * 100).toFixed(1)}%
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">
                        Model: {(ov.modelProb * 100).toFixed(1)}%<br/>
                        Market: {(ov.marketProb * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>

          {/* Exotic Bets */}
          <ExoticSection title="EXACTA" cost="$2.00" list={result.exactas} entries={race.entries} />
          <ExoticSection title="TRIFECTA" cost="$1.00" list={result.trifectas} entries={race.entries} />
          <ExoticSection title="SUPERFECTA" cost="$0.10" list={result.superfectas} entries={race.entries} />

          {/* Results Tracking */}
          <div className="mt-10 p-6 rounded-xl bg-gray-50 border-2 border-gray-200">
            <button onClick={() => setShowResults(!showResults)}
              className="text-xl font-bold hover:text-blue-600 transition-colors">
              {showResults ? "Hide Results Entry" : "Enter Race Results"}
            </button>
            {showResults && (
              <div className="mt-4">
                <p className="text-gray-500 mb-4">Enter program numbers for the actual finish order.</p>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {["1st", "2nd", "3rd", "4th"].map((label, i) => (
                    <div key={label}>
                      <label className="text-sm text-gray-500 block mb-1 font-semibold">{label}</label>
                      <input type="text" value={actualFinish[i]}
                        onChange={(e) => { const n = [...actualFinish]; n[i] = e.target.value; setActualFinish(n); }}
                        placeholder="#"
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 text-center text-2xl font-bold focus:border-blue-500 focus:outline-none" />
                    </div>
                  ))}
                </div>
                <button onClick={saveResult}
                  className="px-8 py-3 rounded-lg bg-green-600 text-white font-bold text-lg hover:bg-green-700 transition-colors">
                  Save Result
                </button>
              </div>
            )}
          </div>

          {/* Accuracy Stats */}
          {history.length > 0 && (
            <div className="mt-6 p-6 rounded-xl bg-gray-50 border-2 border-gray-200">
              <h3 className="text-xl font-bold mb-3">Model Accuracy</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="p-4 bg-white rounded-lg border text-center">
                  <div className="text-3xl font-black">{stats.total}</div>
                  <div className="text-sm text-gray-500">Races Tracked</div>
                </div>
                <div className="p-4 bg-white rounded-lg border text-center">
                  <div className="text-3xl font-black text-green-700">{stats.topPickWinPct}%</div>
                  <div className="text-sm text-gray-500">Top Pick Won</div>
                </div>
                <div className="p-4 bg-white rounded-lg border text-center">
                  <div className="text-3xl font-black text-blue-700">{stats.withResults}</div>
                  <div className="text-sm text-gray-500">With Results</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function ExoticSection({ title, cost, list, entries }: {
  title: string; cost: string; list: RankedExoticList; entries: HorseEntry[];
}) {
  if (!list.combos.length) return null;
  return (
    <div className="mb-10">
      <div className="flex items-baseline gap-3 mb-2">
        <h3 className="text-2xl font-black">{title}</h3>
        <span className="text-gray-500 text-lg">{cost} per combo</span>
      </div>
      <p className="text-base text-gray-500 mb-4">
        {list.totalAboveCutoff} playable combos &middot; Cost: ${list.costAboveCutoff.toFixed(2)}
      </p>
      <div className="space-y-2">
        {list.combos.slice(0, 15).map((c) => (
          <div key={c.rank}
            className={`flex items-center gap-4 px-5 py-4 rounded-xl border-2 ${
              c.aboveCutoff
                ? c.rank <= 3 ? "bg-green-50 border-green-300" : "bg-white border-gray-200"
                : "bg-gray-50 border-gray-100 opacity-50"
            }`}>
            <div className="w-8 text-center font-bold text-gray-400 text-lg">{c.rank}</div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-x-1 text-lg">
                {c.programs.map((p, i) => (
                  <span key={i} className="whitespace-nowrap">
                    {i > 0 && <span className="text-gray-300 mx-1 font-bold">/</span>}
                    <span className="font-black text-black">#{p}</span>{" "}
                    <span className="text-gray-600">{c.names[i]}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-black text-green-700">
                {(c.probability * 100).toFixed(c.probability < 0.01 ? 2 : 1)}%
              </div>
              <div className="text-sm text-gray-400">
                ~${c.estimatedPayoff.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            {c.aboveCutoff && c.rank <= 5 && (
              <div className="shrink-0">
                <span className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-bold">
                  PLAY
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface HistoryEntry {
  id: string; date: string; track: string; raceNumber: number;
  predicted1st: string; predicted1stName: string; actualFinish: string[];
}

function computeStats(history: HistoryEntry[]) {
  const withResults = history.filter((h) => h.actualFinish.length > 0 && h.actualFinish[0]);
  const topPickWins = withResults.filter((h) => h.predicted1st === h.actualFinish[0]).length;
  return {
    total: history.length,
    withResults: withResults.length,
    topPickWins,
    topPickWinPct: withResults.length > 0 ? Math.round((topPickWins / withResults.length) * 100) : 0,
  };
}
