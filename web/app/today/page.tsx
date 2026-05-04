// ---------- LIVE STATE — pre-Derby, focused on bet execution for non-bettors ----------
const STATE = {
  jasonBudget: 20,
  tamaraBudget: 20,
  derbyPostET: "6:57 PM ET",
  fieldSize: 19,
  scratched: ["#5", "#9", "#13", "#20", "#24"],
};

// Plain-English glossary
const glossary = [
  { term: "WIN", meaning: "Bet your horse to finish 1st place. Hits only if your horse wins." },
  { term: "PLACE", meaning: "Bet your horse to finish 1st OR 2nd. Hits if your horse is 1st or 2nd." },
  { term: "EXACTA", meaning: "Pick the 1st AND 2nd place horses in EXACT order. Hits only if both are right." },
  { term: "TRIFECTA", meaning: "Pick 1st, 2nd, AND 3rd in EXACT order. Three horses, exact order." },
  { term: "KEY BOX", meaning: "Anchor one horse to finish anywhere top 3. The other horses 'box' around it (any order). Bigger ticket, more ways to win." },
  { term: "PART WHEEL", meaning: "Pick one or more specific horses for slot 1, different ones for slot 2, etc. Cheaper than full box." },
];

// Live odds snapshot
const liveOdds = [
  { p: "#1", name: "Renegade", live: "6/1", note: "FADE — only 2 expert top picks. Worst rail post in decades." },
  { p: "#6", name: "Commandment", live: "5/1", note: "5 expert top picks. Cox barn. Real chalk." },
  { p: "#8", name: "So Happy", live: "5/1", note: "⚠️ Story money (Mike Smith oldest jock narrative). Don't key." },
  { p: "#12", name: "Chief Wallabee", live: "7/1", note: "★ OUR ANCHOR. 6 of 8 sharp DRF picks have him top 3. Bill Mott trains." },
  { p: "#15", name: "Emerging Market", live: "8/1", note: "★ OVERLAY. Bet down ML 15→8. Chad Brown / Prat. Closer setup." },
  { p: "#18", name: "Further Ado", live: "6/1", note: "RotoWire AI sim #1 (22%). Blue Grass winner." },
];

// JASON'S TICKETS — REVISED for complementary coverage with Tamara.
// Tamara has #12-anchor TR KEY BOX. Jason adds chalk-dominance TR to cover what she doesn't.
const jasonBets = [
  {
    n: 1,
    plainEnglish: "$5 to WIN on #12 Chief Wallabee",
    cost: 5,
    why: "Stacks with Tamara's $5 WIN #12 — combined $10 WIN if Chief Wallabee wins. At 7/1 returns about $40 each.",
    steps: [
      "Tap Bet Type: WIN",
      "Tap Amount: $5",
      "Tap horse #12 Chief Wallabee",
      "Confirm cost shows: $5.00",
      "Tap 'Add to Bets'",
    ],
  },
  {
    n: 2,
    plainEnglish: "$0.50 TRIFECTA — chalks (#6 or #18) win, anchor or longshot 3rd",
    cost: 4,
    why: "★ JASON-ONLY COVERAGE. Tamara's tickets miss if chalks dominate without #12 in top 3. This catches that scenario: #6 or #18 wins, the other places, and #1, #12, #15, or #11 takes 3rd.",
    steps: [
      "Tap Bet Type: TRIFECTA",
      "Tap Style: PART WHEEL (or 'WHEEL')",
      "Tap Amount: $0.50",
      "1st place slot: tap #6 and #18",
      "2nd place slot: tap #6 and #18",
      "3rd place slot: tap #1, #12, #15, #11",
      "Confirm cost shows: $4.00 (8 combos)",
      "Tap 'Add to Bets'",
    ],
  },
  {
    n: 3,
    plainEnglish: "$4 PLACE on #12 Chief Wallabee",
    cost: 4,
    why: "If #12 finishes 1st OR 2nd. Stacks with Tamara's $2 PLACE — combined $6 if he places. Returns ~$12-20.",
    steps: [
      "Tap Bet Type: PLACE",
      "Tap Amount: $4",
      "Tap horse #12 Chief Wallabee",
      "Confirm cost shows: $4.00",
      "Tap 'Add to Bets'",
    ],
  },
  {
    n: 4,
    plainEnglish: "$2 PLACE on #15 Emerging Market",
    cost: 2,
    why: "Pays $8-12 if #15 finishes top 2. Stacks with Tamara's $2 PLACE.",
    steps: [
      "Tap Bet Type: PLACE",
      "Tap Amount: $2",
      "Tap horse #15 Emerging Market",
      "Confirm cost shows: $2.00",
      "Tap 'Add to Bets'",
    ],
  },
  {
    n: 5,
    plainEnglish: "$2 EXACTA BOX of #12 and #15",
    cost: 2,
    why: "Hersh's exact 1-2. Stacks with Tamara's EX BOX.",
    steps: [
      "Tap Bet Type: EXACTA",
      "Tap Style: BOX",
      "Tap Amount: $1",
      "Tap these 2 horses: #12, #15",
      "Confirm cost shows: $2.00 (2 combos)",
      "Tap 'Add to Bets'",
    ],
  },
  {
    n: 6,
    plainEnglish: "$2 to WIN on #15 Emerging Market",
    cost: 2,
    why: "★ JASON-ONLY. Tamara has no WIN #15. If our overlay wins outright at 8/1, this returns ~$18. Tamara only catches it via PLACE.",
    steps: [
      "Tap Bet Type: WIN",
      "Tap Amount: $2",
      "Tap horse #15 Emerging Market",
      "Confirm cost shows: $2.00",
      "Tap 'Add to Bets'",
    ],
  },
  {
    n: 7,
    plainEnglish: "$1 EXACTA STRAIGHT — #12 wins, #18 places",
    cost: 1,
    why: "★ JASON-ONLY. Hersh's 3rd-place pick was #18. Catches the scenario where #18 fills 2nd instead of 3rd.",
    steps: [
      "Tap Bet Type: EXACTA",
      "Tap Style: STRAIGHT",
      "Tap Amount: $1",
      "1st place: tap #12",
      "2nd place: tap #18",
      "Confirm cost shows: $1.00",
      "Tap 'Add to Bets'",
    ],
  },
];

// TAMARA'S TICKETS — SIMPLE only. Keep her R6 winning structure (Ticket #1).
// Drop the part wheel and the multi-EX setup that confused her.
const tamaraBets = [
  {
    n: 1,
    plainEnglish: "$0.50 TRIFECTA KEY BOX — anchor #12 with #6, #15, #18",
    cost: 9,
    why: "SAME SHAPE that won you $39 in R6 today. Hits if #12 finishes anywhere in top 3 (1st, 2nd, OR 3rd), with two of #6/#15/#18 filling the other spots.",
    steps: [
      "Tap Bet Type: TRIFECTA",
      "Tap Style: KEY BOX (or 'KEY-BOX')",
      "Tap Amount: $0.50",
      "KEY (the anchor): tap #12 Chief Wallabee",
      "WITH (the others): tap #6, #15, #18",
      "Confirm cost shows: $9.00 (18 combos)",
      "Tap 'Add to Bets'",
    ],
  },
  {
    n: 2,
    plainEnglish: "$5 to WIN on #12 Chief Wallabee",
    cost: 5,
    why: "Straight win bet on our pick. If he wins at 7/1, returns about $40.",
    steps: [
      "Tap Bet Type: WIN",
      "Tap Amount: $5",
      "Tap horse #12 Chief Wallabee",
      "Confirm cost shows: $5.00",
      "Tap 'Add to Bets'",
    ],
  },
  {
    n: 3,
    plainEnglish: "$2 PLACE on #12 Chief Wallabee",
    cost: 2,
    why: "Pays $8-15 if #12 finishes 1st OR 2nd. Insurance.",
    steps: [
      "Tap Bet Type: PLACE",
      "Tap Amount: $2",
      "Tap horse #12 Chief Wallabee",
      "Confirm cost shows: $2.00",
      "Tap 'Add to Bets'",
    ],
  },
  {
    n: 4,
    plainEnglish: "$2 PLACE on #15 Emerging Market",
    cost: 2,
    why: "Pays $8-12 if our overlay finishes 1st OR 2nd.",
    steps: [
      "Tap Bet Type: PLACE",
      "Tap Amount: $2",
      "Tap horse #15 Emerging Market",
      "Confirm cost shows: $2.00",
      "Tap 'Add to Bets'",
    ],
  },
  {
    n: 5,
    plainEnglish: "$2 EXACTA BOX of #12 and #15",
    cost: 2,
    why: "Hits if #12 and #15 finish 1-2 in EITHER order. Marcus Hersh's exact prediction. Big payout.",
    steps: [
      "Tap Bet Type: EXACTA",
      "Tap Style: BOX",
      "Tap Amount: $1",
      "Tap these 2 horses: #12, #15",
      "Confirm cost shows: $2.00 (2 combos)",
      "Tap 'Add to Bets'",
    ],
  },
];

const jasonTotal = jasonBets.reduce((a, b) => a + b.cost, 0);
const tamaraTotal = tamaraBets.reduce((a, b) => a + b.cost, 0);

export default function Today() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <div className="text-xs text-zinc-500 uppercase tracking-wider">Kentucky Derby — Race 12 — Live</div>
        <h1 className="text-3xl md:text-4xl font-bold mt-1">How to Bet the Derby</h1>
        <p className="text-sm text-zinc-400 mt-2">Step-by-step instructions for non-bettors. Each ticket below shows exactly which buttons to tap on TwinSpires.</p>
      </header>

      {/* URGENT START GUIDE */}
      <section className="mb-6 bg-red-950/40 border-2 border-red-700 rounded-lg p-4">
        <div className="text-red-300 font-bold text-lg mb-2">⏱️ Start Here</div>
        <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-200">
          <li>Open the TwinSpires app or website (twinspires.com).</li>
          <li>Find <span className="font-mono bg-zinc-800 px-1">CHURCHILL DOWNS · Race 12 · Kentucky Derby</span>. Post is {STATE.derbyPostET}.</li>
          <li>Tap into the race. You&apos;ll see the bet builder pad below the horse list.</li>
          <li>Punch each ticket below ONE AT A TIME. After every ticket, check the cost shown matches what we list. If it doesn&apos;t match, STOP and text Jason.</li>
          <li>When all your tickets are added, tap <span className="font-mono bg-zinc-800 px-1">Submit Bets</span> on the bet slip.</li>
        </ol>
      </section>

      {/* GLOSSARY */}
      <section className="mb-6 bg-blue-950/30 border border-blue-800/50 rounded-lg p-4">
        <div className="text-blue-300 font-semibold text-sm mb-3">📖 What the bet types mean</div>
        <dl className="space-y-2 text-sm">
          {glossary.map((g, i) => (
            <div key={i} className="flex flex-col md:flex-row md:gap-3">
              <dt className="font-mono font-semibold text-blue-300 md:w-32">{g.term}</dt>
              <dd className="text-zinc-300">{g.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* THE PICK + WHY */}
      <section className="mb-6 bg-emerald-950/40 border border-emerald-700 rounded-lg p-4">
        <div className="text-emerald-300 font-semibold mb-2">🎯 Our Pick: #12 Chief Wallabee to win</div>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Six of eight sharp DRF/VSiN handicappers have <span className="font-semibold">#12 Chief Wallabee</span> in their top 3, including today&apos;s most accurate handicapper Marcus Hersh (who hit BOTH the longshot upsets in R7 and R10 today). The track has favored closers all day. Bill Mott trains. Junior Alvarado rides. Blinkers added today.
        </p>
        <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
          We&apos;re also keying <span className="font-semibold">#15 Emerging Market</span> as our overlay (sharp money is moving toward him: bet down 15/1 → 8/1). And we&apos;re fading <span className="font-semibold">#1 Renegade</span> — only 2 of 8 sharp picks like him; the rail post is historically the worst spot in the gate.
        </p>
      </section>

      {/* LIVE ODDS */}
      <section className="mb-6 bg-amber-950/20 border border-amber-800/40 rounded-lg p-4">
        <div className="text-amber-300 font-semibold text-sm mb-3">📊 Current Odds (the horses you&apos;ll bet)</div>
        <div className="space-y-2 text-sm">
          {liveOdds.map((h, i) => (
            <div key={i} className="border-b border-amber-900/30 pb-2">
              <div className="flex justify-between">
                <span className="font-bold text-amber-200">{h.p} {h.name}</span>
                <span className="font-mono text-emerald-400">{h.live}</span>
              </div>
              <div className="text-xs text-zinc-400 italic mt-0.5">{h.note}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-zinc-500">SCR (already scratched, can&apos;t bet): {STATE.scratched.join(", ")}</div>
      </section>

      {/* JASON'S BETS */}
      <section className="mb-6 bg-gradient-to-br from-emerald-950/50 to-emerald-900/20 border-2 border-emerald-700 rounded-xl p-5">
        <div className="text-emerald-300 text-sm uppercase tracking-widest font-bold mb-1">JASON · ${STATE.jasonBudget} BUDGET</div>
        <div className="text-zinc-300 text-sm mb-4">6 tickets, total ${jasonTotal.toFixed(2)}. Punch them in this order:</div>
        <BetCardList bets={jasonBets} colorClass="emerald" />
        <div className="mt-3 text-sm text-emerald-300 font-mono">JASON TOTAL: ${jasonTotal.toFixed(2)} / $20</div>
      </section>

      {/* TAMARA'S BETS */}
      <section className="mb-6 bg-gradient-to-br from-rose-950/50 to-rose-900/20 border-2 border-rose-700 rounded-xl p-5">
        <div className="text-rose-300 text-sm uppercase tracking-widest font-bold mb-1">TAMARA · ${STATE.tamaraBudget} BUDGET</div>
        <div className="text-zinc-300 text-sm mb-4">7 tickets, total ${tamaraTotal.toFixed(2)}. Your first ticket is the same shape that WON YOU $39 in R6 today. Punch them in this order:</div>
        <BetCardList bets={tamaraBets} colorClass="rose" />
        <div className="mt-3 text-sm text-rose-300 font-mono">TAMARA TOTAL: ${tamaraTotal.toFixed(2)} / $20</div>
      </section>

      {/* IF SOMETHING IS WRONG */}
      <section className="mb-6 bg-zinc-900 border border-rose-800/50 rounded-lg p-4">
        <div className="text-rose-300 font-semibold mb-3">🚨 If something doesn&apos;t look right</div>
        <ul className="list-disc list-inside space-y-2 text-sm text-zinc-300">
          <li>If the cost on TwinSpires doesn&apos;t match our number → STOP, text Jason a screenshot</li>
          <li>If a horse is missing or shows &quot;SCR&quot; → that horse is scratched. Skip any ticket that requires it; we&apos;ll adjust.</li>
          <li>If you can&apos;t find a button mentioned → text Jason. Sometimes TwinSpires uses different words (e.g., &quot;Wheel&quot; instead of &quot;Part Wheel&quot;).</li>
          <li>If you make a mistake → look for &quot;Edit&quot; or &quot;Remove&quot; on the bet before submitting. Don&apos;t panic.</li>
        </ul>
      </section>

      {/* HOW THIS PAYS */}
      <section className="mb-6 bg-zinc-900 border border-emerald-800/40 rounded-lg p-4">
        <div className="text-emerald-300 font-semibold mb-3">💰 How this pays out</div>
        <div className="text-sm text-zinc-300 space-y-2">
          <div><span className="font-semibold text-emerald-400">If #12 Chief Wallabee wins</span> (best case): Tamara hits $80-450, Jason hits $80-280. Multiple tickets cash.</div>
          <div><span className="font-semibold text-emerald-400">If #12 finishes 2nd</span>: $8-25 return on PLACE bets. Probably small loss but mostly recovered.</div>
          <div><span className="font-semibold text-emerald-400">If #15 Emerging Market wins</span> (overlay): Tamara hits $30-50, Jason hits $30-80.</div>
          <div><span className="font-semibold text-emerald-400">If chalks dominate</span> (#6 or #18 wins, not #12): Tamara&apos;s ticket #2 catches it (~$15-40). Jason loses.</div>
          <div><span className="font-semibold text-rose-400">If neither anchor finishes top 3</span>: both lose $20. ~50% chance — this is the Derby, variance is baked in.</div>
        </div>
      </section>

      <footer className="mt-8 text-xs text-zinc-600 text-center">
        HorseGPT · Built around expert convergence (DRF Hersh, Yahoo Wolken, RotoWire AI sim) + 11-race algo validation today.<br />
        Trust the read. Punch the tickets. Watch the race.
      </footer>
    </main>
  );
}

// ---------- Bet card with step-by-step ----------
interface Bet { n: number; plainEnglish: string; cost: number; why: string; steps: string[]; }

function BetCardList({ bets, colorClass }: { bets: Bet[]; colorClass: "emerald" | "rose" }) {
  const numCircle = colorClass === "emerald" ? "bg-emerald-700" : "bg-rose-700";
  return (
    <div className="space-y-4">
      {bets.map((b) => (
        <div key={b.n} className="bg-zinc-900/80 rounded-lg p-4 border border-zinc-800">
          <div className="flex items-start gap-3 mb-2">
            <div className={`${numCircle} text-white font-bold rounded-full w-8 h-8 flex items-center justify-center text-sm flex-shrink-0`}>
              {b.n}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-zinc-100 text-sm">{b.plainEnglish}</div>
              <div className="text-xs text-emerald-400 font-mono mt-0.5">${b.cost.toFixed(2)}</div>
            </div>
          </div>
          <div className="ml-11 mb-3 text-xs text-zinc-400 italic">{b.why}</div>
          <div className="ml-11">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Tap these buttons on TwinSpires:</div>
            <ol className="list-decimal list-inside space-y-1 text-xs text-zinc-300">
              {b.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        </div>
      ))}
    </div>
  );
}
