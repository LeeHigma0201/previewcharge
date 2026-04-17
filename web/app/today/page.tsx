"use client";

import { useEffect, useMemo, useState } from "react";

type Cell = string | number | null | { prompt: string };

interface Horse {
  race_number: number;
  program_number?: string;
  pp?: number;
  horse_name?: string;
  sire?: string;
  dam?: string;
  age?: number | null;
  sex?: string;
  jockey?: string;
  trainer?: string;
  morning_line_odds_raw?: string;
  ml_odds_decimal?: number;
  ml_implied_prob?: Cell;

  best_beyer?: Cell;
  avg_beyer?: Cell;
  last_beyer?: Cell;
  beyer_trend?: Cell;

  days_since_last?: Cell;
  win_rate_last_5?: Cell;
  top3_rate_last_5?: Cell;

  jockey_win_pct?: Cell;
  jockey_top3_pct?: Cell;
  jockey_starts?: Cell;
  trainer_win_pct?: Cell;
  trainer_top3_pct?: Cell;
  trainer_starts?: Cell;

  n_pps_fetched?: number;
  unresolved_specs?: string;
  [k: string]: Cell | number | undefined;
}

interface RaceBlock {
  race: {
    race_number: number;
    post_time?: string;
    distance?: string;
    surface?: string;
    race_type?: string;
    purse?: number | string | null;
  };
  horses: Horse[];
}

interface CardDoc {
  track_code: string;
  race_date: string;
  generated_at: string;
  races: RaceBlock[];
}

function numOrNull(v: Cell | number | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fmt(v: Cell | number | undefined, digits = 2): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object" && "prompt" in v) return "…";
  const n = numOrNull(v);
  if (n === null) return String(v);
  return n.toFixed(digits);
}

function pct(v: Cell | number | undefined): string {
  const n = numOrNull(v);
  if (n === null) return "—";
  return `${(n * 100).toFixed(0)}%`;
}

// Rank within race for a numeric cell; undefined rank if prompt or null.
function rank(
  horses: Horse[],
  key: keyof Horse,
  ascending = false,
): Map<number, number> {
  const values: { pp: number; v: number }[] = [];
  for (const h of horses) {
    const n = numOrNull(h[key] as Cell | undefined);
    if (n !== null && h.pp !== undefined) {
      values.push({ pp: h.pp, v: n });
    }
  }
  values.sort((a, b) => (ascending ? a.v - b.v : b.v - a.v));
  const out = new Map<number, number>();
  values.forEach((row, i) => out.set(row.pp, i + 1));
  return out;
}

function RaceCard({ block }: { block: RaceBlock }) {
  const { race, horses } = block;
  const beyerRank = useMemo(() => rank(horses, "best_beyer"), [horses]);
  const jockeyRank = useMemo(() => rank(horses, "jockey_win_pct"), [horses]);
  const trainerRank = useMemo(() => rank(horses, "trainer_win_pct"), [horses]);

  return (
    <section className="border border-gray-800 rounded-lg overflow-hidden bg-[#0a0a0a]">
      <header className="px-4 py-3 border-b border-gray-800 flex items-baseline justify-between bg-[#111]">
        <div>
          <span className="text-xl font-bold text-white">Race {race.race_number}</span>
          <span className="ml-3 text-sm text-gray-400">
            {race.distance} {race.surface} · {race.race_type} · ${race.purse?.toLocaleString?.() ?? race.purse}
          </span>
        </div>
        <span className="text-sm text-gray-500">{race.post_time}</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-gray-400 bg-[#0d0d0d]">
            <tr>
              <th className="px-2 py-2 text-left">PP</th>
              <th className="px-2 py-2 text-left">Horse</th>
              <th className="px-2 py-2 text-left">Sire</th>
              <th className="px-2 py-2 text-left">Age</th>
              <th className="px-2 py-2 text-left">Jockey / Trainer</th>
              <th className="px-2 py-2 text-right">ML</th>
              <th className="px-2 py-2 text-right" title="Best Beyer z-score in field">Beyer z</th>
              <th className="px-2 py-2 text-right" title="Most recent Beyer figure">Last</th>
              <th className="px-2 py-2 text-right" title="Avg Beyer z-score">Avg</th>
              <th className="px-2 py-2 text-right" title="Beyer slope: positive = improving">Trend</th>
              <th className="px-2 py-2 text-right" title="Days since last start">DSL</th>
              <th className="px-2 py-2 text-right" title="Win rate (last 5)">W5</th>
              <th className="px-2 py-2 text-right" title="Top 3 rate (last 5)">T5</th>
              <th className="px-2 py-2 text-right" title="Jockey meet win %">J Win%</th>
              <th className="px-2 py-2 text-right" title="Trainer meet win %">T Win%</th>
              <th className="px-2 py-2 text-left" title="Unresolved fetch prompts">Gaps</th>
            </tr>
          </thead>
          <tbody>
            {horses.map((h) => {
              const bRank = h.pp !== undefined ? beyerRank.get(h.pp) : undefined;
              const jRank = h.pp !== undefined ? jockeyRank.get(h.pp) : undefined;
              const tRank = h.pp !== undefined ? trainerRank.get(h.pp) : undefined;
              return (
                <tr key={h.pp ?? h.program_number} className="border-t border-gray-900 hover:bg-[#141414]">
                  <td className="px-2 py-2 font-mono text-gray-300">{h.program_number ?? h.pp}</td>
                  <td className="px-2 py-2 font-semibold text-white whitespace-nowrap">
                    {h.horse_name}
                  </td>
                  <td className="px-2 py-2 text-gray-400 whitespace-nowrap">{h.sire || "—"}</td>
                  <td className="px-2 py-2 text-gray-400">
                    {h.age ?? "—"}{h.sex ? ` ${h.sex}` : ""}
                  </td>
                  <td className="px-2 py-2 text-gray-300 whitespace-nowrap">
                    <div>{h.jockey || "—"}</div>
                    <div className="text-xs text-gray-500">{h.trainer || "—"}</div>
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-gray-200">
                    {h.morning_line_odds_raw}
                  </td>
                  <td
                    className={`px-2 py-2 text-right font-mono ${bRank === 1 ? "text-emerald-400 font-bold" : "text-gray-200"}`}
                    title={bRank ? `Rank ${bRank} of field` : undefined}
                  >
                    {fmt(h.best_beyer)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-gray-300">{fmt(h.last_beyer)}</td>
                  <td className="px-2 py-2 text-right font-mono text-gray-300">{fmt(h.avg_beyer)}</td>
                  <td className="px-2 py-2 text-right font-mono text-gray-300">{fmt(h.beyer_trend)}</td>
                  <td className="px-2 py-2 text-right font-mono text-gray-300">{fmt(h.days_since_last, 1)}</td>
                  <td className="px-2 py-2 text-right font-mono text-gray-300">{fmt(h.win_rate_last_5)}</td>
                  <td className="px-2 py-2 text-right font-mono text-gray-300">{fmt(h.top3_rate_last_5)}</td>
                  <td
                    className={`px-2 py-2 text-right font-mono ${jRank === 1 ? "text-emerald-400 font-bold" : "text-gray-300"}`}
                  >
                    {fmt(h.jockey_win_pct)}
                  </td>
                  <td
                    className={`px-2 py-2 text-right font-mono ${tRank === 1 ? "text-emerald-400 font-bold" : "text-gray-300"}`}
                  >
                    {fmt(h.trainer_win_pct)}
                  </td>
                  <td className="px-2 py-2 text-xs text-amber-500">
                    {h.unresolved_specs ? h.unresolved_specs.split(",").length : 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function TodayPage() {
  const [doc, setDoc] = useState<CardDoc | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/preview?track=KEE&date=2026-04-17")
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(j))))
      .then((d: CardDoc) => setDoc(d))
      .catch((e) => setErr(String(e.error || e.detail || e)));
  }, []);

  if (err) {
    return (
      <main className="min-h-screen bg-black text-white p-8">
        <h1 className="text-2xl font-bold">Error loading preview</h1>
        <pre className="mt-4 text-sm text-red-400">{err}</pre>
      </main>
    );
  }
  if (!doc) {
    return (
      <main className="min-h-screen bg-black text-gray-400 p-8">
        Loading Keeneland preview…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {doc.track_code} · {doc.race_date}
          </h1>
          <p className="text-gray-400 text-sm">
            {doc.races.length} races · feature matrix z-scored within field · green = best in race
          </p>
        </div>
        <p className="text-xs text-gray-600">
          generated {new Date(doc.generated_at).toLocaleString()}
        </p>
      </header>
      <div className="space-y-6">
        {doc.races.map((b) => (
          <RaceCard key={b.race.race_number} block={b} />
        ))}
      </div>
      <footer className="pt-8 pb-4 text-center text-xs text-gray-600">
        HorseGPT v3.14 · Benter logistic + Monte Carlo exotic pricing · numbers are z-scores within each race field
      </footer>
    </main>
  );
}
