"use client";

import { useEffect, useMemo, useState } from "react";
import { SA_APR26_2026 as CARD, SA_APR26_DATE as CARD_DATE } from "../lib/sa-2026-04-26";
import { computeExoticsAnalytic, type RaceExoticRecs } from "../lib/bet-sheet";
import {
  loadResults,
  setRaceFinish,
  clearRaceFinish,
  saveResults,
  type ResultsMap,
} from "../lib/results-store";
import type { BetStrategy } from "../lib/types";

export default function BetSheet() {
  const [results, setResults] = useState<ResultsMap>({});
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    setResults(loadResults());
  }, []);

  const allRecs = useMemo<RaceExoticRecs[]>(
    () => CARD.map(computeExoticsAnalytic),
    [],
  );

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
    return CARD.find((r) => !results[r.raceNumber]);
  }, [results]);

  return (
    <main className="min-h-screen bg-black text-white pb-24">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-black/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-black truncate">HorseGPT &middot; Bet Sheet</h1>
            <p className="text-xs text-gray-400">
              {CARD_DATE} &middot; {filledCount}/{CARD.length} done
              {nextRace && <span> &middot; next R{nextRace.raceNumber} {nextRace.postTime}</span>}
            </p>
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
            </div>
          );
        })()}

        {/* Race cards */}
        <div className="space-y-3">
          {CARD.map((race) => {
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
      </div>
    </main>
  );
}

// ───────────────────────────── components ─────────────────────────────

function RaceCard({ race, recs, finish, isNext, onLogFinish, onClearFinish }: {
  race: (typeof CARD)[number];
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

      {/* Per-horse W/P/S sim — full picture */}
      {!done && <HorseSimTable recs={recs} />}

      {/* Smart part-wheel super — high coverage, low cost */}
      {!done && recs.partWheel.validCombos > 0 && (
        <PartWheelRow pw={recs.partWheel} />
      )}

      {/* Tickets */}
      <div className={`space-y-1.5 ${done ? "opacity-50" : ""}`}>
        <TicketRow label="SUPER" s={recs.superfecta} />
        <TicketRow label="TRI"   s={recs.trifecta} />
        <TicketRow label="EXACTA" s={recs.exacta} />
      </div>
    </div>
  );
}

// Part-wheel super: A,B,C / D,E,F,G / H,I,J,K / L,M,N,O,P at $0.10 unit
function PartWheelRow({ pw }: { pw: import("../lib/bet-sheet").PartWheel }) {
  const hitPct = (pw.hitProbability * 100).toFixed(0);
  return (
    <div className="mb-2 rounded-lg border-2 border-emerald-700 bg-emerald-950/30 p-2">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div className="flex items-baseline gap-2">
          <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-black text-[10px] font-black uppercase">
            Super Part-Wheel
          </span>
          <span className="text-[10px] text-emerald-300">${pw.unitCost.toFixed(2)} unit</span>
        </div>
        <div className="text-right">
          <div className="text-base font-black text-white">${pw.totalCost.toFixed(2)}</div>
          <div className="text-[10px] text-gray-400">{pw.validCombos} combos · hit {hitPct}%</div>
        </div>
      </div>
      <div className="font-mono text-sm text-emerald-100 select-all break-all">
        {pw.slotPrograms.map((slot, i) => (
          <span key={i}>
            {i > 0 && <span className="text-gray-500"> / </span>}
            <span>{slot.join(",")}</span>
          </span>
        ))}
      </div>
      <div className="text-[10px] text-gray-400 mt-1">
        Slot 1 (top by win) / Slot 2 (top by place) / Slot 3 (top by show) / Slot 4 (spreader). Copy → TwinSpires.
      </div>
    </div>
  );
}

// Per-horse Win / Place / Show with overlay highlighting.
// "Overlay" = model thinks horse is undervalued vs morning line — these are the BETS.
function HorseSimTable({ recs }: { recs: RaceExoticRecs }) {
  const horses = recs.horses;
  if (!horses?.length) return null;
  return (
    <div className="mb-2 rounded border border-gray-800 bg-black/40 overflow-hidden">
      <div className="grid grid-cols-[28px_1fr_42px_44px_44px_44px_56px] gap-1 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-800">
        <div>#</div>
        <div>Horse</div>
        <div className="text-right">ML</div>
        <div className="text-right">Win</div>
        <div className="text-right">Plc</div>
        <div className="text-right">Show</div>
        <div className="text-right">Edge</div>
      </div>
      {horses.map((h) => {
        const edgeColor = h.isOverlay
          ? "text-emerald-400"
          : h.overlay >= 1.05
            ? "text-emerald-300/70"
            : h.overlay >= 0.85
              ? "text-gray-400"
              : "text-rose-400/80";
        const rowBg = h.isOverlay ? "bg-emerald-950/40" : h.rank === 1 ? "bg-amber-950/30" : "";
        return (
          <div
            key={h.program}
            className={`grid grid-cols-[28px_1fr_42px_44px_44px_44px_56px] gap-1 px-2 py-1 text-xs font-mono items-center border-b border-gray-900 last:border-0 ${rowBg}`}
          >
            <div className="font-black text-white">#{h.program}</div>
            <div className="truncate">
              <span className="text-gray-200">{h.name}</span>
              <span className="text-gray-600 ml-1 text-[10px]">{h.style}</span>
              {h.isOverlay && <span className="ml-1 text-[9px] font-bold text-emerald-400">★</span>}
              {h.rank === 1 && !h.isOverlay && <span className="ml-1 text-[9px] font-bold text-amber-400">TOP</span>}
            </div>
            <div className="text-right text-gray-400">{h.mlOdds.toFixed(1)}</div>
            <div className="text-right text-white font-bold">{h.modelWinPct.toFixed(0)}%</div>
            <div className="text-right text-gray-300">{h.modelPlacePct.toFixed(0)}%</div>
            <div className="text-right text-gray-400">{h.modelShowPct.toFixed(0)}%</div>
            <div className={`text-right font-bold ${edgeColor}`}>{(h.overlay).toFixed(2)}×</div>
          </div>
        );
      })}
      <div className="px-2 py-1 text-[10px] text-gray-500 border-t border-gray-800">
        ★ = model overlay (undervalued vs ML — bet candidate). TOP = highest model win.
      </div>
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

