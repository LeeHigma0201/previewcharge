import Link from "next/link";
import picks from "./lib/cd-2026-05-02-picks.json";

export default function Home() {
  const races = picks.races as { edgeTier: string; cost: number }[];
  const tierCounts = races.reduce((acc, r) => {
    acc[r.edgeTier] = (acc[r.edgeTier] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const totalCost = races.reduce((s, r) => s + (r.cost || 0), 0);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-8">
        <div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight">HorseGPT</h1>
          <p className="text-lg text-zinc-400 mt-2">Honest exotic-betting algo for Churchill Downs.</p>
        </div>

        <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-950">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Today · Kentucky Derby 152</div>
          <div className="text-2xl font-black mb-4">{picks.date} · {races.length} races</div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <Tile label="Bettable" value={String((tierCounts.FULL_EDGE ?? 0) + (tierCounts.PARTIAL_EDGE ?? 0))} accent="emerald" />
            <Tile label="Pass (chalk)" value={String(tierCounts.CHALK_MATCH ?? 0)} accent="zinc" />
            <Tile label="Outlay" value={`$${totalCost.toFixed(2)}`} accent="amber" />
          </div>
          <div className="flex gap-3">
            <Link href="/today" className="flex-1 text-center px-4 py-3 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold">Today's Card →</Link>
            <Link href="/bets" className="flex-1 text-center px-4 py-3 rounded bg-zinc-800 hover:bg-zinc-700 text-white font-bold">Bet Sheet →</Link>
          </div>
        </div>

        <div className="text-xs text-zinc-500 leading-relaxed space-y-2">
          <p>
            <span className="font-bold text-zinc-400">Strict mode.</span> The algo PASSES on races where its top-2 picks
            match the market's top-2 (no demonstrable ordering edge). Two adversarial LLM reviews and a stratified
            18-race audit confirmed the original "+222% ROI" thesis was illusion — the algo's recorded ROI equaled the
            market's recorded ROI in chalk-match races.
          </p>
          <p>
            <span className="font-bold text-zinc-400">Exotic v2 (new):</span> Henery-corrected ordering probabilities
            (γ=0.81, δ=0.65) instead of biased Harville. Edge is multiplicative across positions; one controversial
            horse + a wide super-wheel beats boxing the public favorites all day.
          </p>
          <p className="text-zinc-600 italic">
            Sources: Benter (1994), Henery (1981), Lo &amp; Bacon-Shone (2008), Crist (Exotic Betting), Ziemba (Beat the Racetrack).
          </p>
        </div>
      </div>
    </main>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent: "emerald" | "zinc" | "amber" }) {
  const accentCls =
    accent === "emerald" ? "text-emerald-400" : accent === "amber" ? "text-amber-400" : "text-zinc-300";
  return (
    <div className="border border-zinc-800 rounded p-3 bg-black">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`text-2xl font-black mt-1 ${accentCls}`}>{value}</div>
    </div>
  );
}
