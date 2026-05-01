# CD 2026-04-30 — Backtest Report

_Algo v2 (BRIS-rich) picks vs actual results. Updated 2026-04-30 17:00 EST. R1-R7 complete; R8-R12 still upcoming._

## Win-pool performance (R1-R7, excluding R6 Arabian)

| R | Algo #1 | Algo #2 | Algo #3 | Winner | Top-1 | Top-3 | Win $ | Tri $ |
|---|---|---|---|---|---|---|---|---|
| 1 | #1 Banned for Life | #6 You Ain't Poppn | #4 Star's Image | **#4 Star's Image** | ❌ | ✅ | $8.62 | $190.28 |
| 2 | #5 Shared Vision | #2 She'z the Law | #3 Cotillard | **#2 She'z the Law** | ❌ | ✅ | $6.24 | n/a |
| 3 | #5 Spotted | #3 My Secret Dreams | #6 Kopiana | **#2 Fresh Out** | ❌ | ❌ | $15.06 | $583.60 |
| 4 | #8 Theoretical | #3 Devices | #4 Lexico | **#12 Breaking Hearts** | ❌ | ❌ | $14.90 | $416.24 |
| 5 | #3 Jinxzi | #12 Tregetour | #1 Chasing Gray | **#3 Jinxzi** | ✅ | ✅ | $12.78 | $490.16 |
| 6 | _(Arabian — algo skipped)_ | — | — | #4 Diamond Gem AA | — | — | $3.56 | $31.44 |
| 7 | #1 Honfleur | #4 Cape Sounion | #5 Heavenly Melody | **#1 Honfleur** | ✅ | ✅ | $4.12 | $66.16 |

**Top-1 hit rate**: 2/6 = **33.3%** (R5 Jinxzi, R7 Honfleur)
**Top-3 hit rate**: 4/6 = **66.7%**

**$2 WIN bet on top pick all card (R1-R5,R7)**: cost $12.00, returned $16.90, net **+$4.90 (+40.8% ROI)**

## Exotic-ticket performance

Algo's primary exotic recommendation per race vs actual:

| R | Primary play | Cost | Result | Hit? | Return |
|---|---|---|---|---|---|
| 1 | Trifecta key 1/6,4,7/6,4,7 | $3.00 | 4-5-1 (#5 not in unders) | ❌ | $0 |
| 2 | PASS (small field) | $0 | 2-3-5 | — | — |
| 3 | Super 5-box 5-3-6-9-4 | $12.00 | 2-4-3-1 (#2 not in box) | ❌ | $0 |
| 4 | Super 5-box 8-3-4-12-11 | $12.00 | 12-11-3-10 (#10 not in box) | ❌ | $0 |
| 5 | Super 5-box 3-12-1-8-6 | $12.00 | 3-12-6-5 (#5 not in box) | ❌ | $0 |
| 7 | Tri box 1-4-5 | $3.00 | 1-7-5-4 (#7 not in box) | ❌ | $0 |

**Primary exotic plays**: cost $42.00, return $0.00, net **−$42.00**

**However:** R5 ALTERNATE was a `3-12-1 BOX` exacta at $1 = $6.00 → result 3-12 hit → return **$93.48**. Net **+$87.48** if you took the alternate. The algo's top-2 (Jinxzi, Tregetour) called the exacta in the EXACT order. This validates Tweak A's pool-disparity logic — per the algo v2 commit, R5 was the first clean exacta hit of the day.

## Hot signal: exacta-strong races

R5 had `top-2 model_prob = 19.8% + 16.8% = 36.6%`, and the 3-12 exacta paid $93.48. The algo's primary chose a 5-horse super box that missed because of #5 in 4th. **Lesson:** when top-2 cluster ≥35% and the rest of the field is flat, the exacta box is the right primary, not the super-box.

## Still ahead — R8 through R12

| R | Post | Race | Algo #1 | Status |
|---|---|---|---|---|
| 8 | 4:40 PM | Starter Allowance 7f Dirt | #6 Jensco | post passed, awaiting result |
| 9 | 5:14 PM | **Opening Verse S. $350K** 1m Turf | #8 Lagynos | ~now |
| 10 | 5:50 PM | **St. Matthews Overnight S. $200K** 6f Dirt | #2 Built | upcoming |
| 11 | 6:22 PM | **Mamzelle S. $300K** 5 1/2f Turf | #5 Cy Fair | upcoming |
| 12 | 6:53 PM | Maiden Claiming 6f Dirt | #7 Mizzou | upcoming |

Three stakes left — biggest payout potential of the day. Algo's anchors: Lagynos (38%) is the strongest single. Built (30%) has post position #2 inside in a bias-friendly sprint. Cy Fair (28%) is Irad/Weaver in a turf sprint Mamzelle.

## Caveats

- **R6 Arabian**: algo correctly skipped (Tweak: skip Arabian races). Diamond Gem AA was 5/2 chalk and won easily — no edge to chase.
- **R3 Fresh Out at 8/1**: classic anti-chalk hit the algo missed. PP=110.7, Beyer=68. Spotted (algo top, 2/1 ML) finished out of money. Worth adding to the pattern-detector watch list.
- **R4 Breaking Hearts at 5/1**: algo had her at rank 4 (12.1%). She won by daylight. Trainer Cherie DeVaux had her ready — DeVaux is in the new tier list but specialty bonus may need tuning for turf maidens.
