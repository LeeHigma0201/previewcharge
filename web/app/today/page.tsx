import picks from "../lib/cd-2026-05-02-picks.json";
import Link from "next/link";

interface Horse {
  rank: number;
  program: string;
  name: string;
  jockey: string;
  trainer: string;
  mlOdds: number | null;
  style: string;
  primePower: number | null;
  beyer: number | null;
  scorePct: number;
  isTopPick: boolean;
}
interface Race {
  raceNumber: number;
  horses: Horse[];
  edgeTier: string;
  algoTop2: string;
  mktTop2: string;
  play: string;
  ticket: string;
  cost: number;
  rationale?: string;
}
interface V2Combo {
  win: string;
  place: string;
  show: string;
  p: number;
  fairPayout: number;
  marketPayout: number | null;
  edge: number;
  isOverlay: boolean;
}
interface V2Rec {
  raceNumber: number;
  edgeTierV1: string;
  edgeTierV2: string;
  play: string;
  structure: string;
  ticket: string;
  cost: number;
  rationale: string;
  filters: string[];
  topTrifectas: V2Combo[];
}

const TIER_BADGE: Record<string, { label: string; cls: string }> = {
  FULL_EDGE: { label: "FULL EDGE", cls: "bg-emerald-600 text-white" },
  PARTIAL_EDGE: { label: "PARTIAL EDGE", cls: "bg-amber-500 text-black" },
  CHALK_MATCH: { label: "CHALK MATCH (PASS)", cls: "bg-zinc-700 text-zinc-300" },
};

export default function TodayPage() {
  const races = picks.races as Race[];
  const tierCounts = races.reduce((acc, r) => {
    acc[r.edgeTier] = (acc[r.edgeTier] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const totalCost = races.reduce((s, r) => s + (r.cost || 0), 0);

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 space-y-6">
      <header className="border-b border-zinc-800 pb-4">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Churchill Downs · {picks.date}</h1>
            <p className="text-sm text-zinc-400 mt-1">Kentucky Derby 152 · 14 races · {tierCounts.PARTIAL_EDGE ?? 0} bettable, {tierCounts.CHALK_MATCH ?? 0} pass</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-zinc-400">Total recommended outlay</div>
            <div className="text-2xl font-bold text-emerald-400">${totalCost.toFixed(2)}</div>
          </div>
        </div>
        <div className="mt-3 flex gap-2 text-xs">
          <Link href="/bets" className="px-3 py-1.5 rounded bg-emerald-600 text-white font-bold hover:bg-emerald-500">Bet Sheet →</Link>
          <Link href="/" className="px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Home</Link>
        </div>
        <div className="mt-3 text-xs text-zinc-500 leading-relaxed max-w-3xl">
          Strict-mode picks. The algo PASSES on CHALK MATCH races (algo top-2 = market top-2) — paying 22% takeout
          for a market-supported box is negative-EV per the chalk-overlap audit (Apr 25 + Apr 30, n=18 races).
        </div>
      </header>

      <div className="space-y-3">
        {races.map((r) => {
          const tier = TIER_BADGE[r.edgeTier] ?? { label: r.edgeTier, cls: "bg-zinc-700 text-zinc-300" };
          const top5 = r.horses.slice(0, 5);
          const isPass = r.edgeTier === "CHALK_MATCH" || r.cost === 0;
          return (
            <section key={r.raceNumber} className={`border rounded-lg ${isPass ? "border-zinc-800 bg-zinc-950" : "border-emerald-700/50 bg-emerald-950/20"}`}>
              <header className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black">R{r.raceNumber}</span>
                  <span className={`text-[10px] font-black tracking-wider px-2 py-0.5 rounded ${tier.cls}`}>{tier.label}</span>
                  <span className="text-xs text-zinc-500">algo top-2: {r.algoTop2} · mkt top-2: {r.mktTop2}</span>
                </div>
                {!isPass && r.ticket && (
                  <div className="text-xs">
                    <span className="text-zinc-400">Play: </span>
                    <span className="font-mono font-bold text-emerald-300">{r.ticket}</span>
                    <span className="text-zinc-400"> · ${r.cost.toFixed(2)}</span>
                  </div>
                )}
              </header>
              <div className="border-t border-zinc-900 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase text-zinc-500">
                    <tr className="bg-zinc-900/50">
                      <th className="px-3 py-1.5 text-left">Rank</th>
                      <th className="px-3 py-1.5 text-left">#</th>
                      <th className="px-3 py-1.5 text-left">Horse</th>
                      <th className="px-3 py-1.5 text-left">Jockey / Trainer</th>
                      <th className="px-3 py-1.5 text-right">ML</th>
                      <th className="px-3 py-1.5 text-right">Style</th>
                      <th className="px-3 py-1.5 text-right">PP</th>
                      <th className="px-3 py-1.5 text-right">Beyer</th>
                      <th className="px-3 py-1.5 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top5.map((h) => (
                      <tr key={h.program} className={`border-t border-zinc-900 ${h.rank === 1 ? "bg-emerald-900/20" : ""}`}>
                        <td className="px-3 py-1.5 text-zinc-500 font-mono">{h.rank}</td>
                        <td className="px-3 py-1.5 font-mono font-bold">{h.program}</td>
                        <td className="px-3 py-1.5 font-semibold">{h.name}</td>
                        <td className="px-3 py-1.5 text-zinc-400">{h.jockey} / {h.trainer}</td>
                        <td className="px-3 py-1.5 font-mono text-right">{h.mlOdds ?? "—"}</td>
                        <td className="px-3 py-1.5 font-mono text-right text-zinc-400">{h.style}</td>
                        <td className="px-3 py-1.5 font-mono text-right">{h.primePower?.toFixed(1) ?? "—"}</td>
                        <td className="px-3 py-1.5 font-mono text-right">{h.beyer ?? "—"}</td>
                        <td className={`px-3 py-1.5 font-mono text-right ${h.rank === 1 ? "text-emerald-400 font-bold" : "text-zinc-300"}`}>{h.scorePct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      <section className="border border-amber-700/40 rounded-lg bg-amber-950/10 p-5 mt-8">
        <header className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
          <h2 className="text-2xl font-black text-amber-400">Exotic v2 — Henery-corrected</h2>
          <div className="text-sm text-zinc-400">
            Total: <span className="text-amber-300 font-bold">${(picks.exoticV2Total ?? 0).toFixed(2)}</span>
          </div>
        </header>
        <p className="text-xs text-zinc-500 leading-relaxed mb-4 max-w-3xl">
          Drop-in replacement for Harville ordering. γ=0.81 (place), δ=0.65 (show) — Lo &amp; Bacon-Shone (2008).
          Harville systematically overstates favorites in 2nd/3rd; this fix matters in trifectas/superfectas.
          Recipes: forward exacta on partial edge (don't pay box premium for the public-supported leg);
          Derby super part-wheel (chaos pool, small unit, wide coverage).
        </p>
        <div className="space-y-2">
          {((picks.exoticV2 ?? []) as V2Rec[]).filter((r) => r.play === "BET").map((r) => (
            <div key={r.raceNumber} className="border border-amber-700/30 rounded p-3 bg-black/40">
              <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-lg">R{r.raceNumber}</span>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-700/30 text-amber-200">{r.edgeTierV2}</span>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">{r.structure}</span>
                </div>
                <span className="text-amber-300 font-mono font-bold">${r.cost.toFixed(2)}</span>
              </div>
              <div className="font-mono text-xs text-emerald-300 mb-1">{r.ticket}</div>
              <div className="text-[11px] text-zinc-500">{r.rationale}</div>
              {r.filters.length > 0 && (
                <div className="text-[11px] text-amber-400/80 mt-1">Flags: {r.filters.join(" · ")}</div>
              )}
              {r.topTrifectas.length > 0 && (
                <details className="mt-2 text-[11px] text-zinc-400">
                  <summary className="cursor-pointer hover:text-amber-300">Top trifecta combos (Henery)</summary>
                  <table className="w-full mt-2 text-[11px]">
                    <thead className="text-zinc-500">
                      <tr><th className="text-left">Combo</th><th className="text-right">P(combo)</th><th className="text-right">Fair $</th><th className="text-right">Mkt $</th><th className="text-right">Edge</th></tr>
                    </thead>
                    <tbody>
                      {r.topTrifectas.map((c, i) => (
                        <tr key={i} className={c.isOverlay ? "text-emerald-300" : ""}>
                          <td className="font-mono">{c.win}-{c.place}-{c.show}</td>
                          <td className="text-right font-mono">{(c.p * 100).toFixed(2)}%</td>
                          <td className="text-right font-mono">${c.fairPayout.toFixed(0)}</td>
                          <td className="text-right font-mono">{c.marketPayout ? `$${c.marketPayout.toFixed(0)}` : "—"}</td>
                          <td className="text-right font-mono">{(c.edge * 100).toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          ))}
        </div>
      </section>

      <footer className="pt-8 pb-4 text-center text-xs text-zinc-600">
        HorseGPT v3.14 · strict mode · chalk-overlap audited · Henery exotic v2 · DeepSeek + Kimi review applied
      </footer>
    </main>
  );
}
