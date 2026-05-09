# HorseGPT Rolling Scorecard

**Cards in validation:** 3 of 30 target (per [ALGO_THESIS.md](../../docs/ALGO_THESIS.md))
**Last updated:** 2026-05-03 — Apr 25 backtest extracted from existing data/cd-2026-04-25/backtest.md + ML chalk computed by parsing picks.md

This is the running tally for the 30-card validation. Add a row each card; numbers are corrected after `scripts/run_backtest.py` validation.

---

## Per-card summary

| Card | Races | Algo top-1 | Algo top-3 | ML chalk top-1 | Edge vs chalk | Fwd exacta | $1 EX BOX top-2 ROI |
|---|---|---|---|---|---|---|---|
| CD 2026-04-25 | 10 | 5/10 = 50.0% | 9/10 = 90.0% | 6/10 = 60.0% ¹ | -10.0 pts ¹ | n/a (limited-data card) | n/a (top picks $2 WIN: +38.7%) ² |
| CD 2026-04-30 | 9 (excl R6 Arabian, R12 unscored) | 4/9 = 44.4% | 8/9 = 88.9% | 5/10 = 50.0% | -5.6 pts | 3/11 = 27.3% | +222.7% (R5 outlier) |
| CD 2026-05-02 | 14 | 3/14 = 21.4% | 8/14 = 57.1% | 4/14 = 28.6% | -7.2 pts | 2/14 = 14.3% | -27.3% |
| **Cumulative** | **33** | **12/33 = 36.4%** | **25/33 = 75.8%** | **15/34 = 44.1%** ³ | **-7.7 pts** | **5/25 = 20.0%** | **mixed** |

¹ Apr 25 ML chalk computed 2026-05-03 via inline parser of picks.md (chalk = lowest ML per race), cross-referenced with backtest.md winners. Not in original Apr 25 backtest.md.
² Apr 25 backtest.md: "$2 WIN bet on top pick all card: cost $20.00, returned $27.74, net +$7.74" = +38.7% ROI. **Limited-data mode** (no Beyer / Prime Power / class data); algo essentially fell back to ML chalk so the +ROI partially mirrors the day's chalk-heavy pattern.
³ Cumulative chalk denominator is 34 (not 33) because Apr 30 chalk was tracked over 10 races including R6 Arabian; algo only scored 9.

---

## What we know after 3 cards

1. **Algo top-1 is trailing ML chalk by 7-8 points.** CHALK_MATCH=PASS framework correctly tells us not to pay 22% takeout to bet a market-aligned algo top-2 — and now confirmed across 3 cards. The algo and the market converge frequently; on those races, the math says PASS.

2. **Apr 25 was an outlier day (heavy chalk).** Limited-data mode meant the algo had no Beyer / Prime Power / class signal, so it essentially defaulted to ML chalk. The 50% top-1 and 90% top-3 reflect ML structure more than algo skill — note ML chalk hit 60% the same day. Treat this card as a baseline anchor, not a signal day.

3. **Algo top-3 wide net is robust** at 76% across 33 races (was 70% after 2 cards). Reliable for board predictions and tri box construction.

4. **Win-betting ROI is mixed.** Apr 25 +38.7% (chalk-heavy day, fell back to chalk), Apr 30 +222.7% (R5 outlier), May 2 -27.3%. Excluding outliers: mostly negative or break-even. **N=3 days is still not a 30-card signal.**

5. **Forward exacta hit rate ~20% across cards** — modest edge. The TRI BOX top-3 went 0-for-13 on 5/2 because the 4th algo pick was repeatedly the missing horse (validates the locked top-4 rule shipped at `c5f0329`).

6. **Three structural fixes locked from these 3 cards** (now coded + tested in PR #8):
   - Stakes-segmentation guard (don't fade tier-J+T chalks in stakes pool-disparity flags) — Apr 30 R9/R10/R11 lesson
   - Top-4 default for tri/super, top-5 for stakes super box — Apr 30 R7 + May 2 R5/R7/R8/R9 boundary cases
   - Jockey_streak_z function (awaiting data feed) — May 2 Derby 152 load-bearing miss

7. **Apr 25's chalk-heavy pattern + May 2's chalk-trailing pattern suggest:** algo edge will only emerge on cards where the market is actually wrong about the chalk. Look for races where algo top-2 disagrees with market top-2 (PARTIAL_EDGE or FULL_EDGE in the framework). On the 12-of-14 May 2 chalk-match races, neither algo nor chalk had edge.

---

## What I expect by N=10

If algo continues trailing chalk by 5-7 points on top-1, the Stage-1 ability model has no demonstrable edge over the public on win betting. The strategy must be:

- **PASS chalk-match races** (12 of 14 on 5/2). Avoid -EV exposure.
- **BET PARTIAL_EDGE / FULL_EDGE races** (the 2 of 14 where algo disagrees with market). Expand sample size for these.
- **Tri/super box top-4** when algo has score concentration. The forward-exacta + boundary-tri edge is where small +EV exists.

Expect to revise this judgment at N=10 (8 cards from now). If algo top-3 wide-net stays at 70%, that's bankable for board/exotic wide construction. If algo top-1 stays at chalk-parity, win betting is a wash.

---

## Cards still needed for the 30-card validation

| Tier | Cards | Notes |
|---|---|---|
| April 25 (CD opening) | 1 | Has cd-2026-04-25 folder — check if processable |
| April 26 (CD) | 1 | Has folder |
| April 29 (CD) | 1 | Has folder |
| April 30 (CD Thursday) | ✓ done | 9 algo-scored races |
| May 1 (CD Oaks Day) | 1 | NOT in repo yet — would need scrape |
| May 2 (CD Derby) | ✓ done | 14 races |
| May 3 onwards | ~25 | Future races |

Closest 5 cards to validation are already in `data/cd-*` folders (Apr 25, 26, 29, Apr 30, May 2). If we can rebuild backtests for the 3 earlier cards (markdown picks parser needed since they don't have JSON-form picks files), we'd jump from N=2 to N=5 immediately.

---

## How to update this file

Each new card:

1. After race day, ensure `data/cd-<date>/results.json` exists (scrape via agent if needed).
2. Ensure `web/app/lib/cd-<date>-picks.json` exists (run `process_card.py` or pull from the race-day session's branch).
3. Run `python3 scripts/run_backtest.py <date>` → produces `backtest_auto.md`.
4. Append a row to the per-card table here. Recompute cumulative.
5. Update "what we know" section if the trend shifts meaningfully.
6. Commit with a "Rolling scorecard +1 card" message.

The auto-tool is exact and replaces hand-counting (which had errors on May 2). Future card analyses should take ~2 minutes total.
