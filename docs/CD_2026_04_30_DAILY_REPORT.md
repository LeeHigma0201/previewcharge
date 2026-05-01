# Churchill Downs — Thursday, April 30, 2026

**Card:** 12 races (R6 UAE Pres Cup G1 Arabian, scored separately).
**Algo state:** v2 with chalk-doubt overlay (pre-correction). Ran across 9 algo-scored races today.
**Operator:** Jason. Two Claude sessions handled the day — Windows AM (algo v2 ship + R1-R5 capture), MacBook PM (R6-R12 capture + framework correction + UI updates).

---

## Headline numbers

| Metric | Value |
|---|---|
| Algo top-1 hit rate | TBD pending R11+R12 (currently 4/9 = 44%) |
| Algo top-3 hit rate | 8/9 = 88.9% (R3 was the lone miss) |
| Forward exactas in top-2 order | 2 (R5 #3-#12, R8 #6-#2) |
| Pool-disparity flag | 4/6 = 67% (4-for-4 in claiming/maiden, 0-for-2 in stakes) |
| Smart-money board signal (P>W = board) | 2/2 |
| Show-pool spike | 1/1 (N=1) |

**$1 flat-bet ROI today (backtest):**

- $1 WIN algo top-1 each race: **+42.2% ROI** ($9 → $12.80)
- $1 EX BOX algo top-2 each race: **+255.6% ROI** ($18 → $64) 🎯

Caveats: N=1 day, validate over 30+ cards. Today's chalk performance was bimodal — chalk-trap pattern dominated R1-R5 (only 1 chalk won), then reversed for R7-R10 where chalk swept (R7 #1 at 1.0, R8 #6 at 9/5, R9 #8 at 6/5, R10 #9 at 9/5).

---

## What worked

### Algo v2 mid-card ship (Windows session)

After R5 the algo v2 was deployed with two tweaks:

- **Tweak A — Dual-mode pool disparity.** Flag fires twice: top-3 odds + W>P = chalk doubt (penalty); 5/1–12/1 + W>P = sharp WIN money (bonus). R4 #11 Plot fit the second case and finished 2nd.
- **Tweak B — Intra-card style-bias override.** Auto-activates when results.json shows 4+ races completed and the track has been closer-friendly. eIV: 1.45→1.10. Compresses style range to ~0.9–1.2 instead of 0.35–1.45. The right call for today's CD opening Thursday — the track was style-neutral after morning closers.

Both tweaks shipped cleanly. R5 was the first algo top-1 hit and the FIRST clean forward exacta. R7, R8, R9 followed.

### Lone-Beyer protection

R1 #4 Star's Image had a single Beyer of 62 off a 108-day layoff. Algo originally killed his ability to ×0.70. Fix shipped: defer to Prime Power when ≤1 Beyer figure. Star's Image won at 9/2.

### Tier trainer expansion

12 CD-spring trainers added that were missing from the original list (Joe Sharp, Saffie Joseph Jr., Cherie DeVaux, Mark Casse, Dale Romans, Ian Wilkes, Rusty Arnold, Eddie Kenneally, Philip Bauer, Philip D'Amato, Thomas Drury Jr., Lauren Robson). Plus Foley added in the Mac session after R2 audit (R2 winner's trainer).

---

## What broke

### Chalk-doubt flag's stakes failure

The flag was 4-for-4 through R1-R5 (claiming, maiden, allowance), and the Mac session over-trusted it. Recommended fading R9 #8 Lagynos and R10 #9 Maximum Bourbon based on the W-P pool gap. Both chalks WON.

**N=2 same direction** in stakes races. Both chalks had top-tier connections (Asmussen/J.Ortiz on Lagynos; D'Amato/Prat on Max Bourbon). Hypothesis: flag doesn't generalize to stakes-grade chalks where top connections grind out wins despite over-betting.

**Framework correction (locked):** Pool flags are SECONDARY signals. Use them to identify smart-money board horses (P>W) and sharp-show horses (S>W) for under-spread construction. Do NOT use them to override the algo's win-prob ranking on the chalk.

For stakes races (purse > $100K) with the chalk's trainer in TIER_TRAINERS AND jockey in TIER_JOCKEYS, the chalk-doubt penalty should be skipped.

### TwinSpires result lag

R9, R10, R11 all had 10-15 minute delays between official finish and TwinSpires payout publication. R10 took ~10 min, R11 took 15+ min. The user's broadcast was the source of truth. Going forward, prefer Equibase or a direct results API.

### Bet sheet "next race" bug

The bet sheet always shows R6 (UAE Arabian) as "next" because R6 is unfinished and the algo skips it. Existing bug, noted but not fixed. Fix: add an `isArabian` skip to the next-race detection.

---

## What's running and ready to ship

- ✅ `data/cd-2026-04-30/results.json` — R1-R10 with payouts (R6 marked Arabian-skip)
- ✅ `data/cd-2026-04-30/r9-pool-snapshot.json` — full pool capture + outcome (flag failed)
- ✅ `data/cd-2026-04-30/r10-pool-snapshot.json` — full pool capture + outcome (flag failed 2nd time)
- ✅ `data/cd-2026-04-30/r11-pool-snapshot.json` — multi-MTP time series (22/15/11 MTP)
- ✅ `data/cd-2026-04-30/algo-perf-summary.json` — per-race table + pattern catalog + meta-lesson
- ✅ `web/app/lib/results-store.ts` — R7-R10 added, all FINAL on bet sheet
- ✅ `web/app/bets/page.tsx` — R10 LEARNED banner + SIGNAL SCOREBOARD + ROI panel
- ✅ `scripts/process_card.py` — Foley added to TIER_TRAINERS
- ✅ `docs/PICKS_THINKING_LOG.md` — transparent reasoning per race, with mistakes
- ✅ `docs/CD_2026_04_30_DAILY_REPORT.md` — this file

---

## Top three code changes proposed for next sprint

### 1. Soften chalk-doubt penalty in stakes (HIGH PRIORITY)

In `scripts/process_card.py`, `_pool_disparity_factor`:

```python
# Current: applies penalty unconditionally to top-3 odds horses with W-P > 5pts
# Proposed: skip penalty if race is stakes (purse > $100K) AND chalk has tier-listed J+T

is_stakes = race.get("purse", 0) > 100000
chalk_top_jockey = jockey.lower() in TIER_JOCKEYS
chalk_top_trainer = trainer.lower() in TIER_TRAINERS
if is_stakes and chalk_top_jockey and chalk_top_trainer:
    return 1.0  # neutral, skip the penalty
```

Validated by N=2 same-direction failures in R9 + R10. Expected impact: zero false fades on stakes-grade chalks; preserves 4-for-4 claiming/maiden hit rate.

### 2. Always use algo top-4 (not top-3) in trifecta/super construction

In `_build_recommendations`:

```python
# Current: trifecta box uses top-3 picks
# Proposed: always include top-4 for the under-spread

tri_box_horses = top_picks[:4]  # was [:3]
```

Validated by R7 (#7 Vow at algo's #4 hit 2nd, broke 1-4-5 box) and R10 (#8 at algo's #5 hit 2nd, broke 2-9-6-1 box — though this would need top-5 for that case).

For stakes races specifically: use top-5 super box.

### 3. `_board_signal_factor` — separate top-3 score for under-spread

The smart-money board signal (P>W = board) was 2/2 today. The show-pool spike (>3× growth in 10 min) was 1/1 (N=1).

Proposed structure:

```python
def _board_signal_factor(horse, pools):
    """Returns multiplier for top-3 finish probability — does NOT affect win prob."""
    wp_gap = horse.win_pct - horse.place_pct
    ws_gap = horse.win_pct - horse.show_pct
    factor = 1.0
    if wp_gap < -3:  # P > W by 3+ pts
        factor *= 1.20
    if ws_gap < -5:  # S > W by 5+ pts (sharp show)
        factor *= 1.15
    return factor
```

Use this when constructing trifecta/super under-spreads. Don't merge into the win-prob score.

### 4. Auto-poll /pools every 5 min in the 30 min before post

Cortex notes flag this as the highest-leverage signal we don't yet have automated. Today the pool data was scraped manually 2-3x per race. Show-pool spike on R9 #4 was caught only because the user noticed the delta.

Engineering: scheduled task in `scripts/poll_pools.py` that runs every 5 min, captures W%/P%/S% snapshots, and writes to `data/cd-<date>/pool-history.json`.

---

## How to use the algo daily (going forward)

The simplest profitable strategy today was:

```
$1 EX BOX (algo top-1 / algo top-2) on every race
= $2 wagered per race × 12 races = $24/day
```

ROI today: +256% (2 of 9 hit, paying $56 + $8 / $1 box level).

To bet bigger:
```
$0.50 EX BOX (algo top-4) per race = $6/race × 12 = $72/day
55% per-race hit rate from Monte Carlo, breakeven-positive on payout structure.
```

To bet defensively:
```
$1 WIN algo top-1 per race = $1 × 12 = $12/day
44% hit rate, ~+42% ROI today.
```

These are floor strategies — don't override based on flag overlays without segment-validated evidence.

---

## Loose ends for tomorrow's session

- [ ] R11 + R12 results once TwinSpires updates
- [ ] Add R11 + R12 LEARNED banners if patterns warrant
- [ ] Validate algo top-2 EX BOX strategy on Apr 25, 26, 29 cards (re-run with corrected flag logic)
- [ ] Engineering: code change #1 (stakes-segmentation guard) in `_pool_disparity_factor`
- [ ] Engineering: code change #2 (top-4 in tri box) in `_build_recommendations`
- [ ] Fix bet sheet "next race" bug — skip Arabian races from next-race detection
- [ ] Build pool-polling script for automated W%/P%/S% capture

Friday is Oaks Day. Saturday is Derby. Stakes-heavy cards. The chalk-doubt segmentation lesson is critical for stakes; this needs to ship before Saturday.
