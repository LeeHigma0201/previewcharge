"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type {
  HorseEntry,
  RaceInfo,
  SimulationResult,
  RankedExoticList,
  OverlayInfo,
  BetStrategy,
} from "./lib/types";
import { runSimulation } from "./lib/data";
import { KEENELAND_APR18_2026, KEE_APR18_DATE } from "./lib/keeneland-apr18";
import {
  loadResults,
  setRaceFinish,
  clearRaceFinish,
  saveResults,
  type ResultsMap,
} from "./lib/results-store";
import {
  allRacePicks,
  computeMultiRaceRec,
  MULTI_RACE_BETS,
  type MultiRaceRec,
} from "./lib/multi-race";

// ── Keeneland April 18, 2026 — Brisnet track-bias build ──
// Splash is off. Landing page shows the full feature matrix for today's
// card at /today; the exotic simulator still lives below, wired to
// static Brisnet data (no Gemini/Equibase latency on race day).
const SPLASH_MODE = false;

export default function Home() {
  if (SPLASH_MODE) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-black text-white">
        <h1 className="text-6xl font-black tracking-tight mb-4">
          HorseGPT
        </h1>
        <p className="text-2xl text-gray-300 mb-8 text-center">
          Rebuilding for Keeneland
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <nav className="border-b border-gray-900 px-4 md:px-8 py-3 flex items-center justify-between">
        <Link href="/today" className="text-lg font-black tracking-tight">
          HorseGPT <span className="text-gray-500 text-sm font-normal">· Keeneland Spring 2026</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/today" className="text-emerald-400 hover:underline">Today&rsquo;s card</Link>
          <a href="#simulator" className="text-gray-400 hover:text-white">Simulator</a>
        </div>
      </nav>
      <div id="simulator" className="flex-1">
        <KeenelandApp />
      </div>
    </main>
  );
}

function KeenelandApp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [race, setRace] = useState<RaceInfo | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);

  // Hardcoded to Keeneland
  const selectedTrack = { code: "KEE", name: "Keeneland" };

  // Race number selection
  const [selectedRaceNum, setSelectedRaceNum] = useState<number | null>(null);

  // Monte Carlo sim count — 0 = auto (convergence-based)
  const [simCount, setSimCount] = useState(0);

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
        style: String(pac?.running_style ?? "?"),
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
    setResult(runSimulation(entries, simCount || undefined, raceInfo));
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
          style: "?" as string, speed: 0, e1Pace: 80, latePace: 80,
          weight: Number(h.weight ?? 122),
        })),
      };
      setRace(raceInfo);
      setDataSource("tvg");
      setResult(runSimulation(raceInfo.entries, undefined, raceInfo));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadLoading(false);
    }
  }

  // Step 3: Load entries for selected track + race
  const [geminiEntries, setGeminiEntries] = useState<Record<string, unknown>[]>([]);

  async function loadRaceEntries() {
    if (!selectedTrack || !selectedRaceNum) return;
    setLoading(true);
    setError(null);
    setRace(null);
    setResult(null);
    setGeminiEntries([]);
    setTvgData({ summary: null, snapshot: null, speed: null, pace: null, jockey: null });
    setTvgUploaded(new Set());
    setShowResults(false);
    setActualFinish(["", "", "", ""]);
    try {
      // Use static Brisnet data for KEE Apr 18 2026 — no Gemini latency, no bot blocking
      const staticRace = KEENELAND_APR18_2026.find((r) => r.raceNumber === selectedRaceNum);
      if (!staticRace) throw new Error(`Race ${selectedRaceNum} not found in static card`);

      // Shape the static horses like the Gemini response so downstream merge logic works
      const scratchedSet = new Set(staticRace.scratches ?? []);
      const horseRecords: Record<string, unknown>[] = staticRace.horses
        .filter((sh) => !scratchedSet.has(sh.program))
        .map((sh) => ({
        program_number: sh.program,
        post_position: Number(sh.program) || 0,
        name: sh.name,
        morning_line_odds: sh.mlOdds,
        running_style: sh.style,
        last_3_beyer: sh.last3Beyer,
        days_since_last: sh.daysSinceLast,
        weight: sh.weight,
        prime_power: sh.primePower ?? 0,
        current_class: sh.currentClass ?? 0,
        avg_class_last_3: sh.avgClassLast3 ?? 0,
        early_pace_last: sh.earlyPaceLast ?? 0,
        late_pace_last: sh.latePaceLast ?? 0,
        mud_pct: sh.mudPct ?? 0,
        is_class_drop: sh.isClassDrop ?? false,
        jockey: "",
        trainer: "",
      }));
      setGeminiEntries(horseRecords);

      const raceInfo: RaceInfo = {
        track: selectedTrack.code,
        trackName: selectedTrack.name,
        date: KEE_APR18_DATE,
        raceNumber: selectedRaceNum,
        distance: staticRace.distance,
        surface: staticRace.surface,
        raceType: staticRace.raceType,
        purse: staticRace.purse,
        condition: staticRace.condition,
        name: staticRace.name,
        postTime: staticRace.postTime,
        trackBias: staticRace.trackBias,
        entries: [],
      };
      setRace(raceInfo);
      setDataSource("search");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally { setLoading(false); }
  }

  // Auto-load when race number is selected
  useEffect(() => {
    if (selectedTrack && selectedRaceNum) {
      loadRaceEntries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrack, selectedRaceNum]);

  // Live Gemini refresh — hits /api/race (web search) and merges live odds
  // + scratches on top of the static Brisnet baseline. Static speed/class
  // numbers stay intact; only odds, jockey, and scratches get refreshed.
  const [liveRefreshing, setLiveRefreshing] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  async function refreshLiveFromGemini() {
    if (!selectedRaceNum) return;
    setLiveRefreshing(true);
    setLiveStatus(null);
    try {
      const query = `Keeneland Race ${selectedRaceNum} April 18 2026`;
      const res = await fetch("/api/race", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.gemini_disabled) {
        setLiveStatus(`⚠ ${data.message ?? "Gemini not available — using Brisnet baseline"}`);
        return;
      }
      if (data.error) throw new Error(data.error);
      const liveHorses = (data.horses ?? []) as Record<string, unknown>[];
      if (liveHorses.length === 0) throw new Error("No live entries found");

      // Merge: for each static entry, find a matching live entry by program OR name.
      // Overwrite only live-relevant fields (odds, jockey, trainer). Keep static
      // numerical features (last_3_beyer, prime_power, etc.) because they're
      // higher-quality than Gemini's search-guessed equivalents.
      const liveByProg = new Map(liveHorses.map((h) => [String(h.program_number), h]));
      const liveByName = new Map(
        liveHorses.map((h) => [String(h.name ?? "").toLowerCase().trim(), h]),
      );

      const merged = geminiEntries.map((h) => {
        const prog = String(h.program_number ?? "");
        const name = String(h.name ?? "").toLowerCase().trim();
        const live = liveByProg.get(prog) ?? liveByName.get(name);
        if (!live) return h; // no live match — keep static
        return {
          ...h,
          morning_line_odds: live.morning_line_odds ?? h.morning_line_odds,
          jockey: live.jockey ?? h.jockey ?? "",
          trainer: live.trainer ?? h.trainer ?? "",
        };
      });

      // Apply scratches if Gemini reports any
      const scratches = String(data._scratches ?? "").toLowerCase();
      const remaining = scratches
        ? merged.filter((h) => !scratches.includes(String(h.name ?? "").toLowerCase()))
        : merged;

      setGeminiEntries(remaining);
      setLiveStatus(
        `Synced — ${remaining.length} horses, odds/jockey from ${data._dataSource ?? "gemini"}${
          scratches ? ` · scratches applied` : ""
        }`,
      );
    } catch (err: unknown) {
      setLiveStatus(`Live sync failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setLiveRefreshing(false);
    }
  }

  // Step 3: Run the model — merges Gemini base data + TVG screenshot data
  function handleRunModel() {
    if (!race || geminiEntries.length === 0) return;

    const snapshotData = tvgData.snapshot as Record<string, unknown>[] | null;
    const speedData = tvgData.speed as Record<string, unknown>[] | null;
    const paceData = tvgData.pace as Record<string, unknown>[] | null;
    const jockeyData = tvgData.jockey as Record<string, unknown>[] | null;
    // Summary TVG can override gemini names/odds if uploaded
    const summaryData = tvgData.summary as { horses?: Record<string, unknown>[] } | null;

    const entries: HorseEntry[] = geminiEntries.map((h) => {
      const prog = String(h.program_number ?? "");
      const name = String(h.name ?? "").toLowerCase();

      // Match TVG data by program number first, then name
      const findMatch = (arr: Record<string, unknown>[] | null) =>
        arr?.find((x) => String(x.program_number) === prog || String(x.name ?? "").toLowerCase() === name);

      const summ = findMatch(summaryData?.horses ?? null);
      const snap = findMatch(snapshotData);
      const spd = findMatch(speedData);
      const pac = findMatch(paceData);
      const jky = findMatch(jockeyData);

      // TVG speed figures override Gemini
      const speedFigs = (spd?.speed_figures as number[]) ?? (h.last_3_beyer as number[]) ?? [];

      return {
        pp: Number(h.post_position ?? h.program_number ?? 0),
        program: prog,
        name: String(summ?.name ?? h.name ?? ""),
        jockey: String(jky?.jockey ?? h.jockey ?? ""),
        trainer: String(jky?.trainer ?? h.trainer ?? ""),
        mlOdds: Number(summ?.morning_line_odds ?? h.morning_line_odds ?? 5.0),
        style: String(pac?.running_style ?? h.running_style ?? "?"),
        speed: speedFigs[0] ?? 0,
        e1Pace: Number(pac?.early_pace ?? 80),
        latePace: Number(pac?.late_pace ?? 80),
        last3Beyer: speedFigs.slice(0, 3),
        wins: Number(summ?.wins ?? h.wins ?? 0),
        starts: Number(summ?.starts ?? h.starts ?? 0),
        jockeyWinPct: Number(jky?.jockey_win_pct ?? h.jockey_win_pct ?? 0),
        trainerWinPct: Number(jky?.trainer_win_pct ?? h.trainer_win_pct ?? 0),
        lastFinishPosition: Number(snap?.last_finish_position ?? h.last_finish_position ?? 0) || undefined,
        daysSinceLast: Number(snap?.days_since_last ?? h.days_since_last ?? 0) || undefined,
        isClassDrop: Boolean(spd?.is_class_drop ?? h.is_class_drop),
        isClassRaise: Boolean(h.is_class_raise),
        weight: Number(summ?.weight ?? h.weight ?? 122),
        equipmentChange: Boolean(h.equipment_change),
      };
    });

    const updatedRace = race ? { ...race, entries } : null;
    setRace(updatedRace);
    setDataSource(tvgUploaded.size > 0 ? "tvg" : "search");
    setResult(runSimulation(entries, simCount || undefined, updatedRace ?? undefined));
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
        HorseGPT <span className="text-blue-600">Keeneland</span>
      </h1>
      <p className="text-gray-500 text-lg mb-4">
        April 18, 2026 &middot; Brisnet track bias loaded &middot; Monte Carlo exotic pricing
      </p>

      {/* Bet Sheet CTA — the new primary UX */}
      <Link
        href="/bets"
        className="mb-8 flex items-center justify-between gap-3 px-6 py-5 rounded-xl border-2 border-emerald-500 bg-emerald-50 hover:bg-emerald-100 transition-colors"
      >
        <div>
          <div className="text-xl font-black text-emerald-900">Bet Sheet &rarr;</div>
          <div className="text-sm text-emerald-800">All 11 races' small-wager exotic tickets, one scroll.</div>
        </div>
        <div className="text-emerald-700 text-2xl">&rarr;</div>
      </Link>

      {/* Multi-race plays (Pick 3/4/5/6) */}
      <MultiRacePlaysPanel />

      {/* Results tracker */}
      <ResultsPanel />

      {/* Select Race Number */}
      <div className="mb-2 text-sm font-bold text-gray-500 uppercase tracking-wide">
        Select Race at Keeneland
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: 11 }, (_, i) => i + 1).map((num) => (
          <button
            key={num}
            onClick={() => setSelectedRaceNum(num)}
            className={`w-14 h-14 text-xl font-black rounded-xl border-2 transition-colors ${
              selectedRaceNum === num
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white border-gray-200 hover:border-blue-500 hover:bg-blue-50"
            }`}
          >
            {num}
          </button>
        ))}
      </div>

      {/* Loading state for race entries */}
      {loading && (
        <div className="mb-6 text-center py-8">
          <div className="text-xl font-bold mb-2">
            Loading {selectedTrack?.name} Race {selectedRaceNum}...
          </div>
          <div className="text-base text-gray-500">Brisnet static data — track bias + 50 features</div>
        </div>
      )}

      {/* Show race found + Step 2 only after race is selected */}
      {race && geminiEntries.length > 0 && !result && (
        <>
          {/* Race found */}
          <div className="mb-6 p-5 rounded-xl bg-blue-50 border-2 border-blue-200">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <h2 className="text-2xl font-black">
                  {race.trackName || race.track} — Race {race.raceNumber}
                </h2>
                <p className="text-base text-gray-600">
                  {race.date} &middot; {race.distance} &middot; {race.surface} &middot; {race.raceType} &middot; ${race.purse.toLocaleString()}
                </p>
              </div>
              <button
                onClick={refreshLiveFromGemini}
                disabled={liveRefreshing}
                className="shrink-0 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-bold transition-colors"
                title="Fetch live odds/scratches via Gemini web search and merge onto Brisnet baseline"
              >
                {liveRefreshing ? "Syncing..." : "Sync live from Google"}
              </button>
            </div>
            {liveStatus && (
              <p className={`text-sm font-semibold mb-2 ${
                liveStatus.includes("failed") ? "text-red-600" : "text-emerald-700"
              }`}>{liveStatus}</p>
            )}
            <p className="text-base font-semibold text-blue-700">
              {geminiEntries.length} horses loaded (Brisnet baseline{liveStatus?.includes("Synced") ? " + live sync" : ""})
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {geminiEntries.map((h) => (
                <span key={String(h.program_number)} className="px-3 py-1 rounded-lg bg-white border text-sm font-medium">
                  #{String(h.program_number)} {String(h.name)}
                  {h.morning_line_odds ? <span className="text-gray-400 ml-1">{String(h.morning_line_odds)}/1</span> : null}
                </span>
              ))}
            </div>
          </div>

          {/* STEP 2: Upload TVG screenshots */}
          <div className="mb-2 text-sm font-bold text-gray-500 uppercase tracking-wide">Step 2 — Add TVG Data (optional)</div>
          <div className="mb-6 p-6 rounded-xl border-2 border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500 mb-4">
              Upload screenshots from TVG past performances to add real data. Each screenshot adds more signal. Skip this step to run with Gemini data only.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-4">
              {([
                { key: "summary" as CatKey, label: "Summary", desc: "Overrides names, odds", required: false },
                { key: "snapshot" as CatKey, label: "Snapshot", desc: "Ratings, last finish", required: false },
                { key: "speed" as CatKey, label: "Speed & Class", desc: "Speed figures (35% weight)", required: false },
                { key: "pace" as CatKey, label: "Pace", desc: "Running style (20% weight)", required: false },
                { key: "jockey" as CatKey, label: "Jockey/Trainer", desc: "Win %, stats (10% weight)", required: false },
              ]).map(({ key, label, desc }) => (
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
            {tvgUploaded.size > 0 && (
              <p className="text-sm text-green-700 font-semibold mb-3">
                {tvgUploaded.size} screenshot(s) parsed — data will be merged with Gemini results
              </p>
            )}
          </div>

          {/* STEP 3: Run the model */}
          <div className="mb-2 text-sm font-bold text-gray-500 uppercase tracking-wide">Step 3 — Run Model</div>

          {/* Monte Carlo Simulation Slider */}
          <div className="mb-4 p-4 rounded-xl bg-gray-50 border-2 border-gray-200">
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
              style={{ background: `linear-gradient(to right, #2563eb ${(simCount / 500000) * 100}%, #e5e7eb ${(simCount / 500000) * 100}%)` }}
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Auto (convergence)</span>
              <span>50K</span>
              <span>100K</span>
              <span>250K</span>
              <span>500K</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {simCount === 0
                ? "Auto mode: runs batches until probabilities converge (recommended)"
                : simCount <= 50000
                  ? "Fast — good for quick estimates"
                  : simCount <= 150000
                    ? "Balanced — solid exacta/trifecta accuracy"
                    : simCount <= 300000
                      ? "High precision — accurate superfecta combos"
                      : "Maximum — highest accuracy for all exotic types"
              }
            </p>
          </div>

          <button
            onClick={handleRunModel}
            disabled={loading}
            className="w-full mb-8 px-8 py-5 rounded-xl bg-green-600 text-white font-black text-2xl hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            Run Exotic Bet Model
            {tvgUploaded.size > 0 && (
              <span className="block text-base font-normal mt-1">
                Gemini + {tvgUploaded.size} TVG screenshot(s)
              </span>
            )}
          </button>
        </>
      )}

      {error && (
        <div className="mb-8 p-5 rounded-xl bg-red-50 border-2 border-red-300 text-red-800 text-lg">
          {error}
        </div>
      )}

      {/* old loading state removed — replaced by inline loading in step flow */}

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
                      {({"E":"Speed","EP":"Presser","P":"Stalker","S":"Closer","C":"Deep Closer","?":"Unknown"} as Record<string,string>)[p.style] ?? p.style}
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

          {/* Recommended Bet Structures — math-picked per race */}
          {result.strategies && result.strategies.length > 0 && (
            <div className="mb-10">
              <h2 className="text-2xl font-black mb-1">Recommended Bets</h2>
              <p className="text-base text-gray-500 mb-4">
                Math picks the structure — straight, box, or key-wheel — whose expected value is highest given the model&rsquo;s probabilities.
              </p>
              <div className="grid grid-cols-1 gap-3">
                {result.strategies.map((s) => (
                  <StrategyCard key={s.betType} strategy={s} />
                ))}
              </div>
            </div>
          )}

          {/* Exotic Bets — full combo tables for reference */}
          <ExoticSection title="EXACTA" cost="$1.00" list={result.exactas} entries={race.entries} />
          <ExoticSection title="TRIFECTA" cost="$0.50" list={result.trifectas} entries={race.entries} />
          <ExoticSection title="SUPERFECTA" cost="$0.50" list={result.superfectas} entries={race.entries} />

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

function StrategyCard({ strategy }: { strategy: BetStrategy }) {
  const roiPct = Math.round(strategy.expectedRoi * 100);
  const isPositive = strategy.expectedValue > 0;
  const tierColor = isPositive
    ? "bg-emerald-50 border-emerald-400"
    : strategy.expectedRoi > -0.15
      ? "bg-amber-50 border-amber-300"
      : "bg-gray-50 border-gray-300";
  return (
    <div className={`p-4 rounded-xl border-2 ${tierColor}`}>
      <div className="flex items-baseline justify-between mb-1 gap-3">
        <div>
          <span className="text-lg font-black">{strategy.betType}</span>
          <span className="text-gray-500"> &middot; </span>
          <span className="text-lg font-bold">{strategy.name}</span>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-xl font-black ${isPositive ? "text-emerald-700" : "text-gray-700"}`}>
            {isPositive ? "+" : ""}{roiPct}% ROI
          </div>
          <div className="text-xs text-gray-500">
            EV {strategy.expectedValue >= 0 ? "+" : ""}${strategy.expectedValue.toFixed(2)}
          </div>
        </div>
      </div>
      <div className="text-sm text-gray-700 mb-2">{strategy.description}</div>
      <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
        <span><strong>{strategy.ticketCount}</strong> tickets × ${strategy.unitCost.toFixed(2)} = <strong>${strategy.totalCost.toFixed(2)}</strong></span>
        <span>Hit prob <strong>{(strategy.hitProbability * 100).toFixed(1)}%</strong></span>
        <span>E[payout] <strong>${strategy.expectedPayout.toFixed(2)}</strong></span>
      </div>
      {strategy.tickets.length > 0 && strategy.tickets.length <= 8 && (
        <div className="mt-2 text-xs font-mono text-gray-700 flex flex-wrap gap-1">
          {strategy.tickets.map((t, i) => (
            <span key={i} className="px-2 py-0.5 rounded bg-white border border-gray-200">
              {t.programs.map((p) => `#${p}`).join("-")}
              <span className="text-gray-400 ml-1">{(t.probability * 100).toFixed(1)}%</span>
            </span>
          ))}
        </div>
      )}
      {strategy.tickets.length > 8 && (
        <div className="mt-2 text-xs text-gray-500">
          {strategy.tickets.length} total combos covered (box/wheel).
        </div>
      )}
    </div>
  );
}

function ExoticSection({ title, cost, list, entries }: {
  title: string; cost: string; list: RankedExoticList; entries: HorseEntry[];
}) {
  if (!list.combos.length) return null;
  const unit = list.unitCost.toFixed(2);
  return (
    <div className="mb-10">
      <div className="flex items-baseline gap-3 mb-2">
        <h3 className="text-2xl font-black">{title}</h3>
        <span className="text-gray-500 text-lg">{cost} per combo</span>
      </div>
      <div className="mb-4 p-3 rounded-xl bg-green-50 border-2 border-green-400">
        <div className="text-sm font-bold text-green-900 uppercase tracking-wide">
          5-ticket play &middot; ${unit} each &middot; ${list.costAboveCutoff.toFixed(2)} total
        </div>
        <div className="text-xs text-green-800 mt-0.5">
          Top 5 {title.toLowerCase()}s by model probability. Play each as its own ticket rather than one large box.
        </div>
      </div>
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

// ─────────────────────────────────────────────────────────────────────────
// ResultsPanel — race-day ingest for actual finishing order.
// Paste "3 4 5 2" or fill 4 boxes; persists to localStorage. R1 is preloaded
// from CONFIRMED_RESULTS so the panel always reflects verified track results.
// ─────────────────────────────────────────────────────────────────────────
function ResultsPanel() {
  const [results, setResults] = useState<ResultsMap>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);

  useEffect(() => {
    setResults(loadResults());
  }, []);

  async function fetchLiveResults() {
    setFetching(true);
    setFetchStatus(null);
    try {
      const res = await fetch("/api/live-results", { cache: "no-store" });
      const data = await res.json();
      if (data.gemini_disabled) {
        setFetchStatus(`⚠ ${data.message ?? "Gemini unavailable — log finishes manually"}`);
        return;
      }
      if (data.error) throw new Error(data.error);
      const fetched = data.results ?? {};
      const current = loadResults();
      let added = 0;
      const merged: ResultsMap = { ...current };
      for (const [k, v] of Object.entries(fetched)) {
        const race = Number(k);
        if (Array.isArray(v) && v.length > 0 && !merged[race]) {
          merged[race] = v as string[];
          added++;
        }
      }
      saveResults(merged);
      setResults(merged);
      setFetchStatus(added > 0
        ? `Added ${added} race${added > 1 ? "s" : ""} from ${data.source ?? "live"}`
        : `Up to date — no new finishes (${data.source ?? "live"})`);
    } catch (err: unknown) {
      setFetchStatus(`Fetch failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setFetching(false);
    }
  }

  function startEdit(race: number) {
    setEditing(race);
    const existing = results[race] ?? [];
    setDraft(existing.join(" "));
  }

  function saveEdit(race: number) {
    // Parse "3 4 5 2", "3,4,5,2", or "3-4-5-2" into program strings
    const programs = draft
      .split(/[\s,\-/]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (programs.length < 1) return;
    const updated = setRaceFinish(race, programs.slice(0, 4));
    setResults(updated);
    setEditing(null);
    setDraft("");
  }

  function clearEdit(race: number) {
    const updated = clearRaceFinish(race);
    setResults(updated);
    setEditing(null);
    setDraft("");
  }

  const filledCount = Object.keys(results).length;

  return (
    <div className="mb-8 p-5 rounded-xl border-2 border-amber-200 bg-amber-50">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-amber-900">Race-Day Results</h2>
          <p className="text-xs text-amber-700">
            {filledCount} of 11 logged &middot; enter finishing order as &quot;1st 2nd 3rd 4th&quot;
          </p>
          {fetchStatus && (
            <p className="text-xs text-emerald-700 font-semibold mt-1">{fetchStatus}</p>
          )}
        </div>
        <button
          onClick={fetchLiveResults}
          disabled={fetching}
          className="shrink-0 px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-bold transition-colors"
        >
          {fetching ? "Fetching..." : "Fetch Live Results"}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Array.from({ length: 11 }, (_, i) => i + 1).map((race) => {
          const finish = results[race];
          const isEditing = editing === race;
          return (
            <div
              key={race}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                finish ? "bg-white border-amber-300" : "bg-amber-100/40 border-amber-200"
              }`}
            >
              <span className="w-7 h-7 rounded-full bg-amber-900 text-white flex items-center justify-center text-sm font-black shrink-0">
                {race}
              </span>
              {isEditing ? (
                <>
                  <input
                    type="text"
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(race);
                      if (e.key === "Escape") { setEditing(null); setDraft(""); }
                    }}
                    placeholder="e.g. 3 4 5 2"
                    className="flex-1 px-2 py-1 rounded border border-amber-400 text-sm font-mono focus:outline-none focus:border-amber-600"
                  />
                  <button
                    onClick={() => saveEdit(race)}
                    className="px-3 py-1 text-xs font-bold rounded bg-amber-700 text-white hover:bg-amber-800"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setEditing(null); setDraft(""); }}
                    className="px-2 py-1 text-xs font-bold text-amber-700 hover:text-amber-900"
                  >
                    Cancel
                  </button>
                </>
              ) : finish ? (
                <>
                  <span className="flex-1 font-mono text-sm">
                    {finish.map((p, i) => (
                      <span key={i} className={i === 0 ? "font-black text-amber-900" : "text-gray-700"}>
                        {i > 0 && <span className="text-gray-400 mx-1">/</span>}
                        #{p}
                      </span>
                    ))}
                  </span>
                  <button
                    onClick={() => startEdit(race)}
                    className="text-xs font-bold text-amber-700 hover:text-amber-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => clearEdit(race)}
                    className="text-xs font-bold text-red-600 hover:text-red-800"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-amber-700 italic">not logged</span>
                  <button
                    onClick={() => startEdit(race)}
                    className="px-3 py-1 text-xs font-bold rounded bg-amber-200 text-amber-900 hover:bg-amber-300"
                  >
                    Log finish
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// MultiRacePlaysPanel — Pick 3/4/5/6 recommendations across the card.
// For each offered multi-race bet, the model runs the ability score per
// leg and returns:
//   - single ticket: top pick per leg (cheapest, e.g. $0.50 Pick 5)
//   - coverage ticket: backup on the most chaotic leg(s), 2×-8× cost
// Live results are honored — finished legs turn green/red based on the
// recorded winner vs the model's pick.
// ─────────────────────────────────────────────────────────────────────────
function MultiRacePlaysPanel() {
  const [recs, setRecs] = useState<MultiRaceRec[]>([]);
  const [results, setResults] = useState<ResultsMap>({});

  useEffect(() => {
    const picks = allRacePicks();
    const computed = MULTI_RACE_BETS.map((bet) => computeMultiRaceRec(bet, picks));
    setRecs(computed);
    setResults(loadResults());
    // Refresh on localStorage updates (e.g. after Fetch Live)
    const handler = () => setResults(loadResults());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Split into active (at least 1 leg unfinished) and done
  const active = recs.filter((r) => r.bet.legs.some((leg) => !results[leg]));
  const done = recs.filter((r) => r.bet.legs.every((leg) => !!results[leg]));

  if (recs.length === 0) return null;

  return (
    <div className="mb-8 p-5 rounded-xl border-2 border-indigo-200 bg-indigo-50">
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <div>
          <h2 className="text-lg font-black text-indigo-900">Multi-Race Plays</h2>
          <p className="text-xs text-indigo-700">
            Pick 3/4/5/6 — top pick per leg, with coverage on the most chaotic races.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {active.map((r) => <MultiRaceCard key={r.bet.id} rec={r} results={results} />)}
      </div>
      {done.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs font-bold text-indigo-800 cursor-pointer">
            Concluded bets ({done.length})
          </summary>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-2">
            {done.map((r) => <MultiRaceCard key={r.bet.id} rec={r} results={results} />)}
          </div>
        </details>
      )}
    </div>
  );
}

function MultiRaceCard({ rec, results }: { rec: MultiRaceRec; results: ResultsMap }) {
  const bet = rec.bet;
  const aliveLegs = bet.legs.filter((leg) => {
    const actual = results[leg];
    if (!actual || actual.length === 0) return true;
    const legRec = rec.legs.find((l) => l.race === leg);
    if (!legRec) return true;
    const winner = actual[0];
    return winner === legRec.primary || winner === legRec.backup;
  });
  const alive = aliveLegs.length === bet.legs.length;
  const hasAnyResult = bet.legs.some((leg) => results[leg]);
  const borderColor = hasAnyResult
    ? alive ? "border-emerald-400" : "border-red-400"
    : "border-indigo-200";
  return (
    <div className={`p-3 rounded-xl bg-white border-2 ${borderColor}`}>
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-black text-indigo-900">{bet.label}</span>
        <span className="text-xs text-gray-500 font-mono">
          R{bet.legs.join(" · R")}
        </span>
      </div>
      <div className="text-xs space-y-1.5">
        <div>
          <div className="font-bold text-gray-700 mb-0.5">
            Single ${rec.singleCost.toFixed(2)} &middot; hit {rec.singleHitPct.toFixed(2)}%
          </div>
          <div className="font-mono text-gray-800 break-words">{rec.singleTicket}</div>
        </div>
        {rec.coverageCost > rec.singleCost && (
          <div className="pt-1 border-t border-gray-100">
            <div className="font-bold text-gray-700 mb-0.5">
              Coverage ${rec.coverageCost.toFixed(2)} &middot; hit {rec.coverageHitPct.toFixed(2)}%
            </div>
            <div className="font-mono text-gray-800 break-words">{rec.coverageTicket}</div>
          </div>
        )}
        {/* Per-leg result markers */}
        <div className="flex flex-wrap gap-1 pt-1 mt-1 border-t border-gray-100">
          {bet.legs.map((leg) => {
            const actual = results[leg];
            const legRec = rec.legs.find((l) => l.race === leg);
            const winner = actual?.[0];
            const ours = legRec?.primary;
            const backup = legRec?.backup;
            const hit = winner && (winner === ours || winner === backup);
            const color = !winner ? "bg-gray-100 text-gray-500" : hit ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900";
            return (
              <span key={leg} className={`px-2 py-0.5 rounded text-[11px] font-mono ${color}`}>
                R{leg}{winner ? ` → #${winner}` : " pending"}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
