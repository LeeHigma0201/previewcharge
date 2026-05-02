# Picks Thinking Log — Mac Session, 2026-04-30

This is the actual scratchpad. The reasoning behind each pick the user saw, including the parts that were wrong and why.

Audience: Jason, looking over the bot's shoulder. Future Claude, picking up the workflow.

---

## The decision framework (what I'm actually weighing)

Before any pick, I'm running through this priority order:

1. **Algo's score (top-3 + percentages)** — This is the trained model. Beyer (z-scored within field), Prime Power, jockey/trainer tier, ML odds (Benter anchor), post bias, run style, distance/surface fit. This is NOT a heuristic. It's the base layer.

2. **Live odds vs ML odds** — Did the market disagree with the morning line? Sharp bet-down (ML/live ratio > 5x) is a known signal. Drift (live > ML by 50%+) is the inverse.

3. **Pool % data** (when available, ~30 min before post):
   - W% / P% / S% by horse
   - W-P gap on top-3 odds horses → "chalk-doubt" candidate
   - P>W on non-chalk → "smart-money board" candidate
   - Show-pool growth rate → "sharp show" candidate

4. **Race-specific context**:
   - Field size (small = pass exotics, large = chaos box)
   - Race type (claiming/maiden/allowance vs stakes — flags behave differently)
   - Track-day pattern (is the rail dead today? Are closers winning? Use Tweak B's bias override)

5. **Connection quality** (jockey + trainer tier-listed vs not)

6. **Bet structure** — what's the EV ticket given the field shape and the user's budget?

The mistake I made today (R9 + R10) was promoting #3 (pool flags) above #1 (algo score). That's the reverse of how it should work.

---

## Per-race walk-through — what I actually thought

### R5 Jinxzi — first algo top-1 hit

Algo ranked #3 Jinxzi at 19.8% (chalk-leaning at 4/1) with Wilkes/Carrasco. #12 Tregetour at 16.8% as smart-board (place > win). Algo top-2 close.

What I looked at:
- Algo score gap was tight (19.8 vs 16.8) → close race, exacta box more EV than key.
- No flag fired.
- Closer-friendly track-bias override active (Tweak B kicked in after R4 — 4/4 closers had won that morning).
- #3 was E-style (early speed) — Tweak B compressed style range, so E wasn't penalized as much as it would've been at default.

Decision: Trust algo top-2. Backed straight forward exacta.

Outcome: Hit. #3 won, #12 was 2nd. Forward exacta in order.

### R7 Honfleur — algo top-1 #1

Algo had #1 at 30.6%. Big gap to #4 (21.3%) and #5 (12.5%). Prat / Chad Brown — top-tier connections. ML 1.8 (low chalk).

What I thought:
- Algo's confidence + top connections + low chalk = SAFE win bet, but the under-spread is the question.
- 1-4-5 trifecta box was the algo's recommendation. Made sense.

What I missed:
- The 4th algo pick was #7 Vow to Resiliency at 10%. He's algo-low but not negligible.
- A 4-horse super box `1-4-5-7` would've cost $0.10 × 24 = $2.40 vs the 3-horse trifecta box at $3.00 — almost the same money, with the boundary case covered.

Outcome: Top-1 hit. Trifecta box LOST (came 1-7-5). Lesson: **always include algo's top-4, not just top-3**, in any box. The 4th pick costs ~$0.50 extra and saves boundary cases like this.

### R8 Jensco — algo top-2 in order

Algo had #6 Jensco at 32.2% (Irad / Hess at 9/5 chalk) and #2 Our Shenanigan at 23.6%. Hess wasn't tier-listed but Irad was top jockey + Beyer 94 + Prime Power 123.9.

What I looked at:
- The Beyer score on #6 was the highest in the field by a meaningful margin.
- No flag fired (chalk + algo agreed).
- This was a "boring chalk wins" setup — the algo's confidence was earned by raw figures.

Decision: Algo's top-2 forward exacta + super box.

Outcome: Hit. 6-2 forward exacta. Cleanest call of the day.

### R9 Lagynos — WHERE I WENT WRONG

Algo had #8 Lagynos at 38.1% — Asmussen/Jose Ortiz, $350K Opening Verse Stakes. Big confidence.

Pool data at 21 MTP: #8 had W% 35.2 vs P% 23.2 = +12pt gap. Top-3 odds horse with W>>P. **Chalk-doubt flag fired.**

My scratchpad at the time:
> "Algo's top pick at 38.1% just got flagged as a likely bust... If we apply the pool-disparity penalty (~25% reduction on flagged chalks per the existing system), and the smart-money bonus on #5, the picks should reorder approximately: #4 Quatrocento, #9 West Hollywood, #5 Chasing the Crown, #8 Lagynos."

What I weighed:
- Flag had been 4-for-4 that morning.
- Pool-disparity penalty in code is meaningful (~25% effective).
- Smart-money board on #5 was a separate signal.

What I FAILED to weigh:
- Morning fires were ALL on maiden / claiming / allowance chalks. R9 was a $350K Stakes G3-quality field.
- Asmussen + Jose Ortiz is **top-tier connection cluster**. Top connections grind out wins even when public over-bets.
- The flag is an OVERLAY built on top of a far-better-trained core algo. An N=4 overlay overriding the algo's 38% top pick is structurally wrong.
- I had no validated evidence the flag worked in stakes. The 4 morning fires were not a controlled sample for stakes-grade.

Decision (wrong): Recommended fading #8.

Outcome: #8 Lagynos won. Algo top-1 was right. Flag was wrong. I should have weighted my own uncertainty about the overlay's segment validity higher than I did.

### R10 Maximum Bourbon — REPEATED THE MISTAKE

Algo had #2 Built (30.3%) as top-1, #9 Maximum Bourbon (19.7%) as top-2. R10 was $200K St. Matthews Overnight Stakes — another stakes race.

Pool data at 12 MTP: #9 fired chalk-doubt (+5.2 W-P) AND dry-show (+7.3 W-S). I got excited about the "compound" signal.

My scratchpad:
> "Both top-2 fire CHALK-DOUBT now. New favorite: #9 Maximum Bourbon. Refined R10 play: Trifecta key #2 OVER #1, #6, #8 (NOT #9)."
>
> Later: "$2.40 SUPER BOX #2-#1-#6-#8 @ $0.10 (24 perms — pure flag-fade play)"

What I weighed:
- Compound signal (W-P + W-S) felt stronger than R9's W-P alone.
- I rationalized: "smart-money signals on #4 Quatrocento were 1-for-1 in R9, so this is at least PARTIAL evidence."
- The morning 4-for-4 still felt close in memory.

What I FAILED to weigh (despite having JUST written R9's lesson 30 min earlier):
- R9 had ALREADY shown the flag fails on stakes with top connections.
- Maximum Bourbon: Prat / D'Amato — both top-tier.
- The algo's #9 score (19.7%, second-highest) was a strong signal *against* the fade, generated from the same sources that produced R9's correct call.
- I told the user to fade — overriding the algo.

Decision (wrong, again): Recommended fading #9.

Outcome: #9 Maximum Bourbon won. **The user's $6 ticket lost.**

The user called this out: *"you are just not trusting your math claude you need to not be swayed by the noise."* That was the right correction. The algo's math was ranking #9 high for a reason. I was letting an N=4 overlay (now N=2 wrong on the same segment) drive picks.

---

## What the corrected framework looks like

The flag is not BROKEN. It's still 4-for-6 = 67% across the day. But:

**OLD rule:** Flag fires → fade horse from win → reorder picks.

**NEW rule:** Flag fires → use it for **secondary signal interpretation only** (smart-money board horses, show-pool horses for under-spread). Do NOT downgrade the chalk in the algo's WIN ranking.

Specifically:
- Algo's top-1 stays top-1 even if flag fires on it.
- Algo's top-3 picks always populate the trifecta/super box. Period.
- Pool flags help PICK THE 4TH HORSE for the box, or the smart-money under-spread.
- Pool flags can suggest betting LESS on a flagged chalk in WIN-only tickets, but never zero, never fade.

For stakes specifically (purse > $100K with top-tier trainer + top-tier jockey on the chalk):
- Discard the chalk-doubt fire entirely.
- Use the algo's score directly.
- Use the smart-money board / show-pool signals only for the under-spread.

---

## R11 thinking — the corrected approach

R11 = Mamzelle S. G3, $300K, 5 1/2 F turf. Stakes-grade.

Algo:
1. **#5 Cy Fair** (Irad Ortiz Jr / George Weaver, 5/2) — 27.9%
2. **#8 Slay the Day** (Velazquez / Brian Lynch, 3/1) — 19.5%
3. **#6 Hen Party** (Prat / Eoin Harty, 9/2) — 14.0%
4. **#3 Final Accord** (J.Ortiz / Mark Casse, 6/1) — 12.6%

Connection profile: Three of the top 4 picks have **top-tier jockey** (Irad, Velazquez, Prat, J.Ortiz) and most have tier-listed trainers. This is a stakes race where the algo's confidence comes from genuine credentials, not noise.

What I'll do when pools open:
- **If chalk-doubt fires on #5 or #8:** I'll NOTE it, but I will NOT change the picks. Algo top-2 stays.
- **If smart-money board fires on a non-top-3 horse (say #1 Snappy Comeback):** Add that horse to the under-spread / 5th-horse super box position.
- **If show-pool spike fires on any horse:** Note it as a board candidate.

R11 pre-pool play (subject to pool refinement):

```
$2 WIN     #5 Cy Fair                 (algo top, 5/2 expected ~$5-6 if hits)
$2.40 SUPER BOX  #5-#8-#6-#3 @ $0.10  (24 perms, algo's full top-4)
$1.50 EX BOX     #5-#8                ($0.75 × 2 perms — top 2 algo)
                                       = $5.90 ≈ $6 budget
```

Single-ticket alternative: **$0.10 super box `#5-#8-#6-#3-#1` (5-horse) = $12** — over budget. So 4-horse box at $0.10 is the right size.

If I had to pick ONE thing for R11 with $6 — straight $4 WIN on #5 Cy Fair + $2 EX BOX 5-8. Tight, simple, algo-respecting.

---

## Check yourself before betting (the rule going forward)

1. Did I start with the algo's top-3? **Yes / No**
2. Am I changing the algo's top-3 ranking? **Why specifically?**
3. Is the reason supported by N≥10 prior cases in the same segment (stakes vs claiming, sprint vs route, dirt vs turf)?
4. Or am I letting a recent N=2 trend override the algo's training base?

If 3 is no and 4 is yes → put the algo back in front, use the new signal for under-spread only.

---

## Today's running tally (through R10)

- Algo top-1: 4/8 = 50% (R5, R7, R8, R9). And #9 won R10 = algo top-2 hit.
- **Algo top-2 in last 5 algo-scored races: 5-for-5.** This is the load-bearing number.
- Algo top-3: 7/8 = 87.5%.
- Forward exactas in order (top-2): 2 (R5, R8).
- Chalk-doubt flag: 4/6 = 67% — usable as secondary signal, not as override.
- Smart-money board (P>W = board): 2/2.
- Show-pool spike (>3× growth): 1/1 (N=1, track).

Two more races. Trust the algo.
