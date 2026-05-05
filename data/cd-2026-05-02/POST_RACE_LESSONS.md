# Derby 152 Post-Race Lessons — 2026-05-03

Durable lessons from Saturday May 2, 2026. Apply to next race day (Preakness May 16; Belmont; or any 18+ horse stakes).

---

## The single load-bearing miss: Hot-jockey streak signal

We **had** the data. We **logged** it. We **named** the historic angle. We **did not weight it.**

| What we knew (saved in jockey-stats.json on May 1) | What we did | What happened |
|---|---|---|
| "Jose L. Ortiz — 5-for-13 on Oaks Day (5/1) including Kentucky Oaks G1 — hottest streak in dataset" | Mentioned Golden Tempo PP19 30-1 as longshot, not in algo top-3 | **Jose Ortiz won the Derby on Golden Tempo at 23-1** |
| "DeVaux first ever Derby start — first woman trainer to win if hits" | Mentioned but didn't elevate | **Cherie DeVaux made history as first woman trainer to win KY Derby** |

**Cataloguing a signal isn't the same as weighting it.** Our algo top-3 was driven by the Beyer-100 club (Further Ado 106, Commandment 101, So Happy 100). Beyer is a **backward-looking ability measure**. Jockey streak is a **forward-looking momentum measure**. Both matter; we let one dominate.

### Code change to ship before Preakness

`jockey_streak_z` feature in `score_horses` ([scripts/process_card.py](../../scripts/process_card.py)):

```python
def _jockey_streak_factor(jockey_name: str, recent_hours: int = 24, baseline_days: int = 60) -> float:
    """Boost score when jockey is on a hot streak.

    Validation lens: Jose Ortiz 5-for-13 Oaks Day baseline 25.4% national.
    Z-score the recent rate against baseline binomial variance:
        z = (obs_rate - baseline) / sqrt(baseline * (1-baseline) / n)
    Boost when z > 2σ. Cap at +11%.
    """
    recent = jockey_recent_record(jockey_name, hours=recent_hours)  # {wins, starts}
    baseline = jockey_baseline_win_pct(jockey_name, days=baseline_days)
    if recent["starts"] < 5 or baseline is None:
        return 1.0
    obs_rate = recent["wins"] / recent["starts"]
    if baseline >= 1.0 or baseline <= 0:
        return 1.0
    se = math.sqrt(baseline * (1.0 - baseline) / recent["starts"])
    if se == 0:
        return 1.0
    z = (obs_rate - baseline) / se
    if z <= 2.0:
        return 1.0
    return min(1.11, 1.05 + 0.03 * (z - 2.0))
```

Wire into `score_horses` after `_sharp_money_signals`:
```python
streak_factor = _jockey_streak_factor(h.get("jockey", ""))
adj_score = ... * streak_factor  # multiply alongside other factors
```

Need a data source for `jockey_recent_record` and `jockey_baseline_win_pct` — Equibase blocks (403); HRN exposes recent results. Could feed via the agent-dispatch pattern (one agent: "fetch last 7 days race results for jockey X, return wins/starts").

---

## What worked + what we kept

### Confirmed locked rules (re-validated on May 2)

1. **CHALK_MATCH = PASS** ✓ The other session's algo correctly identified 12 of 14 races as `algo top-2 == market top-2` and PASSed. Avoided -EV exposure to 22% takeout. Both PARTIAL_EDGE bets (R7 Sweet Rebecca, R11 Rhetorical) — R11 won, R7 lost. Net 1-of-2 with positive EV on Rhetorical.

2. **Don't fade chalk in stakes with tier J+T** ✓ Stakes-segmentation guard ([commit c5f0329](../../scripts/process_card.py)) was active. No chalk-doubt penalties applied to Renegade, Commandment, Further Ado, Knightsbridge, Rhetorical, etc. Most chalks lost — but for orthogonal reasons (better horses won), not for flag-induced fades.

3. **Use top-4 in tri/super box** ✓ The 4th algo pick was the missing tri horse in 5 of 14 races (R5 #10 Joe Shiesty, R7 #5 Classic Q winner, R8 #7 Crown the Buckeye, R9 #9 Honey Dutch, R13 #1 Small Town). Locked rule shipped at [c5f0329](../../scripts/process_card.py:443) but didn't apply to this card's picks (generated before the patch).

4. **Stakes need top-5 super box** ✓ Mostly. **EXCEPT for 18+ horse fields** — top-5 super was insufficient for Derby's 20-horse chaos. Super top-5 (18-6-8-15-12) caught only #12 Chief Wallabee at 4th. Needed Golden Tempo + Renegade + Ocelli — none in our top-5.

### What worked structurally

- **R9 American Turf G1** — algo top-2 (4-12 Stark Contrast / Remember Mamba) hit forward exacta in EXACT order. Cleanest call of the day.
- **R11 Bourbon Turf Classic G2** — Rhetorical algo #1 won as priced; 6-10 forward exacta hit.
- **Top-3 wide net** — winner in algo top-3 = 8 of 14 races (57%). For board-finish predictions and tri box construction, the wide net is reliable.

---

## What broke + what to fix

### 1. R12 Derby Beyer-100 thesis went 0-for-the-money

**Hypothesis tested:** "Beyer 100+ in final prep is a strong filter — Further Ado 106, Commandment 101, So Happy 100 are the algo top-3 lock."

**Result:** Further Ado 11th, Commandment 7th, So Happy off-board. **0-for-3 in top-5.**

**Why:** In a 20-horse field with brutal pace pressure, raw Beyer figures don't differentiate enough. The closer-bias of Derby (35% of last 20 winners were closers) wasn't captured by the Beyer filter — Golden Tempo's running style (deep closer) and Jose Ortiz's hot hand were the differentiators.

**Fix:** Don't treat Beyer-100 as a hard filter. Use it as ONE input among many. Specifically, in the Derby/Belmont context (1 1/4M+ classic distance with 18+ horses), weight running style and recent-form momentum higher than peak Beyer.

### 2. R10 Churchill Downs S G1 — algo top-3 missed entirely

T O Elvis (Japanese 30-1, Takayanagi/Sakai) won. Algo top-3 was 6-2-1 (Knightsbridge, Cornucopian, Disco Time). None in actual top-4.

**Why:** Same Japanese-shipper signal (deep stamina pedigree, hot pace setup, closer style) we **noted** for Wonder Dean and Danon Bourbon in R12 — but didn't apply to T O Elvis in R10. Inconsistent application across races.

**Fix:** When projecting pace as HOT (3+ E/EP horses dueling) on dirt 7F+, automatically include any closer/late-runner with sire-side stamina influence in algo top-5. T O Elvis (Volatile sire) qualifies.

### 3. AE maiden Ocelli hit 3rd in Derby

Ocelli was the only maiden in the Derby, drew in from AE22, $12K purchase, longest shot in the race. Finished 3rd.

**Why we missed:** "Only 3 maidens have won Derby in 151 years" was the dominant heuristic. Correct for WIN — but for board, in a 20-horse chaos race with hot pace, the deep-closer maiden becomes a board candidate.

**Fix:** Decouple win-prob from board-prob. AE-draw maidens with closer style + projected hot pace get a small board-probability bonus, NOT a win-prob bonus. Use only in tri/super under-spread, never in win bets.

### 4. Trifecta box top-3 went 0-for-13

The 4th algo pick was the missing tri horse in nearly half the races. **The "always top-4" locked rule is non-negotiable**, but May 2's picks didn't reflect it (they were generated before the patch). Re-running through patched code would fix this on paper.

---

## What to ship before next race day

| # | Change | Validation lens | Effort |
|---|---|---|---|
| 1 | `jockey_streak_z` feature in score_horses | Jose Ortiz Oaks Day → Golden Tempo Derby | M (needs jockey-recent data feed) |
| 2 | Top-7 super box default for fields ≥18 with top-5 score concentration <60% | Derby 20-horse field; super top-5 missed Golden Tempo | S (one branch in best_exotic_strategy) |
| 3 | Closer + stamina-sire bonus in HOT pace projections | T O Elvis R10; Golden Tempo R12 | M (sire database lookup) |
| 4 | Decouple win-prob from board-prob; AE-maiden board bonus in chaos races | Ocelli 3rd in Derby | M (separate scoring head) |
| 5 | Re-run May 2 raw-entries through patched process_card.py | Validate top-4 default + stakes guard against actual card | S (single CLI run) |

---

## The honest scoreboard after 2 cards (Apr 30 + May 2)

| Metric | Apr 30 | May 2 | 2-card avg |
|---|---|---|---|
| Algo top-1 hit rate | 4/9 = 44% | 3/14 = 21% | 7/23 = 30.4% |
| Algo top-3 hit rate | 8/9 = 89% | 8/14 = 57% | 16/23 = 69.6% |
| ML chalk top-1 (control) | 5/10 = 50% | 3/14 = 21% | 8/24 = 33.3% |
| **Algo edge over chalk top-1** | -6 pts | 0 pts | **-3 pts** |
| Forward exacta in algo top-2 | 3/11 | 3/14 | 6/25 = 24% |
| $1 EX BOX top-2 ROI | +222.7% (R5 outlier) | -27.3% | +98% combined / -12% if exclude R5 |

**The $1 EX BOX top-2 strategy:** if you bet it consistently for 25 races, you'd be +$30 on the books — but the entire +EV comes from one race (Apr 30 R5 Jinxzi #3-#12 paid $56). Without that single outlier you're net -$12 across 24 races. **N=2 days remains too small to claim edge over the market**, and the algo's top-1 picking is empirically tied with ML chalk.

The 30-card validation in [ALGO_THESIS.md](../../docs/ALGO_THESIS.md) remains the right framing. We have 28 cards to go before claiming or disproving edge.

---

## What this means for Preakness May 16

1. **Don't use the Beyer-100 thesis** as a Derby-style algo top-3 lock for the Preakness. 1 3/16 mile, 14-horse field — different scenario.
2. **Watch jockey streaks in the days leading up.** Same Oaks Day → Derby pattern could repeat for Black-Eyed Susan → Preakness.
3. **CHALK_MATCH = PASS still applies.** Don't bet chalks where algo and market converge.
4. **For Preakness specifically, Renegade is likely the favorite again** (Pletcher pointed him to Derby; if he runs Preakness, post-1-curse doesn't apply at Pimlico). Apply the stakes-segmentation guard correctly.
5. **Run the patched algo first.** Get clean pre-race picks committed BEFORE post — so the backtest is honest and not contaminated like our Wave 2 PACE_PROJECTIONS were.
