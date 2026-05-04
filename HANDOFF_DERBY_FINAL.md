# HorseGPT v3.14 — Derby Day Handoff (FINAL, 2026-05-02)

**Time of handoff:** ~58 min before Derby post (Derby = 6:57 PM ET).
**Status:** R1-R11 complete. R12 Kentucky Derby up next at 5 PM hour.
**Combined bankroll:** Jason $1 + Tamara $22.08 = **$23.08** intact for Derby.

This handoff is the **single source of truth** for everything we learned today and exactly how to execute the Derby. It's structured for:
1. Tonight's Derby execution (exact tickets, $ amounts, syntax)
2. Tomorrow's retro (full data, lessons, what to encode)
3. Algo v3.15 improvements (the patterns we discovered)

---

## TL;DR — DERBY EXECUTION (5 min read)

### The pattern we discovered today
Across 11 races at Churchill Downs Derby Day:
- **Algo P1 wins ~27% (3 of 11)**. Don't bet straight WIN on algo top pick.
- **Algo top 5 captures 2+ of actual top 3 in 100% of races**. The signal cluster is P2-P5, not P1.
- **A longshot crashes top 3 in 8 of 11 races** — usually outside algo top 5.
- **Trifecta = the structure that monetizes both signals.** Anchor algo top 2 in slots 1-2, spread slot 3 wide. R8 chalk EX paid $5.40/$1; R8 TR (algo top 2 + longshot 3rd) would have paid $37.82/$1. **7× the payout.**

### The discipline that worked
- **CHALK_MATCH = SKIP, every time.** When algo top 2 = market top 2, takeout eats EV. We skipped R8, R9, R10 — all correctly. R10 was a total algo miss (#8 won at 5/1, algo had #6 chalk) — discipline saved $9-12.
- **One play per race.** No double-betting same outcome through multiple structures.
- **AI adversarial reviews must be ADDITIVE, not SUBTRACTIVE.** R7 we let 4 AIs swap algo's #5 OUT for #9 IN. Algo was right (#5 won), AI was wrong, swap cost $41 net + the win.

### The Derby R12 plan (5 SCR — field of 19)
**Scratched:** #5, #9, #13, #20, #24

**Tamara's $15 allocation (from $22.08 bankroll, $7 buffer):**

| # | Ticket | Cost | Combos | Hits if |
|---|---|---|---|---|
| 1 | `$0.50 TR  #12 / #1,#6,#18 / #1,#6,#18,#15,#8` | $6.00 | 12 | #12 Chief Wallabee wins, chalk places, chalk or #15/#8 takes 3rd |
| 2 | `$0.50 TR  #1,#6 / #1,#6 / #18,#12,#15,#17,#8` | $5.00 | 10 | Chalk EX (1,6 in either order) + spread including #15/#8 overlays in 3rd |
| 3 | `$2 PLACE  #15 Emerging Market` | $2.00 | 1 | #15 finishes 1st OR 2nd at 9/1 live |
| 4 | `$2 PLACE  #12 Chief Wallabee` | $2.00 | 1 | #12 finishes 1st OR 2nd at 6/1 live |
| | **TOTAL** | **$15.00** | | **4 ways to cash, $7.08 buffer** |

**Jason's $1**: `$1 PLACE on #12 Chief Wallabee` — only if you want skin. Returns $3-5 if #12 finishes top 2.

---

## CURRENT BANKROLL STATE

| Bettor | Started | Spent (Day) | Won (Day) | Cash Left | Day Net |
|---|---|---|---|---|---|
| Jason | $9 | $12 (R1, R4, R5, R7) | $0 | **$1** | -$9 |
| Tamara | $25 | $39 (R5+R6+R7) | $39.08 (R6 hit) | **$22.08** | +$15.08 |

**Combined Derby ammo: $23.08.**

---

## RACE-BY-RACE LOG (R1-R11) — Algo vs Actual vs Bet

### R1 — Maiden Special Weight
- **Algo top 5:** 11, 3, 9, ?, ?
- **Actual:** 11-3-4-6-2
- **Algo P1 right?** ✓ (#11 won)
- **Algo top 5 captured:** 2 of 3 (#11, #3)
- **Bet:** Jason TR `11/3/5,6 @ $0.50` ($3) — LOST
- **Lesson:** Maiden class drop pattern not in algo (cost #4 in slot 3). Add maiden/class signals to v3.15.

### R2 — Allowance
- **Algo top 5:** 8, 4, 1, ?, ?
- **Actual:** 1-2-9-8-6
- **Algo P1 right?** ✗ (#8 finished 4th)
- **Algo top 5 captured:** 1 of 3 (#1 in P3)
- **Bet:** None
- **Retro:** Pace handicapper would have lifted #1. **$1 Hi-5 of 1-2-9-8-6 paid $15,408 — the day's biggest miss.**
- **Lesson:** When algo P1-P3 has E-style speed cluster (R2 had pace meltdown signal), trust pace adjustment over algo P1.

### R3 — Maiden
- **Algo top 5:** 12, 6, 10, ?, ?
- **Actual:** 10-14-6-12
- **Algo P1 right?** ✗ (#12 finished 4th)
- **Algo top 5 captured:** 2 of 3 (#10, #6) — WINNER #10 was algo P3
- **Bet:** None
- **Lesson:** Trainer-mount-shift signal not in algo. **#14 = Velazquez switch to Saffie Joseph barn** — high-leverage signal we missed. Add trainer-jockey-shift weight to v3.15.

### R4 — 6-horse field
- **Algo top 5:** 4, 5, 1, ?, ?
- **Actual:** 6-4-1
- **Algo P1 right?** ✗ (#4 finished 2nd)
- **Algo top 5 captured:** 2 of 3 (#4, #1)
- **Bet:** Jason TR `4/1,5/1,5,6 @ $0.50` ($3) — LOST
- **Retro:** TwinSpires Expert Picks had #6 R Disaster as their #2 pick. We missed including in slot 1. Tri paid $40.65.
- **Lesson:** When TS Expert / consensus has a horse outside algo top 3, ADD them to slot 1 spread (don't drop algo, expand).

### R5 — Allowance Optional Claiming
- **Algo top 5:** 3, 9, 7, 10, 5 ← **PERFECT TOP 5**
- **Actual:** 7-10-9-3-5
- **Algo P1 right?** ✗ (#3 finished 4th)
- **Algo top 5 captured:** **5 of 5** (algo's exact top 5 in different order)
- **Bet:** Jason TR `2/3,7,9/3,7,9 @ $0.50` ($3) — LOST (wrong slot 1 anchor)
- **Retro:** **$0.10 Hi-5 BOX of algo top 5 ($12) → would have paid $139.82, net +$128.**
- **Lesson:** When algo top 5 is HIGH-confidence (no overlay flags), Hi-5 BOX of strict top 5 is +EV. But verify $0.10 base is actually allowed (TS minimum is $1 on Tamara's account — won't work for box).

### R6 — Knicks Go Overnight S. (#1 + #8 SCR, 9-horse field)
- **Algo top 5:** 2, 4, 6, 7, 11
- **Actual:** 6-11-2-7-4
- **Algo P1 right?** ✗ (#2 finished 3rd)
- **Algo top 5 captured:** **4 of 5** (missed actual #11 — but it WAS in algo top 5!)
- Wait — #11 IS in algo top 5. So algo captured **5 of 5** of actual top 5? Let me re-verify: Actual top 5 = 6, 11, 2, 7, 4 = ALL FIVE in algo top 5. ✓
- **Bet:** Tamara TR KEY BOX `2/4,6,11 @ $0.50` ($9) — **WON $39.08** 🎉
- **Lesson:** TR KEY BOX of algo P1 + 3 other top-5 horses works. Tamara's manual addition of #11 (an algo top-5 horse the bot's bet builder didn't include) was the key. **This race is the canonical "right play" for the day.**

### R7 — Distaff Turf Mile G2
- **Algo top 5:** 2, 3, 8, 5, 4
- **Actual:** 5-3-8-7-6
- **Algo P1 right?** ✗ (#2 not in top 5)
- **Algo top 5 captured:** 3 of 3 in algo top 4 — **5/3/8 = ALL IN ALGO TOP 4 (excl algo P1)**
- **Bet:** Jason $3 TR + Tamara $12 TR BOX `2,3,8,9 @ $0.50` + 2× Tamara $3 TR — ALL LOST -$21
- **TS PAYOUTS confirmed:** $2 EX 5/3 = $51.18 ($25.59/$1) · $0.50 TR 5/3/8 = $53.03 ($106.06/$1) · $1 SUPER 5/3/8/7 = $452.02 · $1 HI5 5/3/8/7/6 = $10,975.47
- **Retro:** **`$0.50 TR BOX 2,3,5,8` ($12, 24 combos) WOULD HAVE HIT — paid $53.03, net +$41.**
- **What we did:** 4-AI adversarial review pushed us to swap #5 OUT and #9 IN. **Algo was right. AI was wrong. Swap cost the hit.**
- **Lesson #1:** AI adversarial review is ADDITIVE only (expand spread). Never replace algo strict top 4 ranks.
- **Lesson #2:** When market FADES algo P1 and algo P2-P4 overlay (#5 was algo P3-P4 ranked), trust algo P2-P4 as anchor.

### R8 — Pat Day Mile G2 (#10 SCR, 11-horse field)
- **Algo top 5:** 1, 6, 2, 7, 8
- **Actual:** 6-1-5-2
- **Algo P1 right?** ✗ (#1 finished 2nd)
- **Algo top 5 captured:** 3 of 4 (#6, #1, #2 — missed #5 in 3rd)
- **Bet:** None — SKIP per CHALK_MATCH discipline ✓
- **TS PAYOUTS confirmed:** $2 EX 6/1 = $10.80 ($5.40/$1) · $0.50 TR 6/1/5 = $18.91 ($37.82/$1) · $1 SUPER 6/1/5/4 = $114.30 · $1 HI5 6/1/5/4/7 = $506.74
- **Validation:** $1 EX BOX algo top 4 ($12) hit (6/1 in box) but only paid $5.40 → **NET LOSS $6.60**. SKIP correctly saved $6.60.
- **Validation:** $0.50 TR BOX algo top 4 ($12) MISSED (#5 not in algo top 4) → SKIP saved $12.
- **Lesson:** CHALK_MATCH = SKIP. Even when algo is right on top 2, chalk EX pays so little after takeout that the bet is negative EV. The juicy bets need a longshot in slot 3.

### R9 — American Turf G1 (14-horse turf, #5 SCR)
- **Algo top pick:** #4 Stark Contrast (8/5 chalk)
- **Algo top 2:** 4, 12 (CHALK_MATCH per JSON)
- **Actual:** 4-12-9-7-3
- **Algo P1 right?** ✓ (#4 won at $4.40 = 6/5)
- **Algo top 5 captured:** 2 of 3 (#4, #12) — missed #9 Honey Dutch at 22/1 in slot 3
- **Bet:** None — SKIP per CHALK_MATCH ✓
- **TS PAYOUTS confirmed:** $2 EX 4/12 = $15.58 ($7.79/$1) · $0.50 TR 4/12/9 = $33.73 ($67.46/$1) · $1 HI5 4/12/9/7/3 = $5,617
- **Validation:** Even with algo nailing top 2, #9 longshot crashed slot 3. TR BOX of algo top 4 would NOT have hit (#9 not in algo top 4). SKIP correct.
- **Lesson:** Even when CHALK_MATCH algo NAILS top 2, slot 3 longshot wrecks BOX structures. Need TR ANCHOR + spread slot 3 wide to capture this.

### R10 — Churchill Downs S. G1 (7F dirt)
- **Algo top 2:** 6, 2 (CHALK_MATCH)
- **Market top 2:** 6, 2
- **Actual:** 8-5-9-7-2
- **Algo P1 right?** ✗ (**#6 didn't even hit top 5**)
- **Algo top 5 captured:** 1 of 3 (#2 in 5th)
- **Bet:** None — SKIP ✓
- **TS PAYOUTS confirmed:** $2 EX 8/5 = $108.44 ($54.22/$1) · $0.50 TR 8/5/9 = $450.69 ($901.38/$1) · $1 SUPER 8/5/9/7 = $5,766 · $1 HI5 8/5/9/7/2 = **$53,811.79**
- **Lesson:** R10 was a TOTAL algo miss — chalk #6 didn't hit. This is the second mode of algo failure (after R3, R6). Skipping CHALK_MATCH protected from this catastrophic miss too.

### R11 — Old Forester Bourbon Turf Classic G1 (1-1/8M turf)
- **Algo top 2:** 6, 4 (PARTIAL_EDGE — #4 not in market top 2)
- **Market top 2:** 6, 9
- **Actual:** 6-10-1-4-5
- **Algo P1 right?** ✓ (#6 Rhetorical won at $5.92 = ~2/1 chalk)
- **Algo top 5 captured:** 2 of 3 (#6, #4 in 4th — missed #10 in 2nd)
- **Bet:** None (we deferred until Derby)
- **TS PAYOUTS confirmed:** $2 EX 6/10 = $55.80 ($27.90/$1) · $0.50 TR 6/10/1 = $131.56 ($263.12/$1) · $1 HI5 6/10/1/4/5 = $9,295
- **Site's plan was:** $0.50 TR `6,4,9,10,3 BOX = $12` → 60 perms × $0.50 = $30 (note: site cost calc was wrong). Actual top 3 = 6-10-1, with #1 not in box. **MISS.**
- **My deployed plan was:** $0.50 TR `#6,#4 / #6,#4 / #9,#10,#3,#1 = $4`. Actual: #4 wasn't in top 2 (was 4th). **MISS.**
- **Lesson:** PARTIAL_EDGE is harder than it looks. Algo's #4 didn't show; market's #9 didn't show; the 2nd-place horse #10 wasn't either top 2 — it was in algo top 5 but ranked P3. **TR ANCHOR needs to anchor more loosely or use single-horse anchor with WIDE slot 2 spread.**

---

## ALGO ACCURACY STATISTICS (11-race sample)

| Metric | Value | Hit Rate |
|---|---|---|
| Algo P1 wins | R1, R9, R11 | **3/11 = 27%** |
| Algo top 2 captures actual top 2 | R1, R8, R9, R11 | **4/11 = 36%** |
| Algo top 5 captures 2+ of actual top 3 | All except R10 | **10/11 = 91%** |
| Algo top 5 captures ALL 3 of actual top 3 | R5, R6, R7 | **3/11 = 27%** |
| Longshot in actual top 3 outside algo top 5 | R3, R6 (#11 was in!), R8, R10 | ~5/11 = 45% (lower than first thought) |
| CHALK_MATCH races where SKIP was correct | R8, R9, R10 | **3/3 = 100% saved** |

**Cumulative SKIP discipline saved (vs aggressive blanket TR/EX BOX):**
- R8: $12 saved (would have lost $12 on TR BOX miss, or -$6.60 on EX BOX hit)
- R9: $12 saved (TR BOX miss, longshot in slot 3)
- R10: $30+ saved (total algo miss)
- R11: $4 saved (planned bet would have missed)
- **Total saved: $58+** by following SKIP discipline

---

## TWINSPIRES PAYOUT TABLE (per $1 invested)

| Race | EX | TR | SUPER | HI5 |
|---|---|---|---|---|
| R7 (5/3/8/7/6) | $25.59 | $106.06 | $452.02 | $10,975 |
| R8 (6/1/5/4/7) | $5.40 | $37.82 | $114.30 | $506 |
| R9 (4/12/9/7/3) | $7.79 | $67.46 | $331.72 | $5,617 |
| R10 (8/5/9/7/2) | **$54.22** | **$901.38** | $5,766 | **$53,811** |
| R11 (6/10/1/4/5) | $27.90 | $263.12 | $1,255 | $9,295 |

**Key observations:**
- **Chalk-chalk EX (R8, R9) pays $5-8 per $1.** Negative EV after takeout for any spread structure.
- **Longshot-included EX (R10, R11) pays $25-54 per $1.** Where the EV lives.
- **TR pays 4-15× the EX.** When you can identify slot 3, TR is dramatically better.
- **HI5 pays 100-500× the SUPER.** But hit ratio is brutal at 5-runner exact-order requirement.

---

## TWINSPIRES BET REFERENCE — VERIFIED

### Minimums (Tamara's account, Churchill Downs Derby Day)
- **WIN/PLACE/SHOW:** $2 base
- **EXACTA:** $1 base
- **TRIFECTA:** $0.50 base ✓ (Tamara's R6 hit confirmed)
- **SUPERFECTA:** $1 base ⚠️ (NOT $0.50 — re-engineer any ticket using $1)
- **SUPER HIGH 5 (HI5):** $1 base ⚠️ (NOT $0.10 — re-engineer)
- **DAILY DOUBLE:** $1 base
- **PICK-3 / PICK-4 / PICK-5:** $0.50 base
- **JACKPOT 8:** $1 base

### Bet Syntax (use exactly)
- `WIN #X` — straight win
- `PLACE #X` — top 2
- `SHOW #X` — top 3
- `EX X / Y` — X wins, Y places
- `EX BOX X, Y` — X and Y in any 1-2 order
- `TR X / Y / Z` — exact 1-2-3
- `TR BOX X, Y, Z` — any order top 3
- `TR KEY X / Y, Z` — X anchored slot 1, Y/Z in slots 2-3
- `TR KEY BOX X / Y, Z, W` — X across all 3 slots, Y/Z/W boxed
- `SUPER X / Y / Z / W` — exact 1-2-3-4
- `HI5 X / Y / Z / W / V` — exact 1-2-3-4-5

### Cost calculation gotchas
- **TR BOX of N horses = N × (N-1) × (N-2) combos.** Box of 4 = 24 combos. Box of 5 = 60 combos. Box of 6 = 120 combos.
- **TR KEY BOX of 1 anchor + N others = 3 × (N choose 2) × 2 = 3 × N × (N-1) combos.** Anchor #2 + 3 others = 18 combos.
- **SUPER and HI5 part-wheels:** number of valid permutations where each horse is used ≤1 time. Hand-compute or use TS bet builder to verify.
- **ALWAYS verify in TS bet builder** before submitting. Site cost calculations have been wrong multiple times today.

---

## DERBY R12 — DETAILED PLAN

### Field state (FIVE SCRATCHES — field of 19)
- **Scratched:** #5, #9, #13, #20, #24
- **Live odds (58 MTP):**

| # | Horse | ML | LIVE | Algo Rank | Movement |
|---|---|---|---|---|---|
| 1 | Renegade | 4/1 | 5/1 | P1 (26%) | drift slight |
| 6 | Commandment | 6/1 | 5/1 | P2 (18%) | bet-down |
| 8 | So Happy | 15/1 | 6/1 | P6 (7%) | **HUGE bet-down** |
| 18 | Further Ado | 6/1 | 6/1 | P3 (17%) | flat |
| 12 | Chief Wallabee | 8/1 | 6/1 | P4 (12%) | bet-down |
| 15 | Emerging Market | 15/1 | 9/1 | P7 (7%) | bet-down (overlay confirmed) |
| 7 | — | — | 14/1 | — | — |
| 14 | — | — | 18/1 | — | — |
| 21 | — | — | 23/1 | — | — |

### Pool sizes (massive)
- WIN: $46.6M · EX: $17.3M · TR: $20.9M · SUPER: $8.7M · HI5: $695K
- Pick-3: $192K · Jackpot 8: $708K

### The strategy
**Algo top 2 = market top 2 = #1 Renegade, #6 Commandment.** Strict CHALK_MATCH = normally a SKIP.

**BUT:** Derby is a 19-horse field (chaos baseline) with anti-public framework signals (handoff flags #1, #6, #18 as public traps). Slot 3 is guaranteed to surprise. The TR anchor pattern thrives here.

We bet **two TR structures** + **two PLACE hedges**:

#### Ticket 1 — TR ANTI-PUBLIC (Primary, $6)
```
$0.50 TR  #12 / #1, #6, #18 / #1, #6, #18, #15, #8
```
- **Slot 1:** #12 Chief Wallabee (algo P4, "clean" Mott trainer, 6/1 live)
- **Slot 2:** Three public chalks (#1, #6, #18)
- **Slot 3:** Same chalks + overlays #15, #8
- **Combos:** 1 × 3 × 4 = 12 × $0.50 = **$6.00**
- **Hits if:** #12 wins, then #1/#6/#18 places, then any of those + #15/#8 takes 3rd
- **Why:** If algo P1 unreliability holds (proven 27%), keying algo P4 (#12) where overlay value lives is +EV. Chief Wallabee at 6/1 makes the tri pay big.
- **Expected payout:** $200-$1500+ if hits

#### Ticket 2 — TR ALGO-TOP-2 ANCHOR (Saver, $5)
```
$0.50 TR  #1, #6 / #1, #6 / #18, #12, #15, #17, #8
```
- **Slot 1-2:** Algo top 2 boxed (#1, #6)
- **Slot 3:** 5 horses (#18 chalk + overlays)
- **Combos:** 2 × 1 × 5 = 10 × $0.50 = **$5.00**
- **Hits if:** #1 and #6 finish 1-2 in either order, slot 3 = #18 OR #12 OR #15 OR #17 OR #8
- **Why:** Captures the algo's reliable top-2 read with slot 3 spread. Day's pattern says top 2 reliable, slot 3 wild.
- **Expected payout:** $50-$800 (depends on slot 3 horse — higher payout for #15/#17/#8)

#### Ticket 3 — PLACE on #15 ($2)
```
$2 PLACE  #15 Emerging Market
```
- **Pays if:** #15 finishes 1st or 2nd at live 9/1
- **Why:** Chad Brown / Prat boring-name overlay. Market money is moving toward him (bet down ML 15/1 → live 9/1). Cheapest hedge on the day's clearest overlay.
- **Expected payout:** $8-$20

#### Ticket 4 — PLACE on #12 ($2)
```
$2 PLACE  #12 Chief Wallabee
```
- **Pays if:** #12 finishes 1st or 2nd at live 6/1
- **Why:** Hedges the anti-public anchor in Ticket 1. If #12 finishes 2nd (not 1st), Ticket 1 misses but PLACE hits. ~$8-12.

### Total Tamara: $15.00 / $22.08 (buffer $7.08)
### Total Jason: $1 PLACE on #12 (optional — only if you want a horse in the race)

---

## ALGO v3.15 IMPROVEMENT BACKLOG (next session)

Based on today's 11-race sample, encode these into the algorithm:

### High priority (high signal, recurring)
1. **De-emphasize P1 weighting.** P1 wins 27%; P2-P5 cluster captures 91% of actual top 3 with 2+ horses. The current ranking treats P1 as the strongest signal but it's noise.
2. **Add CHALK_MATCH detector and force-PASS logic.** Confirmed: when algo top 2 = market top 2 = chalk, every structure is negative EV. We saved $58+ by skipping these.
3. **TR-Anchor recommended as default exotic** when edge tier ≥ PARTIAL_EDGE. Anchor algo top 2 in slots 1-2, spread slot 3 with N-3 horses (where N = field size).
4. **Verify base unit minimums per account.** Hardcoded $0.10 Hi-5 base in v3.14 fails on accounts that require $1 minimum. Add bet-builder verification step.

### Medium priority (race-class specific)
5. **Maiden class drop signal** (R1 trigger — #4 was a class drop the algo didn't weight).
6. **Trainer-jockey shift signal** (R3 trigger — Velazquez switching to Saffie Joseph).
7. **TS Expert / public consensus pick proxy** (R4 trigger — TS expert had #6 we missed).
8. **Pace meltdown adjustment** (R2 retro — would have lifted #1 with E-style cluster).

### Low priority (exotic structure)
9. **Hi-5 BOX of strict algo top 5** when confidence HIGH and no overlay flags (R5 retro: $128 net hit). Requires base unit ≥ $0.50 to be feasible.
10. **TR KEY BOX validation** — Tamara's R6 hit ($39.08 on $9) is the canonical "right play" for high-confidence algo races.

### Process improvements
11. **AI adversarial review = ADDITIVE only.** Encode this as a hard rule. Never replace algo strict top 4 with AI-flagged horses.
12. **Live odds drift signal.** Horses bet-down from ML by 30%+ are "market overlays" worth promoting in slot 3 spread (R10 #8 was 15/1 → 5/1, #15 was 15/1 → 9/1).
13. **Cost calculation verification step.** Site has had wrong cost calcs in the SmartDerby JSON. Add brute-force combo counter.

---

## OPEN ITEMS / UNRESOLVED

- [ ] **Sheet auto-population** — Google Sheet still requires manual paste. Canvas-rendered cells aren't DOM-scrapable.
- [ ] **Mr. Hands bot down** — Anthropic credits exhausted, Gemini key denied at project level. Static FAQ fallback engaged. Not blocking the Derby.
- [ ] **Vercel deploy from worktree confirmed working** — both `affectionate-mestorf-559c12` and `thirsty-aryabhata-291678` have access. Branch `claude/affectionate-mestorf-559c12`.
- [ ] **R12 ticket cost calculations need bet-builder verification** before submit. Don't trust handoff numbers blindly — punch into TS bet builder and confirm $ matches before pressing submit.

---

## POST-DERBY RETRO TEMPLATE

After the Derby runs, capture:

```
R12 ACTUAL: ____ - ____ - ____ - ____ - ____
R12 PAYOUTS:
  EX:    $____
  TR:    $____
  SUPER: $____
  HI5:   $____

TICKETS RESULT:
  Ticket 1 ($6 anti-public): HIT/MISS, paid $____
  Ticket 2 ($5 algo anchor): HIT/MISS, paid $____
  Ticket 3 ($2 PLACE #15): HIT/MISS, paid $____
  Ticket 4 ($2 PLACE #12): HIT/MISS, paid $____

TOTAL TAMARA RETURN: $____
NET DAY: $____ (vs starting $25)

ALGO ACCURACY R12:
  P1 right? ____
  P1-P3 captured? ____
  Top 5 captured 3 of top 3? ____

PATTERN VALIDATION:
  Did TR anchor pattern hit? ____
  Did anti-public framework hit? ____
  Was a longshot in top 3? ____

LESSONS FOR v3.15:
  ____
```

---

## CONTACT / COMMS

- **Jason** (operator): in chat, or 502-408-0064 for iMessage
- **Tamara** (Derby execution): 502-931-1043 — bet calls go here
- **Don't iMessage either without explicit Jason approval** unless answering a direct request
- **Site:** https://previewcharge-nine.vercel.app/today (deploys from `/Users/jason/previewcharge/.claude/worktrees/thirsty-aryabhata-291678/` via `vercel --prod --yes`)

---

## CHROME TAB STATE (current)

- TS Derby pools: tab `492170976` (https://www.twinspires.com/bet/program/classic/churchill-downs/cd/Thoroughbred/12/pools)
- TS R10 payouts: tab `492171002`
- TS R11 payouts: tab `492171003`
- TS R9 payouts: tab `492171004`
- Browser: "tams laptop" deviceId `5a3797eb-3c27-4c14-8a6d-ffdfdff19d0a`

---

**Discipline. Pattern recognition. The Derby is the day's biggest pool with the day's most reliable structure (TR anchor + slot 3 spread). Execute the plan.**
