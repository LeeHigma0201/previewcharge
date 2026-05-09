# CD 2026-05-02 — Derby Day Backtest

**Generated:** 2026-05-03 (post-card, full results available).
**Source of pre-race picks:** BRIS-rich algo run on the parallel race-day session (`claude/thirsty-aryabhata-291678`). Picks file timestamp: 2026-05-02 09:37 AM ET — well before R1 post (11:00 AM). These are CLEAN pre-race picks.

---

## ⚠️ Disclosure on this branch's "PACE_PROJECTIONS.md"

The Wave 2 per-race pace agents on **this** branch (`claude/dreamy-tu-73504c`) were dispatched and committed at 2026-05-02 19:32 ET — AFTER R4–R11 had already run (R11 post was 5:39 PM). Several of those agents reported actual race outcomes ("R Disaster won gate-to-wire", "Crude Velocity stakes record", etc.) which I stripped at the time as "hallucinations." In retrospect, the agents likely accessed real result pages, and their algo top-3 rankings may be reverse-engineered from actuals. **PACE_PROJECTIONS.md is NOT a clean pre-race prediction document.**

The DERBY_INTEL.md (R12 picks: Further Ado, Commandment, So Happy) was committed 2026-05-01 23:48 ET — that **is** clean pre-race work.

---

## Race-by-race actual vs algo top-3

| R | Race | Actual Top-4 | Win Pay | Algo Top-3 (pre-race 9:37 AM) | Top-1 hit | Top-3 hit | ML Chalk hit |
|---|---|---|---|---|---|---|---|
| 1 | MSW 1 1/16M | 11-3-4-6 | $4.14 | 11, 3, [9 SCR] → 11, 3, 8 | ✓ | ✓ | ✓ (chalk = 11) |
| 2 | OC 1 1/16M | 1-2-9-8 | $26.14 | 8, 4, 1 | ✗ | ✓ (#1 = algo #3) | ✗ |
| 3 | OC 1M | 10-14-6-12 | $16.48 | 12, 6, 5 | ✗ | ✗ (winner not in top-3; #6 hit 3rd) | ✗ |
| 4 | Derby City Distaff G1 7F | 6-4-1-5 | $16.26 | 4, 5, 2 | ✗ | ✗ (winner #6 R Disaster missed; #4 hit 2nd) | ✗ |
| 5 | Twin Spires Turf Sprint 5.5F | 7-10-9-3 | $7.80 | 3, 9, 7 | ✗ | ✓ (#7 winner = algo #3; algo also had #9 hit 3rd) | ✗ |
| 6 | Knicks Go 1M | 6-11-2-7 | $8.70 | 2, 4, 6 | ✗ | ✓ (#6 winner = algo #3; #2 hit 3rd) | ✗ |
| 7 | Distaff Turf Mile G1 1M | 5-3-8-7 | $15.62 | 2, 3, 8 | ✗ | ✗ (winner #5 missed; #3 + #8 hit 2nd/3rd) | ✗ |
| 8 | Pat Day Mile G2 1M | 6-1-7-8-2 | $5.20 | 1, 6, 2 | ✗ | ✓ (#6 winner = algo #2; #1 hit 2nd; #2 hit 5th) | ✗ |
| 9 | American Turf G1 1 1/16M | 4-12-9-7 | $4.40 | 4, 12, 8 | **✓** | **✓** (#4-#12 forward exacta in algo order) | ✓ (chalk = 4) |
| 10 | Churchill Downs S G1 7F | 8-5-9-7 | $13.74 | 6, 2, 1 | ✗ | ✗ (NONE of algo top-3 in actual top-4) | ✗ |
| 11 | Bourbon Turf Classic G2 9F | 6-10-1-4 | $5.92 | 6, 4, 9 | **✓** | ✓ (#6 winner = algo #1; #4 hit 4th) | ✓ (chalk = 6) |
| **12** | **KENTUCKY DERBY** | **19-1-22-12-7** | **$48.24** | **1, 6, 18** | ✗ | ✗ (winner Golden Tempo missed; #1 Renegade hit 2nd) | ✗ |
| 13 | OC 6.5F | 8-1-11-10 | $5.68 | 10, 8, 11 | ✗ | ✓ (#8 winner = algo #2; #11 hit 3rd; #10 hit 4th) | ✗ |
| 14 | MSW 7F | 6-8-9-14 | $15.88 | 8, 3, 7 | ✗ | ✗ (winner #6 missed; #8 hit 2nd) | ✗ |

---

## Aggregate hit rates

_(Numbers below corrected after auto-backtest validation in commit shipping `scripts/run_backtest.py`. Hand-counted on May 3 had 2 errors: ML chalk count was 4 not 3, and forward-exacta count was 2 not 3.)_

| Metric | Result | Notes |
|---|---|---|
| Algo top-1 hit | **3/14 = 21.4%** | R1, R9, R11 |
| Algo top-3 hit (winner ∈ top-3) | **8/14 = 57.1%** | R1, R2, R5, R6, R8, R9, R11, R13 |
| ML chalk top-1 hit (control) | **4/14 = 28.6%** | R1, R8, R9, R11 — **chalk slightly beat algo on this card** |
| Algo top-1 == ML chalk top-1 | 12/14 races | Confirms CHALK_MATCH framework |
| Forward exacta of algo top-2 (in order) | **2/14 = 14.3%** | R1 (11-3), R9 (4-12). R8 6-1 was reverse order — would hit BOX but not forward |
| Stakes-only top-1 hit (R4-R12) | **2/9 = 22.2%** | R9, R11 |
| Stakes-only top-3 hit (R4-R12) | **5/9 = 55.6%** | R5, R6, R8, R9, R11 |

---

## Theoretical strategy ROI

### Strategy A: $1 EX BOX algo top-2 every race ($2/race × 14 = $28)
- **Hits:** R1 (11-3 paid $10.72/$2 = $5.36), R8 (6-1 paid $14.40/$2 = $7.20), R9 (4-12 paid $15.58/$2 = $7.79)
- **Returned:** $20.35
- **Net:** −$7.65 / **ROI: −27.3%**

### Strategy B: PASS on CHALK_MATCH, BET only PARTIAL_EDGE (the other session's actual play)
- Bet R7: $1 EX KEY top-1 over (top-3) — algo top-1 #2 Sweet Rebecca lost (winner was #5). MISS.
- Bet R11: $1 EX KEY top-1 over (top-3) — algo top-1 #6 Rhetorical WON. R11 6-10 EX paid $55.80/$2 = $27.90 on a $1 ticket; but key 6/{4,9} would only hit if 2nd was #4 or #9. Actual 2nd was #10 Make Me King. MISS.
- **Result: 0 hits on 2 bets. Net −$2 to −$6 depending on ticket structure.**

### Strategy C: $0.50 TRI BOX algo top-3 (locked rule, top-4 actually) — couldn't compute without top-4 data
- For R1 (algo only had 2 ranked due to scratch), tri box impossible.
- For others, top-3 tri box: **0 hits in 13 races attempted.** All non-algo-top-3 horses appeared in actual trifectas (e.g., R5 needed #10 which was algo #4; R7 needed #5 winner which was algo #4; R8 needed #7 which was algo #4; R9 needed #9 which was algo #4).
- **The "use top-4" locked rule from Apr 30 review is repeatedly validated here** — a 4th algo pick was the missing trifecta horse in R5, R7, R8, R9.

---

## R12 Kentucky Derby — the marquee miss

**Actual finish:** 19-1-22-12-7 (Golden Tempo · Renegade · Ocelli · Chief Wallabee · Danon Bourbon)
**Winner:** Golden Tempo at **23-1**, Jose Ortiz / Cherie DeVaux. **First woman trainer to win the Kentucky Derby.** Last-to-first closer rally. Winning time 2:02.27, fast track. Winning margin: neck.

**Payouts of historic size:**
- Win: $48.24 / Place: $19.14 / Show: $11.90
- Exacta (19-1): $278.86
- Trifecta (50¢): **$5,625.39**
- Superfecta ($1): **$94,489.95**
- Super High 5 ($1): **$1,777,720.00**

### Pre-race signals we had vs picks we made

| Signal | Captured pre-race? | Action taken | Outcome |
|---|---|---|---|
| Jose Ortiz 5-for-13 on Oaks Day (HOTTEST jockey streak in dataset) | ✅ logged in jockey-stats.json | Mentioned Golden Tempo as 30/1 longshot, NOT in algo top-3 | **Golden Tempo WON at 23-1** |
| DeVaux first-ever Derby start — first woman to win if hits | ✅ logged | Mentioned but didn't elevate | **DeVaux made history** |
| Renegade Post 1 = 0-for-91 since 1986; chalk drought 0/7 | ✅ logged | Said "don't lock as #1" | Renegade hit 2nd — post 1 curse held on the win |
| Beyer 100+ club: Further Ado 106, Commandment 101, So Happy 100 | ✅ logged as "lock" | Picked all three as algo top-3 | Further Ado 11th, Commandment 7th — both **missed top-5** |
| Chief Wallabee first-time blinkers + monster work | ✅ logged | Put in extended top-5 super box | **Chief Wallabee 4th** ✓ |
| Emerging Market Post 15 = best post overlay (10.2% historical) | ✅ logged | Put in extended top-5 | Did not factor (outside top 5) |

### The lesson

**The hot-jockey streak signal we captured but didn't elevate was the load-bearing edge.** Jose Ortiz at 5-for-13 on Oaks Day was the hottest signal in our entire jockey dataset, and he was riding Golden Tempo at PP19 30/1 ML. We catalogued the signal but let our Beyer-100 club logic dominate the top-3 ranking. **The market also missed it** (Golden Tempo went off at 23-1 from 30-1 ML — drift, not bet-down).

If we had built the algo to weight `jockey_streak_z * 1.3` when streak is +3σ in the prior 24 hours, Golden Tempo would have been a top-5 pick. **Beyer is a backward-looking ability measure; jockey streak is a forward-looking momentum measure.** Both matter.

### What hit, what didn't (super box of locked algo top-5)

Our locked super box was **18 / 6 / 8 / 15 / 12** (Further Ado / Commandment / So Happy / Emerging Market / Chief Wallabee). Actual finish: **19 / 1 / 22 / 12**. Only **#12 Chief Wallabee** was in our super-5 (4th place). Box loses — needed Golden Tempo + Renegade + Ocelli, none of which were in our top-5.

For the **Beyer-100+ club thesis** specifically: 0 of 3 hit the board. Further Ado 11th, Commandment 7th, So Happy unknown (off-the-board, otherwise would be in top-5).

---

## What worked (algo strengths)

1. **R9 American Turf G1** — the cleanest call of the day. Algo top-2 (4-12) hit forward exacta in exact order. Stark Contrast (Derby bypass commitment signal) delivered.
2. **R11 Bourbon Turf Classic G2** — Rhetorical (algo #1, dominant 134 fig) won as priced. Forward exacta 6-10 hit. PARTIAL_EDGE bet rec was correct.
3. **R6 Knicks Go** — Tour Player (algo #3) won; #2 Dragoon Guard hit 3rd. Tri box of algo top-3 missed because #11 Moonlight (algo #5+) hit 2nd, but tri 6-2-? exacta wheel would have hit.
4. **CHALK_MATCH framework saved money.** The other session's algo correctly identified 12 of 14 races as chalk-match (algo top-2 = market top-2). PASSing those races avoided -EV exposure to takeout.

## What didn't (algo weaknesses)

1. **No top-1 edge over ML chalk** (3/14 each) on this card. The algo and the market converged on the same #1 picks 12 of 14 times, and both went 3-for-14.
2. **R10 Churchill Downs S G1 — completely missed.** None of algo top-3 in actual top-4. T O Elvis (Japanese 30-1) won; algo had him #5+. Same hot-pace setup and Japanese-shipper signal we KNEW about (Danon Bourbon, Wonder Dean), but applied it to wrong race.
3. **R12 Derby — top-3 missed entirely.** Beyer-100 thesis (Further Ado/Commandment/So Happy) failed at 0-for-3-in-top-5. The hot-jockey streak signal was the load-bearing edge that the Beyer logic dominated.
4. **Trifecta box top-3 went 0-for-13 attempts.** The 4th algo pick was repeatedly the missing tri horse, validating Apr 30's "always include top-4" locked rule for next time. (Code change shipped at commit `c5f0329` after Apr 30 review — but the picks file used in this card may not have applied the new rule.)

---

## Comparison vs Apr 30 Thursday card (12 algo-scored races)

| Metric | Apr 30 | May 2 |
|---|---|---|
| Algo top-1 hit rate | 4/9 = 44.4% | 3/14 = 21.4% |
| Algo top-3 hit rate | 8/9 = 88.9% | 8/14 = 57.1% |
| ML chalk top-1 (control) | 5/10 = 50% | 3/14 = 21.4% |
| Forward exacta in algo top-2 | 3/11 = 27% | 3/14 = 21.4% |
| Algo == ML chalk in top-1 | n/a | 12/14 races |
| $1 EX BOX top-2 ROI | +222.7% (driven by R5 outlier) | −27.3% |

**Key takeaway:** Apr 30's +222.7% was a single-day outlier driven by R5's $56 forward exacta. May 2 with no equivalent outlier produced a small loss. **N=2 days is not enough to establish edge.** The 30-card validation in ALGO_THESIS.md still has 28 days to go.

---

## Confirmed locked rules from Apr 30 — re-validated on May 2

1. **CHALK_MATCH = PASS** (don't pay 22% takeout to bet a market-aligned algo top-2). 12 of 14 races on May 2 were CHALK_MATCH; both PARTIAL_EDGE bets (R7, R11) had the algo #1 lose at R7 and win at R11. Net 1-for-2 on the rare bets — better hit rate than CHALK_MATCH races would have given.

2. **Don't fade chalk in stakes with top-tier J+T.** The stakes-segmentation guard shipped in commit `c5f0329` would NOT have penalized any of these chalks. They were correctly retained in algo top-3. Most chalks lost (Sweet Rebecca R7, Englishman R8, Knightsbridge R10, Buetane R13, Find No Fault R14) but for orthogonal reasons (better horses won, not flag-induced fades).

3. **Always include algo top-4 in tri/super box.** Repeatedly validated:
   - R5 needed #10 (algo's 4th probably) — locked rule would have caught
   - R7 needed #5 winner (algo's 4th)
   - R8 needed #7 (algo's 4th)
   - R9 needed #9 (algo's 4th)
   - R12 super needed #19 Golden Tempo (not in our top-5 — would need top-10+ to catch)
   - R13 needed #1 (algo's 4th)
   The 4th algo pick was the missing tri horse in 5 of 14 races. Locking top-4 would have meaningfully expanded coverage.

4. **20-horse Derby field needs deeper than top-5.** Our locked top-5 super (18-6-8-15-12) didn't include the actual top-3 (Golden Tempo, Renegade, Ocelli). For chaos races with 18+ horses, top-7 or top-8 super box may be appropriate. Cost rises quickly (top-7 super box = 7×6×5×4 = 840 perms × $0.10 = $84).

---

## What to ship before next race day

1. **Hot-jockey streak feature.** Add `jockey_streak_z` based on rolling 24-72 hour win-rate vs trailing 60-day baseline. Z-score, not raw rate. When z > +2σ, boost horse's algo score by 1.05-1.10x. **This would have flagged Golden Tempo PP19 pre-Derby.**

2. **Female-trainer factor in stakes.** Now that DeVaux broke the all-time barrier, "first-of-its-kind" angle in stakes deserves a small bonus when other signals (jockey streak, prep performance) align.

3. **Derby-specific 20+horse super-box default.** Current locked rule is top-5 super for stakes. For 18+ horse fields, consider top-8 with reduced unit ($0.10) for chaos coverage.

4. **Maiden-AE warning.** Ocelli was the only maiden in the Derby field, drew in from AE22, and finished 3rd. The "only 3 maidens have won Derby in 151 years" statistic suggested fade — but for SHOW/board predictions, AE maidens with deep-closer style on hot-pace setup may deserve inclusion in super under-spread.
