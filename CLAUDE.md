# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

HorseGPT v3.14 — multi-model horse racing handicapping tool. Predicts race outcomes using BRIS data + scraped public sources, ~50 engineered features, and an ensemble of models (Benter logistic + LightGBM, with optional GNN pace and Monte Carlo). Outputs feed a Streamlit dashboard *and* a Next.js web frontend (`web/`). Includes a Claude-Code-driven prompt-dispatch pipeline that fills missing race data via subagents.

## Commands

```bash
# Python pipeline (project root)
make test                              # pytest -v
make lint                              # ruff check + mypy
make all                               # init → ingest → features → predict
make dashboard                         # streamlit run dashboard/app.py
make scrape TRACK=SAR DATE=2026-03-22  # NLP CLI scrape for one card
make query ARGS="SAR R5 today"         # NLP race query → loaded LLM prompt
make ingest-scraped                    # Bring scraped JSON into the DB

# Keeneland-style preview pipeline (HRN scrape → task queue → agent fill → CSV/JSON)
make preview-keeneland DATE=2026-04-18         # Phase 1: scrape + write tasks.jsonl
make preview-keeneland-ingest DATE=2026-04-18  # Phase 3: apply results.jsonl, rebuild

# Single test file / single test
pytest tests/test_features.py -v
pytest tests/test_logistic.py::test_benter_model_fit_predict -v

# Web app (web/ — Next.js 16, React 19)
cd web && npm run dev         # http://localhost:3000
cd web && npm run build       # production build
cd web && npm run lint        # eslint
```

`.env` (project root): `GEMINI_API_KEY` is required for `web/app/api/chat` and `race-insights` routes (see `.env.example`).

## Architecture

The pipeline flows: **Data Ingestion → SQLite → Feature Engineering → Models (Stage 1) → Overlay vs Market (Stage 2) → Bet Construction → Dashboard / Web**.

### Two-stage architecture (the load-bearing design choice)

**Stage 1 — fundamental ability model.** Predicts finishing order from horse data alone: speed/pace figures, form, class, jockey/trainer, post position, distance/surface fit. **No odds input.** This is what `src/models/logistic.py`, `lightgbm_model.py`, `gnn_pace.py`, and the sandbox scorer in `scripts/sandbox_score.py` all produce. The Benter twist: market odds are used as a *fixed logit offset* (coefficient ≈ 1.0) so the model only learns the *residual* signal — but Stage 1 outputs are still odds-free probabilities.

**Stage 2 — overlay detection (`src/models/overlay.py`).** Compares Stage 1 probabilities to current market odds. Where the model disagrees with the public is where the money is. The "exotic multiplier" (product of top-3 overlay ratios) measures how much exotic-pool value exists in a race.

Anything that touches odds — overlay, longshot detection, Kelly sizing, exotic ticket construction — must consume Stage 1 output, never feed odds into the ability model. Don't accidentally collapse the stages.

### Data layer (`src/data/`)
- **`models.py`** — 7 SQLAlchemy tables: `Race`, `Horse`, `Entry`, `PastPerformance`, `Workout`, `TrackBias`, `OddsSnapshot`. `Entry` (horse × race) is the prediction unit. PPs are denormalized (≤10/entry) so feature engineering avoids self-joins.
- **`bris_parser.py`** — fixed-width BRIS parser (1430+ fields → ~100 mapped); produces `ParsedEntry`.
- **`ingest.py`** / **`ingest_scraped.py`** — both paths funnel into `ingest_entry()`. Dedupe by unique constraints.
- **`scrapers/`** — Equibase, DRF, HorseRacingNation, RacingAPI, live odds (httpx + selectolax, no Selenium). All output `ScrapedCard`.
- **`scrapers/prompt_specs.py`** — declarative catalog mapping each feature column to a fetch-spec (`equibase_pps`, `equibase_workouts`, `jt_stats`). When the scrape leaves a cell null, the matrix builder substitutes a `PROMPT[...]` cell that a subagent can resolve.
- **`track_bias.py`** — track/surface/post-position bias stats.
- **`gemini_fetcher.py`** — Gemini-backed lookup for sparse fields.

### Feature layer (`src/features/`)
- **`core.py`** — ~50 features in 9 categories (speed/pace/class/form/JT/post/dist/odds/equipment), z-scored within race field via `compute_race_features()`.
- **`pipeline.py`** — eager-loaded matrix builder; outputs DataFrame indexed by `entry_id`.
- **`prompt_matrix.py`** — when feature cells can't be computed (no PPs, no JT stats), substitutes `PROMPT[spec|target]` strings keyed to `prompt_specs.FEATURE_TO_SPEC`. Drives the agent-dispatch flow.
- **`jt_stats_cache.py`** — meet-level jockey/trainer cache (one fetch shared across horses in a card).

### Model layer (`src/models/`)
All models implement `BaseModel`: `fit(X, y, odds)` and `predict_proba(X, odds)`. Predictions must sum to 1.0 across each race field (softmax/normalization).
- **`logistic.py`** — Benter logistic with odds offset.
- **`lightgbm_model.py`** — gradient-boosted tabular workhorse.
- **`neural_net.py`** — small softmax net for nonlinear interactions.
- **`gnn_pace.py`** — GATv2Conv pace-pressure GNN (PyTorch Geometric, optional `[gpu]` extra).
- **`ensemble.py`** — weighted average (default 0.7 LightGBM + 0.3 logistic, see `ModelConfig`).
- **`monte_carlo.py`** — Henery normal model (probit transform; not Harville). Converts win probs → ability scores → simulated finishes; produces `SimulationResult` with exacta/trifecta/superfecta probability tensors.
- **`entropy.py`** — Shannon entropy over win probs; tells the horizontal sequencer when to single vs spread.
- **`horizontal.py`** — DD/Pick 3-6 ticket construction, entropy-driven leg sizing.
- **`overlay.py`** — Stage 2: model vs market.

### Betting layer (`src/betting/`)
- **`exotic_engine.py`** — anchor-keyed exacta/trifecta/superfecta and multi-race plans. Identify a strong anchor, then use Monte Carlo conditional probabilities to fill 2nd/3rd/4th slots.
- **`kelly.py`** — fractional Kelly with takeout adjustment. Always use fractional (~25%) Kelly and cap stake at ~2% of bankroll per longshot — Benter's warning about overestimated edge causing negative growth.
- **`ranked_exotics.py`** — sorts/filters constructed combos by EV.

### Longshot stack (`src/longshot/`)
4-layer architecture (see `signals.py` docstring): base prob model → overlay flag → angle-signal aggregation → value/staking. The **5-point capable-longshot filter** (`capable_longshot_filter`) is non-negotiable: best Beyer ≥ class par − 5, non-declining trend, recent activity (or trainer-layoff edge), Monte Carlo win% ≥ 8%, pace scenario favorable. All five must pass, or the longshot is excluded from tickets.

### Evaluation (`src/evaluation/`)
`metrics.py`, `calibration.py`, `backtesting.py` — log-loss, Brier, calibration plots, walk-forward backtest (default `walk_forward_min_days=180`).

### NLP layer (`src/nlp/`)
- **`race_query.py`** — parses "Saratoga race 5 today" into `ParsedRaceQuery` (60+ track aliases, named races).
- **`prompt_builder.py`** — assembles a "loaded prompt" for an LLM: 50 features + per-horse metrics for one race, formatted as a self-contained context block.
- **`cli.py`** — `make scrape` and `make query` entrypoints.

### Agent dispatch (`src/agents/dispatcher.py`)
JSONL task queue for filling missing race data via Claude Code subagents — the load-bearing pattern for the Keeneland/Churchill preview workflow:

1. `scripts/keeneland_preview.py --export-only` scrapes HRN, builds a v0 CSV, emits `tasks.jsonl` (one task per `(horse, spec)` or `(person, role)` pair, deduped).
2. **The parent Claude Code agent** dispatches tasks in waves using `Agent` + `WebFetch` (Equibase primary, HRN fallback). Each subagent returns JSON matching the spec schema. Results append to `results.jsonl`.
3. `--ingest-results` applies each result via `apply_partial_update` and regenerates the CSV + a web-app-consumable JSON in `web/public/preview/`.

This module does **not** call the Anthropic API itself — the parent agent drives dispatch, so no API key is needed. When you see `tasks.jsonl` in `data/previews/`, that's a queue waiting for the agent to walk.

### Daily card workflow (`scripts/process_card.py`, `scripts/sandbox_score.py`)
Churchill Downs (and similar) cards land as `data/cd-YYYY-MM-DD/raw-entries.json`. Scripts produce:
- `horses.csv` (1 row/horse, scored), `races.csv` (1 row/race + top picks), `exotics.csv`, `picks.md`, `backtest.md` (after results land), and a `cd-YYYY-MM-DD.ts` StaticRace data file dropped into `web/app/lib/` for the Next.js app.
- `sandbox_score.py` is the Stage 1 pure-data scorer (no odds), output → `sandbox-picks.md` + `sandbox-scores.json`. Stage 2 happens outside the sandbox.

The `.gitignore` is intentional: raw scraped JSON is ignored, but committed CSV/MD analysis artifacts under `data/cd-*/` and curated meet-stats JSON under `data/analysis/` are kept so a fresh clone can rebuild and so the PR shows the picks snapshot at deploy time.

### Web frontend (`web/`)
Next.js 16 + React 19 + Tailwind v4. Read-only consumer of the Python pipeline's outputs.
- **Data sources**: `web/app/lib/cd-YYYY-MM-DD.ts` (per-card StaticRace data, generated by `process_card.py`) and `web/public/preview/*.json` (generated by `keeneland_preview.py --ingest-results`).
- **Routes**: `/today`, `/bets`, `/recap`. API routes under `web/app/api/` (`chat`, `race`, `race-insights`, `preview`, `today`, `live-results`, `parse-pp`, `scratches`) — `chat` and `race-insights` use `@ai-sdk/google` with `GEMINI_API_KEY`.
- **`web/AGENTS.md` is canonical**: this is **not** the Next.js you know — APIs, conventions, and file structure may differ from training data. Read `node_modules/next/dist/docs/` before writing Next.js code in this project.

### Config (`config/settings.py`, `config/tracks.yaml`)
Dataclass-based: `Settings.load()` → `DatabaseConfig`, `ModelConfig`, `FeatureConfig`. DB session pattern: `get_engine(settings)` → `get_session(engine)` → try/finally close. Key tunables in `ModelConfig`: ensemble weights, MC iterations (default 100K), Kelly fraction (0.25), takeouts (win 0.17, exotic 0.22), `min_overlay_ev=1.10`.

### Claude skill (`horseclaude/horse-betting-data-skill/`)
A standalone Claude skill (`SKILL.md` + `references/`) describing the analyst persona, terminology (PDS, EVPD, CES, ASF/CASF, capable longshot), and standard filters (exclude DNF/steeplechase/trial; floor sigma 0.3s; ≥3 PPs for individual fits). Useful as a reference when writing analysis copy or thinking about new features — it documents what the betting math is *trying to do*.

## Key patterns

- **Unit of prediction**: `Entry` (horse × race). Features, training, evaluation all operate at this level.
- **Z-scoring within field**: features are normalized per-race, so models see relative strength. `best_beyer = 0.0` means field average.
- **Odds offset, not odds input (Stage 1)**: `logit(p_market)` is a fixed offset; the model learns where the market is wrong. Don't pass odds as a feature.
- **Denormalized PPs**: PPs live flat on `Entry` to enable fast feature computation without self-joins.
- **Scraper → ingest bridge**: All scrapers output `ScrapedCard` → `scraped_to_parsed()` → same `ingest_entry()` path as BRIS files.
- **PROMPT[…] cells = unresolved data**: anywhere a feature can't be computed, the matrix carries a `PROMPT[spec|target]:` string instead of a number. The agent-dispatch flow resolves them. If you see one in a CSV, the pipeline isn't broken — the cell is awaiting a subagent fetch.
- **Fractional Kelly + takeout adjustment, always**: full Kelly with overestimated edge → negative growth (Benter). Cap longshot stakes at 2% of bankroll.

## Test fixtures

`tests/conftest.py` provides an in-memory SQLite DB with an 8-horse sample race at Saratoga (varied running styles, ML odds, BRIS figures, 3 PPs per entry). Use the `sample_race` fixture for any test that needs a populated race.
