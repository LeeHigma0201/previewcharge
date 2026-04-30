# CD 2026-04-29 — Stage 1 Sandbox Handoff

**Status:** Architecture built and committed. Waiting on real PP data to run Stage 1 against the full Wed Derby Week card. Jason is bringing paid PPs (Brisnet or equivalent) tomorrow.

**Last session ended:** 2026-04-28 evening. PR #5 has the code. The HRN free-scrape attempt produced metadata-only (no per-race PP arrays), so Stage 1 cannot run yet with signal.

---

## The architecture (Jason's two-stage spec)

```
SANDBOX (no market data)                    EXIT (market peek)
─────────────────────                       ──────────────────
PP data → features → softmax → modelProb    Compare to ML/live
  ↓                                              ↓
top-5 ranked PURELY on data                 Where model=market → solidify
  ↓                                         Where model≠market → edge or fade
                                                 ↓
                                            Harville/Plackett-Luce on
                                            modelProb → joint probs →
                                            ticket EV vs takeout →
                                            exotic structure picked
```

**Why this matters:** if market data enters Stage 1, the model becomes a market shadow. The previous `process_card.py` did this — used ML odds as primary input, then "adjusted" by post bias and trainer tier. Stage 1 here uses **zero market data**, so divergences at the Stage 2 exit are real edges, not amplifications.

**The exotic-betting thesis:** with clean Stage 1 modelProbs, Harville joint probabilities give us a fair price for any tri/super/Pick-N. Parimutuel exotic pools are LESS efficient than win pools because the crowd is smaller and the payouts are nonlinear. This is where the math actually beats the market. Bill Benter's Hong Kong edge.

---

## Files in this PR (commit `5ea509b` on top of `a578965`)

### Stage 1 scorer — `scripts/sandbox_score.py`

Reads `data/cd-{date}/raw-entries.json` + `data/cd-{date}/horse-pps.json`.
Emits `sandbox-picks.md` (human) + `sandbox-scores.json` (Stage 2 input).

Race-profile classification:
- `marathon` (1.5m+) — distance fit weighted 40%, speedZ 25%
- `route` (1m–1 7/16m) — speedZ 35%, class 25%
- `sprint` (<1m) — speedZ 45%, distance 15%
- `msw_2yo` — class signal 70% (debut-heavy, can't use speed)

Features per horse:
- `speedZ` — z-score of mean last-3 Beyer in similar conditions
- `distance_fit` — has the horse won/competed at today's distance? (-1 to +1)
- `form_trend` — slope of last-3 Beyers, normalized to ±1
- `class_signal` — trainer tier + jockey tier + race-profile specialty bonus
- `layoff_adj` — class-aware layoff penalty (halved for peak Beyer ≥82, per Apr 18 Keeneland fix)

Composite → softmax (β=2.5) → `model_prob`. Sort, rank.

### Pattern detector — `scripts/sandbox_patterns.py`

Reads `sandbox-scores.json`. Tests 5 hypotheses for SYSTEMATIC market inefficiency (not single-race noise):

1. **Class-distance mismatch fades** — high speed, untested distance (Wynstock-style)
2. **Race-type edge concentration** — claimers vs stakes vs MSW pool efficiency
3. **Trainer-meet anomaly** — trainers with multiple horses + consistent edge sign
4. **Layoff-returner overlays** — class horses off 60+ days the market dings
5. **Form-trend longshots** — improving Beyer at 12/1+ (Benter's signal)

Outputs `sandbox-patterns.md` with per-pattern tables.

---

## What's missing — the PP data gap

The HRN free-scrape via researcher agent produced **metadata only** (career_best_beyer, lifetime_starts, lifetime_wins, pp_count) but **NOT the per-race PP arrays**. Without per-race data the scorer can't compute speedZ, distance_fit, form_trend, or layoff_adj.

The agent's output is at `data/cd-2026-04-29/horse-pps.json` but split into three buckets (`horses_with_good_data`, `horses_with_sparse_data`, `horses_with_issues`) instead of the expected `horses` key. Schema mismatch + missing PP arrays = unusable for Stage 1.

**Salvageable:** the agent identified 47 horses with 5+ PPs available on HRN, 38 horses with URL collisions or missing profiles. Career-best Beyer is captured for ~46 horses.

---

## What we need (canonical schema for tomorrow)

Write `data/cd-2026-04-29/horse-pps.json` in this exact shape:

```json
{
  "fetched_at": "2026-04-29T07:00:00",
  "source": "Brisnet Race Summary PDF" | "Equibase PPs" | "DRF" | "manual",
  "horses": {
    "Empire Builder": {
      "expected_trainer": "Armando Hernandez",
      "trainer_match": true,
      "lifetime_starts": 18,
      "lifetime_wins": 3,
      "career_best_beyer": 92,
      "past_performances": [
        {
          "date": "2026-03-15",
          "track": "OP",
          "distance": "1m",
          "surface": "Dirt",
          "finish": 2,
          "beaten_lengths": 1.5,
          "beyer": 88,
          "race_class": "Allowance",
          "running_style": "P"
        },
        ...
      ]
    },
    "Nip N Tuck": { ... }
  }
}
```

**Required fields per PP:** `date`, `distance`, `surface`, `finish`, `beyer`. Everything else is bonus.

**Distance format:** `"6f"`, `"1m"`, `"1 1/16m"`, `"4 1/2f"`, `"1 1/2m"` — same format as `raw-entries.json`.

**Surface format:** `"Dirt"` or `"Turf"` (case-insensitive).

---

## Pickup steps for tomorrow

1. Jason brings Brisnet Race Summary PDF (or similar paid source) for Wed Apr 29.
2. Run a converter to produce `horse-pps.json` in the schema above. **Build this converter as `scripts/pps_to_json.py`** — input flexible (PDF text, CSV, or pasted table), output the canonical schema. Re-usable for Thu/Fri/Sat.
3. Run: `python3 scripts/sandbox_score.py 2026-04-29` → emits sandbox-picks.md + sandbox-scores.json
4. Run: `python3 scripts/sandbox_patterns.py 2026-04-29` → emits sandbox-patterns.md
5. **Patterns first, picks second.** Look at `sandbox-patterns.md` to see if Stage 1 finds systematic edges (trainer anomaly, race-type concentration, etc.). Single-race picks are noisy; cross-card patterns aren't.
6. If patterns hold, codify into Stage 2 ticket-EV calculator with Harville joint probs (already implemented inline in `sandbox_score.py:harville_top3_probs` — needs externalizing for full Pick-N pricing).
7. Repeat for Thu Apr 30 (12 races, 4 stakes), Fri May 1 (Oaks Day, 13 races), Sat May 2 (Derby Day, 14 races).

---

## What Jason wants me to remember

- **He doesn't handicap.** I'm the pattern detector; he's the architect/guide.
- **Don't ask "does this match your handicap?"** — there's no manual baseline. Trust the math, prove it through backtests + holdouts.
- **Surface PATTERNS, not picks.** Single-race picks are tactics. Patterns are strategy.
- **Confidence target: 90%+.** If I'm not, I say so and explain what would get me there.
- **Sandbox is sacred.** No market data leaks into Stage 1 features. Period.

---

## Confidence audit (current state)

| Layer | Confidence | Notes |
|---|---|---|
| Two-stage architecture understanding | 95% | Verified with Jason mid-session; no ambiguity |
| Stage 1 feature design | 85% | Mirrors Keeneland Apr 18 algo (proven). PP-data dependent — without it, all features collapse to 0 |
| Stage 1 weights | 70% | Profile-tuned but not yet validated. Need Apr 25 backtest to calibrate |
| Pattern detector | 80% | 5 hypotheses are sound; some thresholds are coarse buckets, not continuous |
| Harville exotic pricing | 90% | Math is correct. Doesn't yet price live tickets vs takeout — need pool-share input |
| Data quality | 30% | Metadata only currently. Goes to 90% once Brisnet PDF is parsed |

---

## Cards still to score this week

| Date | Races | Stakes | Status |
|---|---|---|---|
| Wed Apr 29 | 10 | Kentucky Juvenile $250K, Isaac Murphy Marathon $200K | Architecture ready, needs PPs |
| Thu Apr 30 | 12 | UAE President Cup $400K, Opening Verse $350K, St. Matthews $200K, Mamzelle $300K | Needs entries + PPs |
| Fri May 1 (Oaks) | 13 | Eight Belles $700K, Alysheba $750K, La Troienne $1M, Edgewood $600K, Modesty $500K, Unbridled Sidney $500K, **Kentucky Oaks $1.5M** | Needs entries + PPs |
| Sat May 2 (Derby) | 14 | Derby City Distaff $1M, Pat Day Mile $750K, Distaff Turf Mile $1M, American Turf $1M, Churchill Downs S. $1M, Bourbon Turf Classic $1.5M, Twin Spires Sprint $600K, Knicks Go $200K, **Kentucky Derby $5M** | Needs entries + PPs |

Stakes purses across the week: ~$18.6M+. The Derby card alone has $13M in stakes.

---

## Reference: race profile weights (for tuning)

```python
WEIGHTS_BY_PROFILE = {
    "marathon": {"speedZ": 0.25, "distance_fit": 0.40, "form_trend": 0.20, "class_signal": 0.15},
    "route":    {"speedZ": 0.35, "distance_fit": 0.20, "form_trend": 0.20, "class_signal": 0.25},
    "sprint":   {"speedZ": 0.45, "distance_fit": 0.15, "form_trend": 0.20, "class_signal": 0.20},
    "msw_2yo":  {"speedZ": 0.10, "distance_fit": 0.10, "form_trend": 0.10, "class_signal": 0.70},
}
```

These weights are educated initial guesses. **Backtest against Apr 25 results to validate** (we have Apr 25 results in scrape-report.md and could rebuild raw-entries.json from cd-2026-04-25.ts).

---

## Reference: trainer/jockey tier (in `sandbox_score.py`)

Top-tier weights mirror cd-context.ts but locally-owned for tuning. Includes specialty bonuses:
- Mott + marathon → +0.20
- Cox + route → +0.15
- Brown + turf route → +0.20
- Ward + 2yo → +0.30

These should be **revalidated weekly** from CD spring meet stats once we have meet-to-date data.

---

## Open questions (won't block but worth resolving)

1. **HRN Beyer vs official Beyer?** HRN's "speed figure" column may be HRN-derived, not Brisnet/Equibase Beyer. Variance ~3-5 points but could shift longshots in/out of overlay zone. Confirm with Brisnet PPs tomorrow.
2. **Harville vs Plackett-Luce vs Henery?** All three model finishing-order joint probabilities. Harville is simplest (assumes independence given prior placements). Plackett-Luce uses ability ratios. Henery uses normal model. For Pick 3/4/5/6 the difference matters. Currently only Harville is implemented.
3. **Track condition (Fast/Sloppy/Muddy/Firm/Yielding/Soft)?** Our cd-context.ts has wet-track adjustments for closers but they don't fire in `sandbox_score.py` yet — the script defaults `condition: "Fast"`. Add: read condition from raw-entries.json or scrape day-of.
4. **Sectional-time pace projection?** We score `paceAdj` based on count of E/EP horses, but the existing src/longshot/pace_scenarios.py has a more sophisticated pace shape model. Wire that in for Stage 1.5.
5. **TwinSpires live-odds delta?** Apr 25 commit notes this as the highest-leverage signal we don't have. It's a Stage 2 input (sharp money detection), not Stage 1. Still worth wiring before Saturday.

---

## How to validate Stage 1 without betting money

Apr 25 backtest:
- We have cd-2026-04-25.ts with the entries
- We have results in `data/cd-2026-04-25/scrape-report.md` (winners + payouts for all 10 races)
- Scrape PPs for the 86 Apr 25 horses (most are in the same trainer/jockey pools as Wed)
- Run sandbox_score.py on Apr 25
- Compare modelProb top-3 to actual finish
- Compute hit rate, ROI, calibration curve

Expected: 50%+ top-1, 85%+ top-3 if the model is at parity with the limited-data picks. Better if Stage 1 is real.

If Stage 1 calibrates well on Apr 25, run on Apr 28 (we have results too — Tue race we missed) for a second data point.

---

## Files in this PR (LeeHigma0201/previewcharge#5)

```
data/cd-2026-04-29/
├── raw-entries.json       # input: 92 horses across 10 races (gitignored)
├── horse-pps.json         # input: NEEDS REAL PP DATA (currently metadata-only)
├── picks.md               # output of process_card.py (limited-data, market-shadow)
├── horses.csv             # output of process_card.py
├── races.csv              # output of process_card.py
├── exotics.csv            # output of process_card.py
├── multi-race.md          # output of process_card.py
├── sandbox-picks.md       # output of sandbox_score.py (currently flat - no PPs)
├── sandbox-scores.json    # output of sandbox_score.py (Stage 2 input)
├── sandbox-patterns.md    # output of sandbox_patterns.py
└── HANDOFF.md             # THIS FILE

scripts/
├── process_card.py        # OLD: limited-data path, market-shadow (still produces picks)
├── sandbox_score.py       # NEW: Stage 1 sandbox scorer (needs PPs to fire)
└── sandbox_patterns.py    # NEW: cross-card pattern detector

web/app/lib/
└── cd-2026-04-29.ts       # StaticRace data for the web app (not yet wired into /today)
```

---

_Last updated 2026-04-28 by Claude. PR #5 on LeeHigma0201/previewcharge._
