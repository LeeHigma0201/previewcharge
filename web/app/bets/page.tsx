"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CD_2026_05_02 as TODAYS_CARD, CD_2026_05_02_DATE as TODAYS_DATE } from "../lib/cd-2026-05-02";
import HorseGPT from "../components/HorseGPT";
import { computeExoticsAnalytic, conditionalNextProbs, getRaceProbs, type RaceExoticRecs, type RaceProbs } from "../lib/bet-sheet";
import type { StaticRace } from "../lib/keeneland-apr18";
import {
  allRacePicks,
  computeMultiRaceRec,
  MULTI_RACE_BETS,
  type MultiRaceRec,
} from "../lib/multi-race";
import {
  loadResults,
  setRaceFinish,
  clearRaceFinish,
  saveResults,
  type ResultsMap,
} from "../lib/results-store";
import type { BetStrategy } from "../lib/types";

// Parse a static post-time string like "12:45 PM" combined with TODAYS_DATE
// into an epoch-ms for scheduling. Returns null if unparseable.
function parsePostTimeMs(postTime: string, isoDate: string): number | null {
  const m = postTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const meridiem = (m[3] ?? "PM").toUpperCase();
  if (meridiem === "PM" && h < 12) h += 12;
  if (meridiem === "AM" && h === 12) h = 0;
  const [yyyy, mm, dd] = isoDate.split("-").map(Number);
  // Construct a Date in local time (CD is in ET; user device tz is what matters for the UI scheduler)
  return new Date(yyyy, (mm || 1) - 1, dd || 1, h, min).getTime();
}

// Parse manual scratch input like "R1:4, R3:3,4, R6:8" into { "1": ["4"], "3": ["3","4"], "6": ["8"] }
function parseManualScratches(input: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!input) return out;
  for (const part of input.split(/[;,\n]+/).map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^R?(\d+)\s*[:\-=]\s*(.+)$/i);
    if (!m) continue;
    const race = m[1];
    const progs = m[2].split(/[\s,]+/).map((p) => p.replace(/^#/, "").trim()).filter(Boolean);
    if (progs.length === 0) continue;
    out[race] = [...(out[race] ?? []), ...progs];
  }
  return out;
}

const MANUAL_SCRATCH_KEY = "horsegpt_manual_scratches_2026-05-02";
const TRACK_CONDITION_KEY = "horsegpt_track_condition_2026-05-02";

const TRACK_CONDITIONS = ["Fast", "Wet Fast", "Good", "Muddy", "Sloppy", "Yielding", "Soft", "Firm"] as const;
type TrackCondition = (typeof TRACK_CONDITIONS)[number];

export default function BetSheet() {
  const [results, setResults] = useState<ResultsMap>({});
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  // Race insights (live odds, pace narrative, sharp moves) for the next race
  type RaceInsights = {
    raceNumber: number;
    liveOdds: Record<string, number>;
    paceScenario: string;
    sharpMoves: Array<{ program: string; from: number; to: number; reason: string }>;
    trackCondition: string | null;
    keyAngles: string[];
    source: string;
    checked_at: string;
    live_grounded?: boolean;
    grounded_urls?: string[];
  };
  const [insights, setInsights] = useState<RaceInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  // Auto-fetched (Gemini) scratches
  const [autoScratches, setAutoScratches] = useState<Record<string, string[]>>({});
  // User-entered scratches — persisted to localStorage so they survive refresh
  const [manualScratchInput, setManualScratchInput] = useState<string>("");
  const [scratchStatus, setScratchStatus] = useState<string | null>(null);
  // Track condition override — defaults to Fast for Apr 30 (no precip in forecast); user can flip mid-card.
  const [trackCondition, setTrackCondition] = useState<TrackCondition>("Fast");

  useEffect(() => {
    setResults(loadResults());
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(MANUAL_SCRATCH_KEY);
      if (stored) setManualScratchInput(stored);
      const cond = localStorage.getItem(TRACK_CONDITION_KEY);
      if (cond && (TRACK_CONDITIONS as readonly string[]).includes(cond)) {
        setTrackCondition(cond as TrackCondition);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(TRACK_CONDITION_KEY, trackCondition);
  }, [trackCondition]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(MANUAL_SCRATCH_KEY, manualScratchInput);
  }, [manualScratchInput]);

  // Merge auto + manual scratches by race; manual wins on conflict / dedupe
  const scratches = useMemo<Record<string, string[]>>(() => {
    const manual = parseManualScratches(manualScratchInput);
    const merged: Record<string, string[]> = {};
    const races = new Set([...Object.keys(autoScratches), ...Object.keys(manual)]);
    for (const r of races) {
      const set = new Set<string>([...(autoScratches[r] ?? []), ...(manual[r] ?? [])]);
      merged[r] = Array.from(set);
    }
    return merged;
  }, [autoScratches, manualScratchInput]);

  // Fetch scratches once on mount; refresh every 5 minutes while page is open.
  useEffect(() => {
    let cancelled = false;
    async function fetchScratches() {
      try {
        const res = await fetch(`/api/scratches?track=CD&date=${TODAYS_DATE}`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (data.gemini_disabled) {
          setScratchStatus(`⚠ ${data.message}`);
          return;
        }
        if (data.error) {
          setScratchStatus(`✗ scratch fetch: ${data.error}`);
          return;
        }
        const byRace = (data.byRace ?? {}) as Record<string, string[]>;
        setAutoScratches(byRace);
        const total = Object.values(byRace).reduce((acc, arr) => acc + arr.length, 0);
        setScratchStatus(total > 0 ? `✓ Gemini found ${total} scratch(es) — verify and add manual ones below` : `Gemini found no scratches — add manual ones below if you see any`);
      } catch (err: unknown) {
        if (!cancelled) setScratchStatus(`✗ ${err instanceof Error ? err.message : "scratch fetch failed"}`);
      }
    }
    fetchScratches();
    const id = setInterval(fetchScratches, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Fetch race insights for the next race (live odds + pace + sharp moves).
  // Re-fetches whenever the next race changes.
  async function fetchInsightsFor(raceNumber: number) {
    setInsightsLoading(true);
    try {
      const res = await fetch(`/api/race-insights?race=${raceNumber}`, { cache: "no-store" });
      const data = await res.json();
      if (data.gemini_disabled || data.error) {
        setInsights(null);
      } else {
        setInsights(data);
        // If Gemini reports a different track condition with confidence, surface it
        // (don't auto-apply — user should approve via the toggle).
      }
    } catch {
      setInsights(null);
    } finally {
      setInsightsLoading(false);
    }
  }

  // Auto-update finishes: 4 minutes after each scheduled post time, fetch live results.
  // Effect runs once; for each future race, schedule a one-shot timer.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const now = Date.now();
    for (const race of TODAYS_CARD) {
      const postMs = parsePostTimeMs(race.postTime, TODAYS_DATE);
      if (postMs == null) continue;
      const fireAt = postMs + 4 * 60 * 1000;
      const delay = fireAt - now;
      if (delay > 0 && delay < 12 * 60 * 60 * 1000) {
        timers.push(setTimeout(() => { fetchLiveResults(); }, delay));
      }
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build a card with scratches AND track condition applied. The condition
  // override flows into bet-sheet.ts scoring so wet tracks boost closers/stalkers.
  const cardWithScratches = useMemo(() => {
    return TODAYS_CARD.map((race) => {
      const sc = scratches[String(race.raceNumber)] ?? [];
      const out = { ...race, condition: trackCondition };
      if (sc.length > 0) out.scratches = sc;
      return out;
    });
  }, [scratches, trackCondition]);

  const allRecs = useMemo<RaceExoticRecs[]>(
    () => cardWithScratches.map(computeExoticsAnalytic),
    [cardWithScratches],
  );

  const multiRecs = useMemo<MultiRaceRec[]>(() => {
    const picks = allRacePicks();
    return MULTI_RACE_BETS.map((b) => computeMultiRaceRec(b, picks));
  }, []);

  async function fetchLiveResults() {
    setFetching(true);
    setFetchStatus(null);
    try {
      const res = await fetch("/api/live-results", { cache: "no-store" });
      const data = await res.json();
      if (data.gemini_disabled) {
        setFetchStatus(`⚠ ${data.message ?? "Gemini unavailable — using Brisnet static data"}`);
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
      setFetchStatus(
        added > 0
          ? `✓ Synced ${added} new race${added > 1 ? "s" : ""} from ${data.source ?? "live"}`
          : `✓ Up to date — no new finishes (${data.source ?? "live"})`,
      );
    } catch (err: unknown) {
      setFetchStatus(`✗ ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setFetching(false);
    }
  }

  const filledCount = Object.keys(results).length;
  const nextRace = useMemo(() => {
    return cardWithScratches.find((r) => !results[r.raceNumber]);
  }, [results, cardWithScratches]);

  // Re-fetch race insights whenever the next race changes
  useEffect(() => {
    if (!nextRace) return;
    if (insights?.raceNumber === nextRace.raceNumber) return;
    fetchInsightsFor(nextRace.raceNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextRace?.raceNumber]);

  return (
    <main className="min-h-screen bg-black text-white pb-24">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-black/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-black truncate">HorseGPT &middot; Bet Sheet</h1>
            <p className="text-xs text-gray-400">
              Churchill Downs {TODAYS_DATE} &middot; {filledCount}/{TODAYS_CARD.length} done
              {nextRace && <span> &middot; next R{nextRace.raceNumber} {nextRace.postTime}</span>}
            </p>
            {scratchStatus && (
              <p className={`text-[10px] leading-tight mt-0.5 ${
                scratchStatus.startsWith("✓") ? "text-emerald-500"
                : scratchStatus.startsWith("⚠") ? "text-amber-400"
                : "text-red-400"
              }`}>{scratchStatus}</p>
            )}
            <div className="mt-1 flex items-center gap-2">
              <label className="text-[10px] text-gray-400 shrink-0">Track:</label>
              <select
                value={trackCondition}
                onChange={(e) => setTrackCondition(e.target.value as TrackCondition)}
                className={`text-[11px] px-2 py-1 rounded border bg-gray-900 border-gray-700 focus:outline-none focus:border-emerald-500 ${
                  ["Muddy","Sloppy","Wet Fast","Good","Yielding","Soft"].includes(trackCondition)
                    ? "text-amber-300" : "text-gray-200"
                }`}
              >
                {TRACK_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="mt-1">
              <input
                type="text"
                value={manualScratchInput}
                onChange={(e) => setManualScratchInput(e.target.value)}
                placeholder='SCR override: "R1:4, R3:3,4, R6:8"'
                className="w-full text-[11px] px-2 py-1 rounded bg-gray-900 border border-gray-700 text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-emerald-500"
              />
              {(() => {
                const total = Object.values(scratches).reduce((a, arr) => a + arr.length, 0);
                if (total === 0) return null;
                const lines = Object.entries(scratches)
                  .filter(([, progs]) => progs.length > 0)
                  .sort((a, b) => Number(a[0]) - Number(b[0]))
                  .map(([r, progs]) => `R${r}: ${progs.map((p) => `#${p}`).join(", ")}`)
                  .join(" · ");
                return <p className="text-[10px] text-amber-400 mt-0.5 leading-tight">{`Active scratches: ${lines}`}</p>;
              })()}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <button
              onClick={fetchLiveResults}
              disabled={fetching}
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 text-white text-xs font-bold"
            >
              {fetching ? "Fetching..." : "Fetch Live Results"}
            </button>
            {fetchStatus && (
              <span className={`text-[10px] leading-tight text-right max-w-[200px] ${
                fetchStatus.startsWith("✓") ? "text-emerald-400"
                : fetchStatus.startsWith("⚠") ? "text-amber-400"
                : "text-red-400"
              }`}>{fetchStatus}</span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-4">
        {/* R1 lessons learned */}
        {results[1] && (
          <div className="mb-3 p-3 rounded-lg border border-amber-700 bg-amber-950/40">
            <div className="text-xs font-bold text-amber-300 mb-1">R1 LEARNED ({results[1].join("-")})</div>
            <div className="text-[11px] text-amber-100/90 leading-snug space-y-1">
              <p><span className="font-semibold">#4 Star&apos;s Image won at 9/2.</span> The EVEN-money chalk #1 Banned for Life finished 3rd.</p>
              <p><span className="font-semibold">Pattern:</span> Star&apos;s Image had a single Beyer of 62 off a 108-day layoff. Algo punished him to ability ×0.70 on that lone figure; market priced him 4.5/1 because the layoff figure was stale.</p>
              <p><span className="font-semibold">Fix shipped:</span> When a horse has ≤1 prior Beyer, defer to Prime Power. Plus 12 CD spring-meet trainers added (Sharp, Saffie Joseph Jr., DeVaux, Casse, Romans, Wilkes...).</p>
            </div>
          </div>
        )}
        {/* Through-R4 lessons + algo v2 ship notice */}
        {results[4] && (
          <div className="mb-4 p-3 rounded-lg border-2 border-emerald-700 bg-emerald-950/40">
            <div className="text-xs font-bold text-emerald-300 mb-1">ALGO v2 SHIPPED — TWO TWEAKS BACKED BY 4 RACES OF DATA</div>
            <div className="text-[11px] text-emerald-100/90 leading-snug space-y-1">
              <p><span className="font-semibold">Pool-disparity flag is now 4-for-4 today.</span> R1 BFL → 3rd. R2 SV → 3rd. R3 Spotted → out of top 5. R4 Theoretical → 5th. Every public chalk we flagged has lost.</p>
              <p><span className="font-semibold">Tweak A — Dual-mode pool disparity.</span> Old: W{'>'}P always meant chalk-doubt. New: top-3 odds + W{'>'}P = chalk doubt (penalty); 5/1–12/1 + W{'>'}P = sharp WIN money (bonus). R4 #11 Plot fit the second case (W11/P7/S5, 7/1) and finished 2nd; algo had penalized him.</p>
              <p><span className="font-semibold">Tweak B — Intra-card style-bias override.</span> 4/4 winners today were P/EP/closer types beating the chalk speed. Track is closer-friendly. eIV: 1.45→1.10. epIV: 1.60→1.20. pIV: 0.65→1.00. sIV: 0.35→0.90. Inside-post bonus also dampened. Auto-activates at race 5+ when results.json shows the pattern.</p>
              <p><span className="font-semibold">R5 picks reflect both:</span> #3 Jinxzi tops, #12 Tregetour 2nd (smart board lean +6), #1 Chasing Gray 3rd (Expert E #1). Pre-tweak algo had #4 Cliffs of Dover #1 (he&apos;s now 6th — money drifted off, 4.5 ML to 10 live).</p>
              <p className="text-emerald-300/70"><span className="font-semibold">Honest caveat:</span> Tweak A backed by N=1 (R4 #11). Tweak B backed by 4-race intra-card pattern. Real validation still needs 30+ races. Both reverse cleanly if R5 result contradicts.</p>
            </div>
          </div>
        )}
        {/* R10 lesson — chalk-doubt failed in stakes (2nd time today). Correction. */}
        {results[10] && (
          <div className="mb-3 p-3 rounded-lg border-2 border-rose-700 bg-rose-950/40">
            <div className="text-xs font-bold text-rose-300 mb-1">R10 LEARNED ({results[10].join("-")}) — CHALK-DOUBT NEEDS SEGMENTATION</div>
            <div className="text-[11px] text-rose-100/90 leading-snug space-y-1">
              <p><span className="font-semibold">#9 Maximum Bourbon won at $3.92.</span> Algo had him #2 (19.7%). Pool-disparity flag fired huge against #9 (+5.2 W-P, +7.3 W-S compound) — and FAILED. Second consecutive stakes failure for the flag (after R9 Lagynos).</p>
              <p><span className="font-semibold">Pattern (N=2 same direction):</span> Chalk-doubt flag is 4-for-4 on claiming/maiden/allowance, 0-for-2 on stakes with top-tier J+T. Don&apos;t override the algo&apos;s top-2 ranking based on pool flags in stakes races.</p>
              <p><span className="font-semibold">Framework correction:</span> Pool flags are SECONDARY signals. Use them to identify smart-money board horses (P{'>'}W) and sharp-show horses (S{'>'}W) for under-spread construction. Do NOT use them to fade the algo&apos;s top-1 win pick.</p>
              <p><span className="font-semibold">Algo today:</span> top-1 4/9 = 44%, top-2 in last 5 races = 5/5 = 100%, top-3 8/9 = 88.9%. Trust the model.</p>
            </div>
          </div>
        )}
        {/* HONEST end-of-day scorecard — no cherry-picking, no celebration emojis */}
        {results[5] && (
          <div className="mb-3 p-3 rounded-lg border border-sky-700 bg-sky-950/30">
            <div className="text-xs font-bold text-sky-300 mb-1">TODAY&apos;S SCORECARD — HONEST</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-sky-100/90 leading-snug">
              <div>Algo top-1 hit rate:</div>
              <div className="font-mono font-bold text-amber-300">5/10 (50%)</div>
              <div>ML chalk top-1 (control):</div>
              <div className="font-mono font-bold text-amber-300">5/10 (50%)</div>
              <div className="col-span-2 text-[10px] text-amber-300/90 italic">
                → Algo top-1 was TIED with chalk today. No top-1 edge.
              </div>
              <div className="mt-1">Algo top-3 hit rate:</div>
              <div className="font-mono text-emerald-300 mt-1">8/10 (80%) ← wide net</div>
              <div>Forward exacta (top-2 in order):</div>
              <div className="font-mono text-emerald-300">3/11 (27%) — R5, R8, R11</div>
              <div>Chalk-doubt flag:</div>
              <div className="font-mono text-amber-300">4/7 (57%)</div>
              <div>↳ on claiming/maiden:</div>
              <div className="font-mono font-bold text-emerald-300">4/4</div>
              <div>↳ on stakes:</div>
              <div className="font-mono font-bold text-rose-300">0/3</div>
              <div>Smart-money board (P{'>'}W):</div>
              <div className="font-mono text-amber-300">2/3 (67%)</div>
            </div>
            <div className="mt-2 pt-2 border-t border-sky-800 text-[11px] text-sky-100/90">
              <div className="font-bold text-sky-300 mb-0.5">Theoretical flat-bet ROI ($1 EX BOX top-2 every race):</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <div>Wagered (11 × $2):</div>
                <div className="font-mono">$22.00</div>
                <div>Returned (R5 $56 + R8 $8 + R11 $7):</div>
                <div className="font-mono">$71.00</div>
                <div>Net / ROI:</div>
                <div className="font-mono text-emerald-300">+$49.00 / +222.7%</div>
                <div className="font-bold text-rose-300">Without R5 outlier:</div>
                <div className="font-mono font-bold text-rose-300">-$7.00 / -31.8%</div>
                <div className="col-span-2 text-[10px] text-rose-300/90 italic mt-1">
                  → The +222.7% ROI is driven by ONE race (R5 paid $56). Without R5, the strategy LOSES money. N=1 day. Don&apos;t overclaim.
                </div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-rose-900 text-[11px] text-rose-100/80">
              <div className="font-bold text-rose-300 mb-0.5">User&apos;s actual bets (Mac Claude recs):</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <div>R10 ($6 super, faded #9):</div>
                <div className="font-mono text-rose-300">$0 — chalk #9 won</div>
                <div>R11 ($6 EX BOX top-4 5-8-6-3):</div>
                <div className="font-mono text-rose-300">~$3.50 — paid less than wagered</div>
                <div>R12 ($5 dual super keys):</div>
                <div className="font-mono text-rose-300">missed (assumed)</div>
                <div className="font-bold mt-1">Net on the recs:</div>
                <div className="font-mono font-bold text-rose-300 mt-1">~-$13.50 on $17 wagered</div>
                <div className="col-span-2 text-[10px] text-rose-300/90 italic mt-1">
                  → The Mac session&apos;s ticket structures lost money. Algo had its picks; the bet structure I built around them was wrong. Lesson next session: tighter top-2 box, no flag-fade overrides.
                </div>
              </div>
            </div>
          </div>
        )}
        {/* HUGE next-race block — write these on your ticket */}
        {nextRace && (() => {
          const recs = allRecs.find((r) => r.raceNumber === nextRace.raceNumber);
          if (!recs) return null;
          return (
            <div className="mb-6 p-4 rounded-xl border-4 border-emerald-400 bg-emerald-950">
              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <div className="text-3xl font-black text-emerald-300">R{nextRace.raceNumber} &middot; NEXT</div>
                  <div className="text-sm text-gray-300">{nextRace.postTime} &middot; {nextRace.raceType} &middot; {nextRace.distance} {nextRace.surface}</div>
                </div>
              </div>
              <div className="mb-3 text-xs text-emerald-200/80 leading-snug p-2 rounded bg-black/30">
                <span className="font-bold text-emerald-300 mr-1">horses:</span>
                {(() => {
                  const seen = new Map<string, string>();
                  for (const s of [recs.superfecta, recs.trifecta, recs.exacta]) {
                    for (const t of s.tickets) {
                      for (let i = 0; i < t.programs.length; i++) {
                        if (!seen.has(t.programs[i])) seen.set(t.programs[i], t.names[i]);
                      }
                    }
                  }
                  return Array.from(seen.entries())
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([prog, name], i, arr) => (
                      <span key={prog} className="mr-2">
                        <span className="font-black text-white">#{prog}</span>{" "}
                        <span>{name}</span>
                        {i < arr.length - 1 && <span className="text-emerald-700"> ·</span>}
                      </span>
                    ));
                })()}
              </div>
              <div className="space-y-3">
                <BigBetRow label="SUPERFECTA" s={recs.superfecta} />
                <BigBetRow label="TRIFECTA"   s={recs.trifecta} />
                <BigBetRow label="EXACTA"     s={recs.exacta} />
              </div>
              {/* Gemini race insights — live odds, pace, sharp moves */}
              {insightsLoading && (
                <div className="mt-3 text-[11px] text-emerald-200/70 italic">Fetching live odds + pace…</div>
              )}
              {insights && insights.raceNumber === nextRace.raceNumber && (
                <div className="mt-3 p-3 rounded-lg bg-black/40 border border-emerald-700/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-wide text-emerald-400 font-bold">Race intelligence (Gemini)</div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      insights.live_grounded ? "bg-emerald-700 text-white" : "bg-red-800 text-red-100"
                    }`}>
                      {insights.live_grounded ? "LIVE" : "STALE"}
                    </span>
                  </div>
                  {!insights.live_grounded && (
                    <div className="text-[10px] text-red-300">
                      Gemini did not perform a live web search — track condition / odds suppressed. Refresh in a minute.
                    </div>
                  )}
                  {insights.trackCondition && (
                    <div className="text-[11px] text-amber-300">
                      <span className="text-gray-400">Track:</span> {insights.trackCondition}
                      {insights.trackCondition !== trackCondition && (
                        <button
                          onClick={() => setTrackCondition(insights.trackCondition as TrackCondition)}
                          className="ml-2 px-2 py-0.5 rounded bg-amber-700 hover:bg-amber-600 text-white text-[10px]"
                        >apply</button>
                      )}
                    </div>
                  )}
                  {insights.paceScenario && (
                    <div className="text-[11px] text-emerald-100/90">{insights.paceScenario}</div>
                  )}
                  {insights.sharpMoves.length > 0 && (
                    <div className="text-[11px]">
                      <span className="text-gray-400">Sharp moves: </span>
                      {insights.sharpMoves.map((m, i) => (
                        <span key={i} className="text-yellow-400 mr-2">
                          #{m.program} {m.from.toFixed(1)}→{m.to.toFixed(1)}
                        </span>
                      ))}
                    </div>
                  )}
                  {insights.keyAngles.length > 0 && (
                    <ul className="text-[11px] text-emerald-200/80 space-y-0.5 list-disc list-inside">
                      {insights.keyAngles.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  )}
                  {Object.keys(insights.liveOdds).length > 0 && (
                    <div className="text-[10px] text-gray-400">
                      Live odds: {Object.entries(insights.liveOdds)
                        .sort((a, b) => Number(a[0]) - Number(b[0]))
                        .map(([p, o]) => `#${p}:${o.toFixed(1)}`)
                        .join(" · ")}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <p className="text-xs text-gray-500">All races below. Next is highlighted above.</p>
          <div className="flex items-center gap-3">
            <Link href="/recap" className="text-xs text-indigo-400 hover:underline">
              Day recap →
            </Link>
            <Link href="/" className="text-xs text-blue-400 hover:underline">
              Full simulator →
            </Link>
          </div>
        </div>

        {/* Race cards */}
        <div className="space-y-3">
          {cardWithScratches.map((race) => {
            const recs = allRecs.find((r) => r.raceNumber === race.raceNumber);
            if (!recs) return null;
            const finish = results[race.raceNumber];
            return (
              <RaceCard
                key={race.raceNumber}
                race={race}
                recs={recs}
                finish={finish}
                isNext={!finish && nextRace?.raceNumber === race.raceNumber}
                onLogFinish={(programs) => {
                  const updated = setRaceFinish(race.raceNumber, programs);
                  setResults(updated);
                }}
                onClearFinish={() => {
                  const updated = clearRaceFinish(race.raceNumber);
                  setResults(updated);
                }}
              />
            );
          })}
        </div>

        {/* Multi-race plays */}
        <div className="mt-6">
          <h2 className="text-lg font-black mb-2 text-indigo-300">Multi-Race Plays</h2>
          <div className="grid grid-cols-1 gap-2">
            {multiRecs.map((r) => <MultiRaceCardLite key={r.bet.id} rec={r} results={results} />)}
          </div>
        </div>
      </div>
      <HorseGPT />
    </main>
  );
}

// ───────────────────────────── components ─────────────────────────────

/**
 * Probability matrix explorer — click a horse to "lock" them in 1st, then see
 * the conditional 2nd-place probs for every remaining horse. Click again to lock
 * 2nd, see 3rd. Etc. Lets you build a tri/super ticket by walking the tree.
 */
function ProbMatrix({ race }: { race: StaticRace }) {
  const [locked, setLocked] = useState<number[]>([]); // indices into rp.programs
  const rp = useMemo<RaceProbs>(() => getRaceProbs(race), [race]);
  if (rp.programs.length === 0) return null;

  // Build columns: col 0 = win probs; col 1 = conditional given lock[0]; etc.
  const columns: Array<{ probs: number[]; lockedSoFar: number[] }> = [];
  for (let depth = 0; depth <= Math.min(3, rp.programs.length - 1); depth++) {
    const lockedAtDepth = locked.slice(0, depth);
    const probs = depth === 0
      ? rp.winProbs
      : conditionalNextProbs(rp, lockedAtDepth);
    columns.push({ probs, lockedSoFar: lockedAtDepth });
    if (depth >= locked.length) break; // don't show columns past current depth + 1
  }

  function clickAt(depth: number, idx: number) {
    if (locked.includes(idx) && locked.indexOf(idx) !== depth) return; // already locked elsewhere
    const next = [...locked.slice(0, depth), idx];
    setLocked(next);
  }

  function reset() { setLocked([]); }

  const labels = ["1st", "2nd", "3rd", "4th"];

  return (
    <div className="mt-2 p-2 rounded bg-black/40 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-wide text-indigo-400 font-bold">Probability Matrix</div>
        {locked.length > 0 && (
          <button onClick={reset} className="text-[10px] text-gray-400 hover:text-white px-2 py-0.5 rounded border border-gray-700">reset</button>
        )}
      </div>
      <div className="text-[10px] text-gray-500 mb-2">Click a horse in any column to lock them in that position. The next column re-weights for remaining horses.</div>
      <div className={`grid grid-cols-${columns.length} gap-2`} style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
        {columns.map((col, depth) => {
          const sortedIdxs = col.probs
            .map((p, i) => ({ i, p }))
            .filter((x) => x.p > 0)
            .sort((a, b) => b.p - a.p);
          return (
            <div key={depth} className="space-y-1">
              <div className="text-[10px] font-bold text-indigo-300 mb-1">{labels[depth]}</div>
              {sortedIdxs.slice(0, 8).map(({ i, p }) => {
                const isLockedHere = locked[depth] === i;
                return (
                  <button
                    key={i}
                    onClick={() => clickAt(depth, i)}
                    className={`w-full text-left text-[11px] px-1.5 py-1 rounded border transition-colors ${
                      isLockedHere
                        ? "bg-indigo-700 border-indigo-500 text-white font-bold"
                        : "border-gray-700 bg-gray-900 hover:bg-gray-800 text-gray-200"
                    }`}
                  >
                    <span className="font-bold mr-1">#{rp.programs[i]}</span>
                    <span className="text-gray-400">{(p * 100).toFixed(1)}%</span>
                    <div className="text-[9px] text-gray-500 truncate">{rp.names[i]}</div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      {locked.length > 0 && (
        <div className="mt-2 text-[11px] text-emerald-300">
          Building: {locked.map((i) => `#${rp.programs[i]}`).join(" → ")}
        </div>
      )}
    </div>
  );
}

function RaceCard({ race, recs, finish, isNext, onLogFinish, onClearFinish }: {
  race: (typeof TODAYS_CARD)[number];
  recs: RaceExoticRecs;
  finish?: string[];
  isNext: boolean;
  onLogFinish: (programs: string[]) => void;
  onClearFinish: () => void;
}) {
  const done = !!finish;
  const [logging, setLogging] = useState(false);
  const [draft, setDraft] = useState("");

  const border = done
    ? "border-gray-700 bg-gray-900/50"
    : isNext
      ? "border-emerald-400 bg-emerald-950/30"
      : "border-gray-700 bg-gray-900";

  function save() {
    const programs = draft
      .split(/[\s,\-/]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4);
    if (programs.length === 0) return;
    onLogFinish(programs);
    setLogging(false);
    setDraft("");
  }

  return (
    <div className={`rounded-lg border-2 ${border} p-3`}>
      <div className="flex items-baseline justify-between mb-2 gap-2">
        <div className="min-w-0">
          <span className="font-black text-white">R{race.raceNumber}</span>
          <span className="text-gray-400 text-sm"> &middot; {race.postTime} &middot; {race.raceType} &middot; {race.distance} {race.surface}</span>
          {isNext && <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-black uppercase">next</span>}
          {done && <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 text-[10px] font-black uppercase">final</span>}
        </div>
      </div>

      {/* Result bar */}
      {done ? (
        <div className="mb-2 flex items-center gap-2">
          <span className="font-mono text-sm text-gray-300">
            {finish!.map((p, i) => (
              <span key={i}>
                {i > 0 && <span className="text-gray-600 mx-1">/</span>}
                <span className={i === 0 ? "text-emerald-400 font-black" : ""}>#{p}</span>
              </span>
            ))}
          </span>
          <button onClick={onClearFinish} className="text-[10px] text-red-400 hover:text-red-300 ml-auto">clear</button>
        </div>
      ) : logging ? (
        <div className="mb-2 flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setLogging(false); }}
            placeholder="1st 2nd 3rd 4th"
            className="flex-1 bg-black border border-gray-700 rounded px-2 py-1 text-sm font-mono"
          />
          <button onClick={save} className="px-2 py-1 rounded bg-emerald-600 text-white text-xs font-bold">Save</button>
          <button onClick={() => setLogging(false)} className="text-xs text-gray-400">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setLogging(true)} className="mb-2 text-xs text-gray-400 hover:text-emerald-400">
          + log finish
        </button>
      )}

      {/* Horse legend — prevents program# mapping errors from deceiving silently */}
      {!done && <HorseLegend recs={recs} />}

      {/* Tickets */}
      <div className={`space-y-1.5 ${done ? "opacity-50" : ""}`}>
        <TicketRow label="SUPER" s={recs.superfecta} />
        <TicketRow label="TRI"   s={recs.trifecta} />
        <TicketRow label="EXACTA" s={recs.exacta} />
      </div>

      {/* Conditional probability matrix — click horses to walk the tree */}
      {!done && <ProbMatrix race={race} />}
    </div>
  );
}

// Shows horse names for every program number that appears in any ticket,
// so you can cross-check against the track program and catch mapping bugs.
function HorseLegend({ recs }: { recs: RaceExoticRecs }) {
  const seen = new Map<string, string>(); // program -> name
  for (const s of [recs.superfecta, recs.trifecta, recs.exacta]) {
    for (const t of s.tickets) {
      for (let i = 0; i < t.programs.length; i++) {
        if (!seen.has(t.programs[i])) seen.set(t.programs[i], t.names[i]);
      }
    }
  }
  const sorted = Array.from(seen.entries()).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (sorted.length === 0) return null;
  return (
    <div className="mb-2 text-[11px] text-gray-400 leading-snug">
      <span className="text-gray-500 mr-1">horses:</span>
      {sorted.map(([prog, name], i) => (
        <span key={prog} className="mr-2">
          <span className="font-black text-white">#{prog}</span>{" "}
          <span className="text-gray-300">{name}</span>
          {i < sorted.length - 1 && <span className="text-gray-700"> ·</span>}
        </span>
      ))}
    </div>
  );
}

function TicketRow({ label, s }: { label: string; s: BetStrategy }) {
  const hitPct = (s.hitProbability * 100).toFixed(1);
  const fingerprint = s.tickets.length <= 6
    ? s.tickets.map((t) => t.programs.map((p) => `#${p}`).join("-")).join("   ")
    : `${s.tickets.length} combos covered`;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="w-14 shrink-0 font-black text-xs text-gray-500 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-bold text-white">{s.name}</span>
          <span className="text-gray-400 text-xs">${s.totalCost.toFixed(2)}</span>
          <span className="text-gray-500 text-xs">hit {hitPct}%</span>
        </div>
        <div className="font-mono text-xs text-gray-300 break-words">{fingerprint}</div>
      </div>
    </div>
  );
}

// BIG version used in the top "NEXT" block — phone-legible, no EV noise
function BigBetRow({ label, s }: { label: string; s: BetStrategy }) {
  const hitPct = (s.hitProbability * 100).toFixed(1);
  const fingerprint = s.tickets.length <= 6
    ? s.tickets.map((t) => t.programs.map((p) => `#${p}`).join("-"))
    : [`${s.tickets.length} combos covered`];
  return (
    <div className="bg-black/60 rounded-lg p-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-base font-black text-emerald-300">{label}</span>
        <span className="text-sm text-gray-300">
          <span className="font-bold text-white">${s.totalCost.toFixed(2)}</span>
          <span className="text-gray-500"> &middot; {s.name} &middot; hit {hitPct}%</span>
        </span>
      </div>
      <div className="font-mono text-xl font-black text-white break-words leading-tight">
        {fingerprint.map((t, i) => (
          <span key={i}>
            {i > 0 && <span className="text-gray-600 mx-2">·</span>}
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function MultiRaceCardLite({ rec, results }: { rec: MultiRaceRec; results: ResultsMap }) {
  const bet = rec.bet;
  const aliveLegs = bet.legs.filter((leg) => {
    const actual = results[leg];
    if (!actual || actual.length === 0) return true;
    const legRec = rec.legs.find((l) => l.race === leg);
    if (!legRec) return true;
    return actual[0] === legRec.primary || actual[0] === legRec.backup;
  });
  const alive = aliveLegs.length === bet.legs.length;
  const hasAnyResult = bet.legs.some((leg) => results[leg]);
  const borderColor = hasAnyResult
    ? alive ? "border-emerald-500" : "border-red-500"
    : "border-indigo-500/50";
  return (
    <div className={`p-3 rounded border-2 ${borderColor} bg-gray-900`}>
      <div className="flex items-baseline justify-between mb-1 gap-2 text-sm">
        <span className="font-black text-indigo-300">{bet.label}</span>
        <span className="text-xs text-gray-500 font-mono">R{bet.legs.join(" · R")}</span>
      </div>
      <div className="text-xs space-y-1">
        <div className="font-mono text-gray-300 break-words">{rec.singleTicket}</div>
        <div className="text-gray-500">
          Single ${rec.singleCost.toFixed(2)} &middot; hit {rec.singleHitPct.toFixed(2)}%
          {rec.coverageCost > rec.singleCost && (
            <span> &middot; coverage ${rec.coverageCost.toFixed(2)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
