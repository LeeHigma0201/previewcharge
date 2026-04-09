# Codebase Map — HorseGPT v3.14 (previewcharge repo)

## Architecture: Data → DB → Features → Models → Evaluation/Dashboard

```
src/
├── data/
│   ├── models.py          ← SQLAlchemy ORM: Race, Horse, Entry, PastPerformance, Workout
│   ├── bris_parser.py     ← Fixed-width BRIS file parser (1430+ fields, ~100 mapped)
│   ├── ingest.py          ← Dedup + insert entries/PPs/workouts
│   ├── database.py        ← Engine/session management
│   └── scrapers/
│       ├── equibase.py    ← Equibase scraper (httpx + selectolax)
│       ├── drf_free.py    ← DRF free data scraper
│       ├── racing_api.py  ← Racing API scraper
│       └── ingest_scraped.py ← ScrapedCard → ParsedEntry bridge
│
├── features/
│   ├── core.py            ← 50 features in 9 categories, z-scored per race
│   ├── pipeline.py        ← Full feature matrix builder
│   └── interactions.py    ← Feature interaction engineering
│
├── models/
│   ├── base.py            ← BaseModel ABC: fit(X, y, odds), predict_proba(X, odds)
│   ├── logistic.py        ← Benter logistic (odds offset — market as baseline)
│   ├── lightgbm_model.py  ← LightGBM gradient boosting
│   ├── ensemble.py        ← 0.7 LightGBM + 0.3 logistic
│   ├── monte_carlo.py     ← Henery normal model (NOT Harville exponential)
│   ├── neural_net.py      ← Neural network model
│   └── gnn_pace.py        ← Graph neural net for pace interactions
│
├── longshot/
│   ├── signals.py         ← 4-layer signal stack: base prob → overlay → angles → value
│   ├── pace_scenarios.py  ← Pace classification + impact estimation
│   ├── trainer_patterns.py ← Trainer-situation pattern matching
│   └── value.py           ← Kelly staking, EV calculation, exotic EV
│
├── evaluation/
│   ├── backtesting.py     ← Historical backtest engine
│   ├── calibration.py     ← Probability calibration checks
│   └── metrics.py         ← ROI, accuracy, log-loss metrics
│
├── nlp/
│   ├── race_query.py      ← "Saratoga R5 today" → ParsedRaceQuery
│   ├── prompt_builder.py  ← Assembles full context block for LLM
│   └── cli.py             ← CLI interface
│
dashboard/
├── app.py                 ← Streamlit main app
└── pages/
    ├── race_card.py       ← Race card view
    ├── predictions.py     ← Model predictions display
    ├── pace_analysis.py   ← Pace scenario visualization
    └── backtest.py        ← Backtest results viewer

web/                       ← Next.js frontend (separate app)
├── app/
│   ├── page.tsx           ← Main page
│   ├── lib/types.ts       ← TypeScript types
│   ├── lib/data.ts        ← Data fetching
│   └── api/chat/route.ts  ← Chat API endpoint
```

## Key Design Decisions Already Made

1. **Henery model, NOT Harville** — monte_carlo.py uses probit (Φ⁻¹) transform, not logit. Harville overestimates favorites in place/show.
2. **Benter odds-offset** — logistic.py uses market odds as logit baseline. Model learns residual signal only.
3. **Z-scoring within field** — All 50 features normalized per-race so models see relative strength.
4. **Denormalized PPs** — Up to 10 past performances stored flat per entry to avoid self-joins.
5. **4-layer longshot stack** — Base prob → overlay detection → angle signals → value/Kelly.
6. **25% fractional Kelly** — Never full Kelly. Max 2% bankroll per play.
7. **Predictions must sum to 1.0** — Softmax normalization across race field.

## 50 Features (9 Categories)

### Speed (5): best_beyer, avg_beyer, last_beyer, beyer_trend, beyer_stdev
### Pace (8+5): avg_e1_pace, avg_e2_pace, avg_late_pace, last_e1_pace, last_late_pace, style_E/EP/P/S/C (one-hot), pace_velocity_change, early_late_ratio
### Class (6): current_purse, avg_past_purse, class_change_pct, claiming_price_ratio, race_type_encoded, is_class_drop
### Form (11): days_since_last, log_days_since_last, is_quick_turnaround, is_optimal_rest, is_freshening, is_extended_layoff, win_rate_last_5, win_rate_last_10, avg_finish_pos, improvement_last_3, top3_rate_last_5
### Jockey/Trainer (10): {jockey,trainer}_{win_pct, roi, starts, top3_pct, avg_odds}
### Post Position (5): post_position, post_position_pct, is_outside, is_outside_dirt_sprint, is_inside_turf
### Distance/Surface (5): distance_exp_pct, surface_exp_pct, is_surface_switch, distance_change_yards, is_route_to_sprint
### Odds (4): morning_line_odds, ml_implied_prob, log_ml_odds, is_ml_favorite
### Equipment (4): has_blinkers, first_time_blinkers, blinkers_off, has_lasix
### Trip Shape (5): avg_pos_1st_call, avg_pos_stretch, avg_pos_gain, avg_late_gain, troubled_trip_rate
### Field-Level (9): n_early_speed, n_closers, speed_horse_pct, pace_scenario_hot, pace_scenario_soft, lone_speed, style_x_hot_pace, style_x_soft_pace, pace_pressure

## Longshot Signal Types (from signals.py + pace_scenarios.py + trainer_patterns.py)

| Signal | Weight | Condition |
|--------|--------|-----------|
| closer_speed_duel | 3.0 | S/C runner + ≥3 E/EP in field |
| lone_speed | 3.5 | Only E/EP horse in field |
| stalker_advantage | 2.0 | P runner + ≥2 E/EP creating contested pace |
| trainer_surface_switch | 2.0 | Trainer switch win% > 1.5× overall |
| trainer_blinkers | 1.5 | Trainer blinker win% > 1.3× overall |

## What's NOT Yet Built (Gaps to Fill)

1. **Superfecta probabilities** — monte_carlo.py only computes win/place/show/exacta/trifecta. Need top4 and superfecta matrix.
2. **Horizontal exotic sequencer** — No pick 3/4/5/6 or daily double ticket builder.
3. **Track bias table** — No persistent track bias data or post position win rates.
4. **Jockey/trainer combo stats** — Features compute individual stats but not the combo (which has massive signal).
5. **Race entropy calculation** — Not computed for ticket optimization.
6. **Capable longshot filter** — signals.py has overlay detection but not the 5-point capability filter.
7. **EVPD per exotic combo** — value.py has basic EV but not per-combination EVPD for ticket optimization.
8. **Live odds scraping** — No real-time odds pipeline for PDS calculation at post time.
