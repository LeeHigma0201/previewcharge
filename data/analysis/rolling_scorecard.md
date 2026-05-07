# HorseGPT Rolling Scorecard

**Cards in validation:** 2 of 30 target (per [ALGO_THESIS.md](../../docs/ALGO_THESIS.md))
**Last updated:** 2026-05-03 after Derby 152 (CD 5/2) auto-backtest in commit `71309d4`

This is the running tally for the 30-card validation. Add a row each card; numbers are corrected after `scripts/run_backtest.py` validation.

---

## Per-card summary

| Card | Races | Algo top-1 | Algo top-3 | ML chalk top-1 | Edge vs chalk | Fwd exacta | $1 EX BOX top-2 ROI |
|---|---|---|---|---|---|---|---|
| CD 2026-04-30 | 9 (excl R6 Arabian, R12 unscored) | 4/9 = 44.4% | 8/9 = 88.9% | 5/10 = 50.0% | -5.6 pts | 3/11 = 27.3% | +222.7% (R5 outlier) |
| CD 2026-05-02 | 14 | 3/14 = 21.4% | 8/14 = 57.1% | 4/14 = 28.6% | -7.2 pts | 2/14 = 14.3% | -27.3% |
| **Cumulative** | **23** | **7/23 = 30.4%** | **16/23 = 69.6%** | **9/24 = 37.5%** | **-7.1 pts** | **5/25 = 20.0%** | **mixed** |

---

## What we know after 2 cards

1. **Algo top-1 is trailing ML chalk** by ~7 points. The CHALK_MATCH framework correctly says: when algo and chalk converge (12 of 14 races on 5/2), don't pay 22% takeout to bet what the market already covers.

2. **Algo top-3 wide net is reliable** at ~70% (winner caught in algo top-3 about 7 of 10 times). Useful for board predictions and tri box construction.

3. **The +222.7% Apr 30 ROI was driven by ONE race** (R5 Jinxzi $56 forward exacta). Removing R5 → -25% ROI on 10 races. **N=2 days plus an outlier-driven Day 1 isn't a signal.**

4. **Forward exacta hit rate is ~20%** — a real but modest edge. The TRI BOX top-3 went 0-for-13 on 5/2 because the 4th algo pick was repeatedly the missing horse (validates the locked top-4 rule shipped at `c5f0329`).

5. **Two structural fixes locked from these 2 cards** (now coded + tested in PR #8):
   - Stakes-segmentation guard (don't fade tier-J+T chalks in stakes pool-disparity flags)
   - Top-4 default for tri/super, top-5 for stakes super box

6. **One ship-pending feature** (Derby 152 load-bearing miss):
   - `jockey_streak_z` — function shipped at `3db54b6`, awaiting data feed via agent-dispatch

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
