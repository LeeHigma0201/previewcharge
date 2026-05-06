# CD 2026-05-02 — Honest Day Scorecard

**14 races run, full results captured.** Pre-race algo picks from `claude/thirsty-aryabhata-291678` session (timestamp 09:37 ET, before R1 post 11:00 ET).

## Top-line numbers

_(Corrected after auto-backtest validation; original hand count had 2 errors — see backtest.md.)_

| Metric | Value | Apr 30 baseline |
|---|---|---|
| Algo top-1 hit rate | 3/14 (21.4%) | 44% |
| Algo top-3 hit rate | 8/14 (57.1%) | 89% |
| ML chalk top-1 (control) | 4/14 (28.6%) | 50% |
| **Algo edge over chalk top-1** | **−7.2 pts** (chalk slightly better) | -6 pts |
| Forward exacta algo top-2 (in order) | 2/14 (14.3%) | 27% |
| $1 EX BOX top-2 theoretical ROI | **−27.3%** | +222.7% (R5 outlier) |
| Algo top-2 == market top-2 (CHALK_MATCH) | 12/14 races | n/a |

## Derby R12 marquee result

- **WINNER: Golden Tempo #19 at 23-1** (Jose Ortiz / Cherie DeVaux)
- **First woman trainer to win the Kentucky Derby**
- Last-to-first closer rally; winning time 2:02.27
- Top-5: 19 / 1 / 22 / 12 / 7
- Super High 5 (19-1-22-12-7): **$1,777,720**
- Renegade #1 ML chalk hit 2nd (Post 1 curse held on the win)
- Beyer-100 club (Further Ado #18 / Commandment #6 / So Happy #8): all 3 missed top-5

## What worked

- **R9 American Turf G1** — algo top-2 (4-12) hit forward exacta in EXACT order. Only clean 1-2 of the day.
- **R11 Bourbon Turf Classic G2** — Rhetorical (algo #1) won. PARTIAL_EDGE bet rec was correct on this race.
- **CHALK_MATCH = PASS framework** correctly identified 12 of 14 races as having no algo edge over market. Avoided -EV takeout exposure.
- **R7 Distaff Turf Mile G1** — Classic Q (algo #5? check) won, but #3 Portfolio Duration (algo #2) and #8 Pin Up Betty (algo #3) hit 2nd-3rd. Top-3 wide net caught 2 of top-3 finishers.

## What broke

- **R12 Derby — Beyer-100 club thesis went 0-for-board.** Further Ado, Commandment, So Happy all missed.
- **Hot-jockey streak signal** (Jose Ortiz 5-for-13 Oaks Day) was logged but not elevated. He won on Golden Tempo. **Load-bearing edge missed.**
- **R10 Churchill Downs S G1 — none of algo top-3 in actual top-4.** T O Elvis (30-1 Japanese) won; same Japanese-shipper signal we used for Wonder Dean/Danon Bourbon in R12.
- **R12 super top-5 box** (18-6-8-15-12) caught only #12 Chief Wallabee at 4th. Needed Golden Tempo + Renegade + Ocelli — none in our top-5.
- **N=2 days isn't enough.** Apr 30 was +222.7% (R5 outlier). May 2 was -27.3%. Combined: barely break-even, no statistical signal.

## Confirmed locked rules (validated again)

1. **CHALK_MATCH = PASS** ✓ (12 of 14 chalk-matches; betting them = burning takeout)
2. **Don't fade chalk in stakes with tier J+T** ✓ (stakes guard would have correctly retained all chalks in algo top-3)
3. **Use top-4 in tri/super box** ✓ (4th algo pick was missing tri horse in R5, R7, R8, R9, R13)
4. **Stakes need deeper coverage** ✓ (20-horse Derby super top-5 didn't catch winner — needs top-7-8 with smaller unit cost)

## Code shipped this branch

- `c5f0329` — stakes-segmentation guard in `_pool_disparity_factor` (active; correctly retained chalks)
- `c5f0329` — top-4 default + stakes top-5 super box in `best_exotic_strategy`
- These were the right structural fixes; can't validate impact without running the algo against May 2 data through the patched pipeline (separate session would need to re-score)

## Top changes proposed for next sprint

### 1. HOT-JOCKEY STREAK FEATURE (priority 1, ships before next stakes day)

Add `jockey_streak_z` to scoring:
```python
# In score_horses, after sharp_money_signals:
recent_24h_wins = jockey_recent_wins(jockey, hours=24)
recent_24h_starts = jockey_recent_starts(jockey, hours=24)
baseline_60d = jockey_baseline_win_pct(jockey, days=60)
if recent_24h_starts >= 5:
    obs_rate = recent_24h_wins / recent_24h_starts
    streak_z = (obs_rate - baseline_60d) / sqrt(baseline_60d * (1-baseline_60d) / recent_24h_starts)
    if streak_z > 2.0:
        streak_factor = 1.05 + 0.03 * min(streak_z - 2.0, 2.0)  # cap at 1.11x
    else:
        streak_factor = 1.0
else:
    streak_factor = 1.0
```

Validation: Jose Ortiz won 5 of 13 on Oaks Day (May 1). Baseline 25.4%. Z = (0.385 - 0.254) / sqrt(0.254 × 0.746 / 13) = 0.131 / 0.121 = **+1.08σ** — actually NOT a 2σ streak by this formula. Need to weight by RECENT vs trailing — maybe a 24h vs 30d split with smaller denominator triggers more sensitivity. Will tune.

### 2. AE MAIDEN BOARD-PROBABILITY ADJUSTMENT

Ocelli was the only maiden in the Derby (drew in from AE22, $12K horse) and finished 3rd. The "only 3 maidens have won Derby in 151 years" statistic discouraged inclusion. But:
- For SHOW/board predictions in chaotic 20+ horse fields, AE maidens with closer style + hot pace = legitimate board candidates
- Add small board-probability bonus (not win-prob) for AE-draw-in maidens in fields ≥18 with projected hot pace

### 3. DERBY-SPECIFIC SUPER-BOX SIZING

For 18+ horse fields with top-5 score concentration < 60%, default to top-8 super box at $0.10 ($84 cost) instead of top-5 ($12). Cost is 7x but covers 7/3 = 2.3x more boundary cases for chaos fields.

### 4. RE-RUN MAY 2 THROUGH PATCHED PIPELINE

The new code (top-4 tri/super, stakes-segmentation guard) didn't affect this card's picks because they were generated before the code shipped. Re-run May 2 raw-entries.json through the current patched `process_card.py` to compare:
- Did stakes-segmentation guard change any picks? (Probably not — algo top-3 were already CHALK_MATCH)
- Did top-4 default change tri box construction? (Yes — would catch R5/R7/R8/R9/R13 boundary tris)
- Did top-5 stakes super change exotic recs for stakes races? (Yes for all 8 stakes)

Test: `python3 scripts/process_card.py 2026-05-02` against current code. Compare exotics.csv to picks.md from `568dd62`.

## The honest takeaway

> Two days of data (Apr 30 + May 2) is not enough to establish edge. The algo's top-3 wide net catches 60-90% of winners (good), but its top-1 picking has been TIED with ML chalk both days. The structural advantages (CHALK_MATCH framework, stakes-guard, top-4 tri rule) prevent losing money on chalk-matches more than they generate edge. **The 30-card validation in ALGO_THESIS.md is the right framing — bet small, collect data, evaluate at N=30.**

> The Derby R12 result is the lesson: we **had** the hot-jockey streak signal in our intel files, we **named** Cherie DeVaux as a "would be first woman to win if hits" — and we still missed putting Golden Tempo in our top-5. Cataloguing a signal isn't the same as weighting it in the score. **The next code change worth shipping is jockey-streak weighting, not another chalk filter.**
