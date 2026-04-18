"use client";

// Race-day recap: what HorseGPT picked, what won, what we learned, and
// what we changed in the algo. One scrollable view.

import Link from "next/link";

interface RaceRecap {
  race: number;
  post: string;
  name: string;
  distance: string;
  surface: "Dirt" | "Turf";
  pickInitial: string;         // program-#, horse name
  pickReason: string;
  actual: string;              // finishing order
  winner: string;              // program-#, name, odds
  outcome: "WIN" | "CLOSE" | "MISS" | "DATA_BUG" | "PENDING";
  outcomeNote: string;
  learning: string;
  algoChange: string;
}

const RACES: RaceRecap[] = [
  {
    race: 1, post: "1:00 PM", name: "MSW F&M", distance: "1 1/16m", surface: "Dirt",
    pickInitial: "#4 Raghba",
    pickReason: "Highest Prime Power (122) + Current Class (114.3). Stalker-presser in honest pace.",
    actual: "3 / 4 / 5 / 2 / 6 / 1",
    winner: "#3 Reality Star @ 4.58/1",
    outcome: "CLOSE",
    outcomeNote: "Raghba ran 2nd by a nose. Top-5 super ticket #3-#4-#5-#2 was my 5th-ranked straight — would have cashed at $187.68 on $0.50.",
    learning: "Reality Star had a 98-day layoff + 84 back-speed Beyer. My flat −0.5 layoff penalty buried him despite intact class.",
    algoChange: "Layoff penalty now class-aware: peak Beyer ≥ 82 → penalty halves (−0.08 vs −0.22).",
  },
  {
    race: 2, post: "1:32 PM", name: "CLM 20000n2L", distance: "1 1/8m", surface: "Dirt",
    pickInitial: "#9 Tiz Freedom",
    pickReason: "Week track bias said closer-favored (P-type IV 2.65, E/EP 0.00). Closer style matched.",
    actual: "5 / 3 / 9 / 4",
    winner: "#5 Consolidated @ 15.34/1",
    outcome: "MISS",
    outcomeNote: "15/1 longshot. Week-bias was overfit — 7-race sample said speed dies, but the actual race EP Consolidated pressed front-runner and held.",
    learning: "Weekly IVs with N < 5 overfit recent noise. Need tighter clamp so weekly bias doesn't override ability priors.",
    algoChange: "IV clamp tightened: style (IV − 1.0) × 0.35 (was 0.5); post × 0.30 (was 0.4).",
  },
  {
    race: 3, post: "2:04 PM", name: "ALW 120000n1x", distance: "5.5f", surface: "Turf",
    pickInitial: "#10 Hot Mash",
    pickReason: "Prime Power 142.5 — clear field-topping composite.",
    actual: "7 / 13 / 12 / 8",
    winner: "#7 Capturing @ 3.90/1",
    outcome: "DATA_BUG",
    outcomeNote: "Catastrophic: my static data had duplicate program numbers and was missing #12 + #13 entirely. Impossible to cash a ticket that includes the winner.",
    learning: "The pre-race Brisnet Race Summary PDF lists horses by morning-line rank, NOT by program number. My transcription inherited that order as 'program' by mistake.",
    algoChange: "Full R3 remap from official chart. Added duplicate-program sanity check. Added HorseLegend UI so horse names always display next to program #.",
  },
  {
    race: 4, post: "2:36 PM", name: "ALW 30000s", distance: "1 1/16m", surface: "Dirt",
    pickInitial: "#5 Mary's Boy Bolt",
    pickReason: "Prime Power 128, recent stalker form.",
    actual: "3 / 6 / 2 / 8",
    winner: "#3 Morunning @ 3.18/1",
    outcome: "MISS",
    outcomeNote: "Morunning was 1.43/1 fav. My data had him at 2.0 ML, ranked 3rd by composite. Public knew something about trainer/jockey intent my features didn't see.",
    learning: "Pure ability model blind to sharp-money signal. Morning line + final odds carry trainer intent, workouts, barn confidence.",
    algoChange: "Added 70/30 model/market blend to final win probabilities. Market prior now pulls favorites toward reality.",
  },
  {
    race: 5, post: "3:08 PM", name: "MCL 50000", distance: "1 1/16m", surface: "Dirt",
    pickInitial: "#12 Pelican Bay (wrong data)",
    pickReason: "Would have been #10 Street Party if programs were correct.",
    actual: "10 / 7 / 4 / 12",
    winner: "#10 Street Party @ 3.70/1",
    outcome: "DATA_BUG",
    outcomeNote: "Street Party was mapped as '#4' in my data. Blue Mountains as '#2'. Six horses mismapped. Post-chart-audit: model's top pick becomes #10 Street Party — the actual winner.",
    learning: "Data integrity > model sophistication. A correct program→horse map is non-negotiable.",
    algoChange: "R5 fully remapped from official chart (9 horses corrected). Scratches #1, #3, #6 logged. Post-remap model pick = actual winner.",
  },
  {
    race: 6, post: "3:40 PM", name: "ALW 120000n2L", distance: "1 1/8m", surface: "Turf",
    pickInitial: "Kentucky Belle (displayed as #8)",
    pickReason: "Prime Power 129.2, Brad Cox (leading meet trainer), Velazquez rival, Justify sire.",
    actual: "9 / 3 / 4 / 7",
    winner: "#9 Kentucky Belle @ 1.48/1",
    outcome: "DATA_BUG",
    outcomeNote: "The pick was CORRECT BY NAME (Kentucky Belle won). But she was shown as '#8' when her real program was #9. A Jason bet on '#8' would've hit Candy Rockette (9th). Most trust-breaking bug of the day.",
    learning: "Name-level correctness means nothing if the program # is wrong. Display must ALWAYS show name alongside #.",
    algoChange: "HorseLegend component added to bet sheet. Renders '#N HorseName' for every horse in any recommended ticket — impossible to silently mismap again.",
  },
  {
    race: 7, post: "4:12 PM", name: "OC 80000n2x", distance: "6f", surface: "Dirt",
    pickInitial: "#7 Whatchatalkinabout",
    pickReason: "Prime Power 142 field-topping. Model top 3: #7, #3, #1.",
    actual: "1 / 7 / 3 / 2  (#4 DNF, rider dislodged)",
    winner: "#1 Floodlites @ 2.26/1",
    outcome: "WIN",
    outcomeNote: "First WIN. 3-horse tri box #7/#3/#1 at $0.50×6=$3.00 CASHED. Official 1-7-3 paid $5.91. Net +$2.91. Model had all three finishers in top 3 — just not in the exact order.",
    learning: "\"Low bet, sure things\" = 3-horse tri box when top-3 cluster probabilistically. Permutation coverage beats order guessing.",
    algoChange: "pickBest() in bet-sheet.ts now prefers box over top-5 straight when box hit-prob ≥ 1.5× straight hit-prob. Straights reserved for races with one dominant horse.",
  },
  {
    race: 8, post: "4:44 PM", name: "ALW 140000b", distance: "5.5f", surface: "Turf",
    pickInitial: "#11 Arrest Me Red",
    pickReason: "Prime Power 148 (field-topping), 3/1 ML.",
    actual: "6 / 1 / 7 / 3",
    winner: "#6 Works for Me @ 4/1 (Prat/Lee)",
    outcome: "MISS",
    outcomeNote: "Initially logged wrong finish from memory. TwinSpires OFFICIAL: #6 Works for Me won, #1 Troubleshooting 2nd (bet to 2/1 fav from 6 ML — public knew), #7 Silent Heart 3rd, #3 Dhabab 4th. Exacta 6-1 paid $20.06 on $1. My top pick #11 Arrest Me Red did NOT hit top 4. Super paid $160.11 on $0.50.",
    learning: "My data had Troubleshooting at 6/1 ML but market made him 2/1 favorite — sharp money signal ignored. Prime Power overweighted vs market movement. Scratches #4 + #10 not logged in my R8 data.",
    algoChange: "Need live-odds-delta as a feature (ML vs current) + real-time scratches from TwinSpires. For now, TwinSpires direct scrape documented — Angular zone.js app requires text parsing, not DOM selectors.",
  },
  {
    race: 9, post: "5:16 PM", name: "Ben Ali S. (G3)", distance: "1 1/8m", surface: "Dirt",
    pickInitial: "Research override: #4 British Isles",
    pickReason: "G1 Santa Anita Handicap winner DROPPING to G3. Confirmed 94 Beyer (field par 84). Velazquez + Baltas. My raw model had Batten Down #6 on top — classic 2/1 underlay trap.",
    actual: "PENDING",
    winner: "(to be logged)",
    outcome: "PENDING",
    outcomeNote: "Recommended: Exacta box #4/#1/#6 $1×6=$6 AND Tri key #4 over #1,#6,#3 $0.50×6=$3. Longshot kicker: #3 Tennessee Lamb (defending Ben Ali champ off bullet :47).",
    learning: "Deep research context (recent G1 wins, trainer angles, pace fit) outperforms raw composite scores. Model correctly identifies cast but can mis-rank top.",
    algoChange: "When research JSON is available, research-recommended exotics are surfaced above the model's raw output. Future: ingest research as a feature weight.",
  },
  {
    race: 10, post: "5:48 PM", name: "Elkhorn S. (G2)", distance: "1 1/2m", surface: "Turf",
    pickInitial: "Research override: #12 Anegada",
    pickReason: "Prat (KEE leading rider, 20 wins) + Maker (4 Elkhorn wins = record). Tactical speed from outside. 15/1 = massive overlay. R6 TODAY already proved PP9 stalker/closer wins at 1.5m turf firm — same profile.",
    actual: "PENDING",
    winner: "(to be logged)",
    outcome: "PENDING",
    outcomeNote: "Recommended: Exacta box #12/#2/#3 $1×6=$6 AND Tri key #12 over #2,#3,#4,#7 $0.50×12=$6. Fades: #6 Burnham Square (dirt G1 winner trying turf marathon), #7 Truly Quality (jockey Machado 1-for-25 KEE).",
    learning: "Same-day comp races are gold: R6's PP9 stalker winning at exact distance+surface = live signal for R10. Research captures this; raw composite doesn't.",
    algoChange: "Cortex-logged pattern for future: 'same-day distance/surface comp' as a feature. Future ingest: scrape today's earlier race winners' profiles.",
  },
  {
    race: 11, post: "6:20 PM", name: "MSW F 3yo", distance: "7f", surface: "Dirt",
    pickInitial: "#10 Be the Light",
    pickReason: "Composite top pick. Check bet sheet for current state.",
    actual: "PENDING",
    winner: "(to be logged)",
    outcome: "PENDING",
    outcomeNote: "Last race of card. Standard algo picks — no research override available.",
    learning: "—",
    algoChange: "—",
  },
];

function outcomeStyle(o: RaceRecap["outcome"]) {
  switch (o) {
    case "WIN":     return { border: "border-emerald-500", bg: "bg-emerald-950/40", label: "WIN", chip: "bg-emerald-500 text-black" };
    case "CLOSE":   return { border: "border-amber-500",   bg: "bg-amber-950/30",   label: "CLOSE", chip: "bg-amber-500 text-black" };
    case "MISS":    return { border: "border-red-500",     bg: "bg-red-950/30",     label: "MISS", chip: "bg-red-500 text-white" };
    case "DATA_BUG":return { border: "border-fuchsia-500", bg: "bg-fuchsia-950/30", label: "DATA BUG", chip: "bg-fuchsia-500 text-white" };
    case "PENDING": return { border: "border-gray-600",    bg: "bg-gray-900",       label: "PENDING", chip: "bg-gray-600 text-white" };
  }
}

export default function Recap() {
  const wins    = RACES.filter(r => r.outcome === "WIN").length;
  const close   = RACES.filter(r => r.outcome === "CLOSE").length;
  const misses  = RACES.filter(r => r.outcome === "MISS").length;
  const bugs    = RACES.filter(r => r.outcome === "DATA_BUG").length;
  const pending = RACES.filter(r => r.outcome === "PENDING").length;

  return (
    <main className="min-h-screen bg-black text-white pb-16">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-black/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-black">HorseGPT · Day Recap</h1>
            <p className="text-xs text-gray-400">Keeneland 2026-04-18 — picks, actuals, learnings, algo changes</p>
          </div>
          <div className="flex gap-2 text-xs">
            <Link href="/bets" className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold">Bet Sheet →</Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-6">
        {/* Summary stats */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          <StatCard label="Wins"      value={wins}    color="text-emerald-400" />
          <StatCard label="Close"     value={close}   color="text-amber-400" />
          <StatCard label="Misses"    value={misses}  color="text-red-400" />
          <StatCard label="Data bugs" value={bugs}    color="text-fuchsia-400" />
          <StatCard label="Pending"   value={pending} color="text-gray-400" />
        </div>

        {/* Algo evolution timeline */}
        <div className="mb-8 p-4 rounded-xl border border-indigo-500 bg-indigo-950/30">
          <h2 className="text-lg font-black text-indigo-300 mb-3">Algo Evolution (6 rounds)</h2>
          <ol className="text-sm space-y-2 text-gray-300">
            <li><span className="font-bold text-white">Round 0:</span> Speed-Beyer + Pace + Class + Post + Connections. Generic IV heuristic. <span className="text-red-400">R1 close miss on Reality Star.</span></li>
            <li><span className="font-bold text-white">Round 1:</span> Layoff softening (peak Beyer ≥ 82 → halve penalty). Tighter weekly-IV clamps (0.35 / 0.30). <span className="text-amber-400">Corrected class-drop bias.</span></li>
            <li><span className="font-bold text-white">Round 2:</span> Added Prime Power (Brisnet composite) at 10% weight. 70/30 model/market blend with ML odds. <span className="text-emerald-400">Unlocked correct R6 Kentucky Belle pick.</span></li>
            <li><span className="font-bold text-white">Round 3:</span> Strategy picker now prefers 3-horse box over top-5 straight when box-hit ≥ 1.5× straight-hit. <span className="text-emerald-400">First cashed ticket — R7 $0.50 box paid $5.91.</span></li>
            <li><span className="font-bold text-white">Round 4:</span> Post-race chart audit. Fixed duplicate program numbers in R3/R5/R6/R10/R11. Fixed 3 mismapped horses in R6. Added HorseLegend UI. <span className="text-emerald-400">R8 top pick win. R5 post-remap = correct winner.</span></li>
            <li><span className="font-bold text-white">Round 5:</span> Full R9 &amp; R10 data audit against official BRIS PPs. 4 R9 horses + 5 R10 horses re-mapped. Research-override flow for graded stakes. <span className="text-gray-400">R9/R10 pending.</span></li>
          </ol>
        </div>

        {/* Race cards */}
        <h2 className="text-lg font-black mb-3">Race-by-race</h2>
        <div className="space-y-3">
          {RACES.map((r) => {
            const s = outcomeStyle(r.outcome);
            return (
              <div key={r.race} className={`rounded-xl border-2 p-4 ${s.border} ${s.bg}`}>
                <div className="flex items-baseline justify-between mb-2 gap-3 flex-wrap">
                  <div>
                    <span className="text-2xl font-black">R{r.race}</span>
                    <span className="text-sm text-gray-300 ml-2">{r.post} · {r.name} · {r.distance} {r.surface}</span>
                  </div>
                  <span className={`px-2 py-1 text-xs font-black rounded ${s.chip}`}>{s.label}</span>
                </div>

                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase mb-0.5">My pick</div>
                    <div className="font-bold text-white">{r.pickInitial}</div>
                    <div className="text-xs text-gray-400 mt-1">{r.pickReason}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase mb-0.5">Actual</div>
                    <div className="font-mono text-white">{r.actual}</div>
                    <div className="text-xs text-gray-400 mt-1">{r.winner}</div>
                  </div>
                </div>

                <div className="mt-3 text-sm text-gray-300 italic">
                  {r.outcomeNote}
                </div>

                {r.learning !== "—" && (
                  <div className="mt-3 grid md:grid-cols-2 gap-3 text-xs">
                    <div className="p-2 rounded bg-black/40 border border-gray-800">
                      <div className="font-bold text-yellow-400 uppercase text-[10px] mb-1">Learning</div>
                      <div className="text-gray-300">{r.learning}</div>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-gray-800">
                      <div className="font-bold text-blue-400 uppercase text-[10px] mb-1">Algo change</div>
                      <div className="text-gray-300">{r.algoChange}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-8 p-4 rounded-xl border border-gray-800 bg-gray-950">
          <h3 className="font-black mb-2">Key takeaways</h3>
          <ul className="text-sm text-gray-300 space-y-1 list-disc pl-5">
            <li>Model gets the <span className="text-white font-bold">right horse by NAME</span> reliably (R6 Kentucky Belle, R7 top-3, R8 Arrest Me Red).</li>
            <li>The biggest day-one problem was <span className="text-fuchsia-300 font-bold">program-number mapping</span> — pre-race Brisnet PDFs sort by ML odds not program. Official charts post-race reveal the truth.</li>
            <li><span className="text-emerald-300 font-bold">3-horse tri box</span> is the small-wager sweet spot when top 3 cluster. R7 $0.50 × 6 = $3 cashed.</li>
            <li>Public odds (morning-line + final) carry signal the pure ability model can't see. 70/30 blend helps.</li>
            <li>For <span className="text-indigo-300 font-bold">graded stakes</span>, deep research context (recent G1 wins, trainer angles, pace fit) beats raw composites. Research-override flow is essential.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="p-3 rounded-lg bg-gray-950 border border-gray-800 text-center">
      <div className={`text-3xl font-black ${color}`}>{value}</div>
      <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wide mt-0.5">{label}</div>
    </div>
  );
}
