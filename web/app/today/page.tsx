import picks from "../lib/cd-2026-05-02-picks.json";
import Link from "next/link";

interface PositionProb {
  program: string;
  name: string;
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  itm: number;
  mlOdds: number | null;
}
interface V3Play {
  structure: string;
  ticket: string;
  cost: number;
  rationale: string;
  confidence: string;
}
interface V3Angle {
  code: string;
  horseProgram: string | null;
  description: string;
  sourceField: string;
}
interface V3Race {
  raceNumber: number;
  fieldSize: number;
  edgeTier: string;
  isDerby: boolean;
  confidence: string;
  totalCost: number;
  plays: V3Play[];
  angles: V3Angle[];
  positionProbs: PositionProb[];
}
interface PickChain {
  type: string;
  races: number[];
  single_leg: number;
  tickets: string;
  combos: number;
  unit: number;
  cost: number;
}
interface BiasRow {
  program: string;
  name: string;
  total: number;
  flag: string;
  rationale: string[];
  mlOdds: number | null;
  colorScore: number;
  storyScore: number;
  trainerStarScore: number;
  jockeyStarScore: number;
  consensusTrap: boolean;
}
interface SmartDerbySuper {
  structure: string;
  keys_pos1: string;
  keys_pos2_4: string;
  ticket: string;
  cost: number;
  rationale: string;
  traps_faded: string[];
  overlays_used: string[];
}
interface SmartDerbyPlace {
  structure: string;
  horse: string;
  ticket: string;
  cost: number;
  rationale: string;
}

const TIER_BADGE: Record<string, string> = {
  FULL_EDGE: "bg-emerald-600 text-white",
  PARTIAL_EDGE: "bg-amber-500 text-black",
  CHALK_MATCH: "bg-zinc-700 text-zinc-300",
};
const CONFIDENCE_BADGE: Record<string, string> = {
  HIGH: "bg-emerald-700 text-emerald-100",
  MEDIUM: "bg-amber-700 text-amber-100",
  LOW: "bg-zinc-800 text-zinc-400",
};
const ANGLE_COLOR: Record<string, string> = {
  LONE_SPEED: "text-amber-400",
  SPEED_DUEL: "text-rose-400",
  OVERLAY_CLOSER: "text-emerald-400",
  PP_OVERLAY: "text-emerald-400",
  TOP_LAYOFF: "text-rose-400",
};

export default function TodayPage() {
  const v3 = (picks.exoticV3 ?? []) as V3Race[];
  const chains = (picks.exoticV3Chains ?? []) as PickChain[];
  const totalV3 = picks.exoticV3Total ?? 0;
  const totalChains = chains.reduce((s, c) => s + c.cost, 0);
  const bettable = v3.filter((r) => r.totalCost > 0).length;
  const bias = (picks.publicBias ?? {}) as Record<string, BiasRow[]>;
  const smartDerby = picks.smartDerby as { super: SmartDerbySuper; place: SmartDerbyPlace; totalCost: number } | undefined;

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 space-y-6">
      <header className="border-b border-zinc-800 pb-4">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Churchill Downs · {picks.date}</h1>
            <p className="text-sm text-zinc-400 mt-1">Kentucky Derby 152 · 14 races · Exotic v3 (Henery + angles + saver tickets)</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500 uppercase tracking-wider">v3 race plays / chains</div>
            <div className="text-2xl font-black text-emerald-400">${totalV3.toFixed(2)} <span className="text-zinc-500 text-base font-normal">+ ${totalChains.toFixed(2)}</span></div>
            <div className="text-[10px] text-zinc-500">{bettable}/14 races bettable</div>
          </div>
        </div>
        <div className="mt-3 flex gap-2 text-xs flex-wrap">
          <Link href="/bets" className="px-3 py-1.5 rounded bg-emerald-600 text-white font-bold hover:bg-emerald-500">Bet Sheet →</Link>
          <Link href="/" className="px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Home</Link>
        </div>
        <p className="mt-3 text-xs text-zinc-500 leading-relaxed max-w-3xl">
          Position probabilities P(1st)…P(4th) computed per horse via Henery (γ=0.81 / δ=0.65 / ε=0.55) — Lo &amp; Bacon-Shone (2008).
          Every race gets at least a saver ticket. Angles are PP-grounded only — each cites the source PP field, no hallucinated stats.
        </p>
      </header>

      {smartDerby && (
        <section className="border-2 border-emerald-400 rounded-lg bg-gradient-to-br from-emerald-950/40 to-black p-5">
          <header className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
            <div>
              <h2 className="text-3xl font-black text-emerald-300">SMART DERBY — Anti-Public Strategy</h2>
              <p className="text-xs text-zinc-400">R12 Kentucky Derby 152 · structured to fade public-money traps + key under-bet overlays</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-zinc-500">Total smart-Derby outlay</div>
              <div className="text-2xl font-black text-emerald-400">${smartDerby.totalCost.toFixed(2)}</div>
            </div>
          </header>
          <div className="space-y-3 mt-3">
            <div className="border border-emerald-700/40 rounded p-3 bg-black/40">
              <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
                <span className="text-sm font-bold text-emerald-300">{smartDerby.super.structure}</span>
                <span className="font-mono font-bold text-emerald-400">${smartDerby.super.cost.toFixed(2)}</span>
              </div>
              <div className="font-mono text-sm text-emerald-300 break-all mb-2">{smartDerby.super.ticket}</div>
              <p className="text-xs text-zinc-400 leading-relaxed mb-1">{smartDerby.super.rationale}</p>
              <div className="text-[11px] mt-2 flex gap-4 flex-wrap">
                <span className="text-rose-400">Faded (traps): #{smartDerby.super.traps_faded.join(", #")}</span>
                <span className="text-emerald-400">Keyed (overlays): #{smartDerby.super.overlays_used.join(", #")}</span>
              </div>
            </div>
            {smartDerby.place && (
              <div className="border border-emerald-700/40 rounded p-3 bg-black/40">
                <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
                  <span className="text-sm font-bold text-emerald-300">{smartDerby.place.structure}: {smartDerby.place.horse}</span>
                  <span className="font-mono font-bold text-emerald-400">${smartDerby.place.cost.toFixed(2)}</span>
                </div>
                <div className="font-mono text-sm text-emerald-300 mb-2">{smartDerby.place.ticket}</div>
                <p className="text-xs text-zinc-400 leading-relaxed">{smartDerby.place.rationale}</p>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="space-y-3">
        {v3.map((r) => {
          const tier = TIER_BADGE[r.edgeTier] ?? "bg-zinc-700 text-zinc-300";
          const conf = CONFIDENCE_BADGE[r.confidence] ?? "bg-zinc-800";
          const isDerby = r.isDerby;
          return (
            <article key={r.raceNumber} className={`border rounded-lg ${isDerby ? "border-emerald-500 bg-emerald-950/30" : r.totalCost > 5 ? "border-amber-700/40 bg-amber-950/10" : "border-zinc-800 bg-zinc-950"}`}>
              <header className="px-4 py-3 flex items-center justify-between gap-2 flex-wrap border-b border-zinc-900">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-2xl font-black">R{r.raceNumber}</span>
                  {isDerby && <span className="text-[10px] font-black tracking-wider px-2 py-0.5 rounded bg-emerald-500 text-black">DERBY 152</span>}
                  <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${tier}`}>{r.edgeTier}</span>
                  <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${conf}`}>{r.confidence}</span>
                  <span className="text-xs text-zinc-500">{r.fieldSize} runners</span>
                </div>
                <span className="text-emerald-300 font-mono font-bold text-lg">${r.totalCost.toFixed(2)}</span>
              </header>

              {bias[String(r.raceNumber)] && bias[String(r.raceNumber)].some((b) => b.flag) && (
                <div className="px-4 py-2 border-b border-zinc-900 bg-black/40">
                  <div className="text-[10px] uppercase text-zinc-500 mb-1">Public-money flags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {bias[String(r.raceNumber)].filter((b) => b.flag).map((b) => {
                      const cls =
                        b.flag === "PUBLIC_TRAP"
                          ? "bg-rose-700/40 text-rose-300 border border-rose-700/40"
                          : b.flag === "PUBLIC_OVERLAY"
                          ? "bg-emerald-700/30 text-emerald-300 border border-emerald-700/40"
                          : "bg-amber-700/30 text-amber-300 border border-amber-700/40";
                      return (
                        <span key={b.program} className={`text-[10px] px-2 py-0.5 rounded ${cls}`} title={b.rationale.join(" · ")}>
                          {b.flag === "PUBLIC_TRAP" ? "FADE" : b.flag === "PUBLIC_OVERLAY" ? "KEY" : "TRAP"} #{b.program} {b.name} ({b.mlOdds ?? "—"}/1) [score {b.total}]
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {r.angles.length > 0 && (
                <div className="px-4 py-2 border-b border-zinc-900 bg-black/40">
                  <div className="text-[10px] uppercase text-zinc-500 mb-1">Angles (PP-cited)</div>
                  <ul className="space-y-0.5">
                    {r.angles.map((a, i) => (
                      <li key={i} className={`text-xs ${ANGLE_COLOR[a.code] ?? "text-zinc-300"}`}>
                        <span className="font-mono text-[10px] mr-1">[{a.code}]</span>
                        {a.description} <span className="text-zinc-600 text-[10px]">[{a.sourceField}]</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="px-4 py-3 border-b border-zinc-900">
                <div className="text-[10px] uppercase text-zinc-500 mb-2">Position probabilities (top {Math.min(r.positionProbs.length, 8)})</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-[10px] uppercase text-zinc-500">
                      <tr>
                        <th className="px-2 py-1 text-left">#</th>
                        <th className="px-2 py-1 text-left">Horse</th>
                        <th className="px-2 py-1 text-right">ML</th>
                        <th className="px-2 py-1 text-right">P(1st)</th>
                        <th className="px-2 py-1 text-right">P(2nd)</th>
                        <th className="px-2 py-1 text-right">P(3rd)</th>
                        <th className="px-2 py-1 text-right">P(4th)</th>
                        <th className="px-2 py-1 text-right">ITM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.positionProbs.map((h, i) => (
                        <tr key={h.program} className={`border-t border-zinc-900 ${i === 0 ? "bg-emerald-900/15" : ""}`}>
                          <td className="px-2 py-1 font-mono font-bold">{h.program}</td>
                          <td className="px-2 py-1 font-semibold">{h.name}</td>
                          <td className="px-2 py-1 text-right font-mono text-zinc-400">{h.mlOdds ? `${h.mlOdds.toFixed(1)}` : "—"}</td>
                          <td className={`px-2 py-1 text-right font-mono ${i === 0 ? "text-emerald-400 font-bold" : ""}`}>{(h.p1 * 100).toFixed(1)}%</td>
                          <td className="px-2 py-1 text-right font-mono text-zinc-300">{(h.p2 * 100).toFixed(1)}%</td>
                          <td className="px-2 py-1 text-right font-mono text-zinc-300">{(h.p3 * 100).toFixed(1)}%</td>
                          <td className="px-2 py-1 text-right font-mono text-zinc-400">{(h.p4 * 100).toFixed(1)}%</td>
                          <td className="px-2 py-1 text-right font-mono text-amber-300">{(h.itm * 100).toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="px-4 py-3">
                <div className="text-[10px] uppercase text-zinc-500 mb-2">Plays</div>
                <div className="space-y-2">
                  {r.plays.map((p, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 p-2 rounded bg-black/40 border border-zinc-900">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-zinc-300">{p.structure}</span>
                          <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded ${CONFIDENCE_BADGE[p.confidence] ?? "bg-zinc-800"}`}>{p.confidence}</span>
                        </div>
                        <div className="font-mono text-xs text-emerald-300 mt-1 break-all">{p.ticket || "—"}</div>
                        <div className="text-[11px] text-zinc-500 mt-1">{p.rationale}</div>
                      </div>
                      <div className="text-emerald-300 font-mono font-bold text-sm shrink-0">${p.cost.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {chains.length > 0 && (
        <section className="border border-emerald-700/30 rounded-lg bg-emerald-950/10 p-5">
          <h2 className="text-2xl font-black text-emerald-400 mb-1">Multi-race chains</h2>
          <p className="text-xs text-zinc-500 mb-4">Single your highest-confidence leg, spread the rest. Pick-N pools are takeout-friendly when your single hits.</p>
          <div className="grid md:grid-cols-2 gap-3">
            {chains.map((c, i) => (
              <div key={i} className="border border-emerald-700/30 rounded p-3 bg-black/40">
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-bold">{c.type.toUpperCase()} R{c.races[0]}–R{c.races[c.races.length - 1]}</div>
                  <div className="text-emerald-300 font-mono font-bold">${c.cost.toFixed(2)}</div>
                </div>
                <div className="text-[11px] text-zinc-500 mb-1">Single leg: R{c.single_leg} · {c.combos} combos × ${c.unit.toFixed(2)}</div>
                <div className="font-mono text-xs text-emerald-300 break-all">{c.tickets}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="pt-8 pb-4 text-center text-xs text-zinc-600">
        HorseGPT v3.14 · Exotic v3 · Henery position probs · PP-grounded angles · DeepSeek + Kimi adversarial review
      </footer>
    </main>
  );
}
