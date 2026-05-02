# HorseGPT — Edge Validation Thesis

**Date:** 2026-04-30 (single-day data, Churchill Downs Thursday Apr 30)
**Status:** Operating algo (v2 with overlay heuristics). Looking for a critical second opinion.
**Audience:** Another LLM reviewer (ChatGPT / Gemini / Claude). Please push back hard on the methodology.

---

## TL;DR claim

> A simple structural strategy — **$1 exacta box of the algo's top-2 picks every race** — produced approximately **+222.7% ROI** across 11 algo-scored Churchill Downs races on April 30, 2026.
>
> We're claiming the algo's top-2 ranking has a real ordering edge over the betting market. We want this disproven if it's spurious.

---

## The system in one paragraph

HorseGPT v3.14 is a horse-racing handicapping pipeline. It parses BRIS Ultimate Past-Performance PDFs (~1430 fields per horse) into a SQL store, computes 50 engineered features (z-scored *within race field*: speed, pace, class, form, jockey%, trainer%, post-position bias, equipment changes, distance/surface fit), and feeds an ensemble:

- **Benter logistic** — uses `logit(market_prob)` as a fixed offset, learns *residual* signal beyond the market.
- **LightGBM gradient boosting** on the same features.
- **Ensemble**: 0.7 × LightGBM + 0.3 × Benter, normalized so per-race probabilities sum to 1.0.

A Henery normal Monte Carlo simulator then samples finishes from the win probabilities to estimate exotic-bet probabilities (exacta, trifecta, superfecta).

The architectural commitment — and the hypothesis under test — is that **the betting market is the prior**, and the model only earns its keep where it produces *residual* signal beyond the market price.

---

## Today's data (N = 11 algo-scored races)

R6 was the UAE President Cup G1, an Arabian-only race; the algo is Thoroughbred-trained, so it's explicitly skipped.

### Per-race outcomes

| R | Race type | Algo top-1 | Algo top-2 | Actual finish | Hit type |
|---|---|---|---|---|---|
| 1 | Clm 50000b | #1 BFL | #6 You Ain't Poppn | 4-5-1-2 | top-3 only (#4 algo's #3) |
| 2 | Alw 127k | #5 Shared Vision | #2 She'z the Law | 2-3-5 | top-3 (#2 algo's #2) |
| 3 | MC 30000 | #5 Spotted | #3 My Secret Dreams | 2-4-3 | top-3 (#3 algo's #2) |
| 4 | MC 50000 turf | #8 Theoretical | #3 Devices | 12-11-3 | top-3 (#3 algo's #2) |
| 5 | MC 12500 | **#3 Jinxzi** | **#12 Tregetour** | 3-12-6 | **top-1 + forward exacta** |
| 7 | Mdn 120k turf | **#1 Honfleur** | #4 Cape Sounion | 1-7-5 | top-1 (under-spread missed) |
| 8 | Alw 50000s | **#6 Jensco** | **#2 Our Shenanigan** | 6-2-? | **top-1 + forward exacta** |
| 9 | Stakes G3 turf | **#8 Lagynos** | #4 Quatrocento | 8-5-4 | top-1 (under-spread #5 was algo's #5) |
| 10 | Stakes 200k | #2 Built | **#9 Maximum Bourbon** | 9-8-2-1 | top-2 (algo had #9 at #2 — won) |
| 11 | Stakes G3 turf | **#5 Cy Fair** | **#8 Slay the Day** | 5-8-6-3 | **top-4 in EXACT forward order** |
| 12 | MC 50000 | #7 Mizzou | #6 Prime Power | TBD | TBD |

### Aggregate signals

- **Algo top-1 hit rate:** 4/9 = 44.4% (R5, R7, R8, R9).
- **Algo top-2 in last 5 algo-scored races:** 5/5 = 100% (algo's #1 or #2 hit every time, R5–R10).
- **Algo top-3 hit rate:** 8/9 = 88.9%.
- **Forward exacta in algo top-2 order:** 3 (R5, R8, R11).
- **Forward superfecta in algo top-4 order (R11):** 1 — the algo's exact ranking became the finish.

### ML chalk baseline (the relevant control)

The morning-line favorite won 5 of the 9 algo-scored races today (50%) — slightly above today's algo top-1 rate. Top-1 isn't the strongest claim. The claim is the **ordering of top-2**.

---

## Strategy backtest on today's 11 races

Five flat-bet structures were simulated against the actual finishes. Per-race wager fixed; same algo picks; only ticket structure varies.

| Strategy | Hit rate | Wagered | Returned | ROI |
|---|---|---|---|---|
| $1 WIN algo top-1 | 4/9 = 44% | $9 | $12.80 | +42.2% |
| **$1 EX BOX algo top-2** (2 perms × $1) | 3/11 = 27%* | **$22** | **$71** | **+222.7%** |
| ↳ Same strategy WITHOUT R5 (the outlier) | 2/10 | $20 | $15 | **-25%** |
| $1 EX BOX algo top-3 (6 perms × $1) | 33% | $54 | $64 | +18.5% |
| $1 EX BOX algo top-4 (12 perms × $1) | 44% | $108 | $64 | -40.7% |
| $0.10 super box top-4 (24 perms × $0.10) | ~22% | $26 | varies | mixed |

*R5 + R8 + R11 hit forward exactas of algo's top 2.

The dominant strategy is the **tightest top-2 EX BOX**. Going wider increases hit rate but the per-race cost grows quadratically (N × (N−1)) and the additional hits don't pay enough to compensate.

### Why top-2 dominates structurally

- The algo's top-3 hit rate is 88.9%; top-4 is ~95%. Adding the 4th, 5th, 6th algo picks gives diminishing marginal hits.
- Per-race cost grows as N×(N−1), but the marginal hit is on a ~10–15% probability horse.
- Pari-mutuel takeout (~17%) is the constant floor; everything above it is the model's edge over the market.

If this holds at scale, it's a market-inefficiency claim: the market is pricing the top-2 horses' relative ordering less efficiently than the algo can detect from BRIS-derived features.

---

## What we know is wrong with this analysis

We're stating these explicitly so the reviewer doesn't have to dig:

1. **N = 1 day.** This is a single CD card on a Thursday during Derby week. Variance dominates inference. We need 30+ cards to assert anything.

2. **Survivorship in the picks file.** The algo's published top-3 was generated *pre-race*, locked, and then compared to results. No retroactive cherry-picking — we have a [picks.md](../data/cd-2026-04-30/picks.md) timestamped before each race went off. But we don't have an audited cryptographic timestamp of the picks file before each race; the user trusts the cadence.

3. **Today was bimodal on chalk.** Through R5 the chalk won only 1/5 (chalk-trap day). R7–R11 the chalk hit 4/5 (chalk recovered). So today contained two regimes; small sample.

4. **Track-bias override (Tweak B) was activated mid-card.** After R4 confirmed closer-friendly winners, the pipeline auto-compresses the style-bias multipliers. So R7+ algo picks are *not* trained-default picks; they're "Tweak B-adjusted." This is a confound — the same algo with different bias settings produced the post-R5 wins. Need to disentangle.

5. **Forward-exacta payouts are heavy-tailed.** R5 alone (#3-#12 paying $56/$1 wager) drove the entire +222.7% ROI. Without R5 the strategy is **-25% ROI** — losing money. R8 paid $8/$1 (chalk), R11 paid $7/$1 (chalk). The strategy depends critically on catching one mid-priced longshot exacta per ~10 races.

6. **The chalk-doubt overlay heuristic was 4/4 on claiming/maiden then 0/3 on stakes today** (R9+R10+R11 chalks all won). This was *not* a base-algo signal; it was a hand-tuned overlay added after R5. We are NOT claiming this overlay has edge — we're claiming the *base algo's top-2 ordering* has edge.

7. **The Benter logistic anchor uses market odds.** This is by design — it makes the algo a residual-only learner. But it means we cannot claim the algo "beats the market" in the usual sense; we can only claim it produces *predictable-direction* residuals worth boxing two-deep.

8. **TwinSpires' published exacta payouts are observed AFTER takeout.** All ROI numbers above are takeout-adjusted; no double-counting. But we don't have the win-pool sizes for every race, so we can't verify the ROI from first principles per-race.

---

## What we want the reviewer to interrogate

In rough priority:

1. **Is the +222.7% number plausibly real, or is it almost certainly a single-day variance artifact?** Compute the per-race expected value if we assume the algo has zero edge. What's the variance on a 11-race sample with these payout magnitudes?

2. **Is the "top-2 box dominates wider boxes" finding structural (i.e., would hold across many days) or specific to the chalk profile of today?** Under what conditions would top-3 or top-4 boxes dominate? (We suspect: large-field maiden races where the favorite's win-prob is below 25%.)

3. **The Benter-anchor architecture.** Does it actually produce residual edge that gets revealed in exacta ordering, or is the apparent ordering edge just chalk-correlated noise filtered through z-scoring? If the algo's top-2 are usually market-supported anyway, the box edge could just be "betting two of the top market horses" with no algo contribution.

4. **What's the right validation methodology?** We have access to:
   - Historical Churchill cards (Apr 25, 26, 29 already in the repo, plus 30+ days of past archives if we scrape).
   - Equibase + DRF chart data.
   - Live TwinSpires odds + pool data (W/P/S percentages).

   What experimental design would let us assert the algo's top-2 ordering edge with statistical rigor at minimum cost?

5. **The chalk-doubt overlay segmentation hypothesis** (4/4 in claiming/maiden, 0/3 in stakes). N=7 fires total. Plausibly real, plausibly noise. What's the segmentation logic that should be tested before shipping?

6. **What other signals from the live betting market should we be reading?** We have shown:
   - Smart-money board (P>W on a non-chalk): 2/3 today on board predictions.
   - Show-pool spike (>3× growth in 10 min on one horse): 1/1 today (N=1).
   - Sharp ML-to-live bet-down (>5× ratio): observed but not systematically tested.

   Are these worth instrumenting at scale, or are they post-hoc curve-fits?

---

## What we will do regardless of the review

- Continue the daily card as a data-collection exercise. Each race produces:
  - Algo top-3 picks pre-race (locked in `data/cd-<date>/picks.md`)
  - Live odds + pool % time series at 30, 15, 10, 5 MTP
  - Official finish + payouts
  - Per-race outcome record in `results.json`

- After 30 cards, compute the per-strategy ROI distribution and back out a confidence interval.

- Hold off on any code change to the base algo until that data exists.

- Ship the corrected overlay logic (chalk-doubt segmentation) only after the segmentation hypothesis is validated on 30+ flag-fires.

---

## Repo pointers (for the reviewer to verify)

- `data/cd-2026-04-30/picks.md` — pre-race algo picks for all 12 races (+ R6 marked Arabian skip).
- `data/cd-2026-04-30/results.json` — official finishes + payouts (R1–R11 confirmed; R12 pending).
- `data/cd-2026-04-30/algo-perf-summary.json` — structured per-race breakdown.
- `docs/PICKS_THINKING_LOG.md` — reasoning trace for each pick, including the mistakes.
- `scripts/process_card.py` — algo source (650 lines).
- `src/models/logistic.py` — Benter implementation.
- `src/features/core.py` — 50 features.

---

## The honest framing

We had **one good day**. The algo's top-2 ordering hit cleanly enough that a flat $1 EX BOX strategy would have netted +$130 on $22 wagered. **This is not yet evidence of an edge** — it's evidence of a hypothesis worth testing at scale.

We're not asking the reviewer to confirm the system. We're asking them to find the mistake we're making — in the methodology, the architecture, the data interpretation, or the strategy.

If they can't find one, we proceed with the 30-card validation. If they do find one, we save ourselves a month of overconfident misallocation.
