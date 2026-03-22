# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

HorseGPT v3.14 — multi-model horse racing handicapping tool. Predicts race outcomes using BRIS data, 50 engineered features, and an ensemble of models (Benter logistic + LightGBM). Includes scrapers for free data sources and an NLP race query engine.

## Commands

```bash
make test                              # Run all tests (pytest -v)
make lint                              # ruff check + mypy
make all                               # Full pipeline: init → ingest → features → predict
make dashboard                         # Launch Streamlit UI
make scrape TRACK=SAR DATE=2026-03-22  # Scrape Equibase data
make query ARGS="SAR R5 today"         # NLP race query → loaded prompt
make ingest-scraped                    # Ingest scraped JSON into DB

# Single test file
pytest tests/test_features.py -v

# Single test
pytest tests/test_logistic.py::test_benter_model_fit_predict -v
```

## Architecture

The pipeline flows: **Data Ingestion → DB → Feature Engineering → Models → Evaluation/Dashboard**.

### Data Layer (`src/data/`)
- **`models.py`** — SQLAlchemy ORM with 5 tables. `Entry` is the central prediction unit (one horse in one race). `PastPerformance` is denormalized (up to 10 PPs per entry) to avoid self-joins during feature engineering.
- **`bris_parser.py`** — Parses fixed-width BRIS files (1430+ fields) into `ParsedEntry` dataclasses. Maps ~100 key fields in Phase 1.
- **`ingest.py`** — Deduplicates horses/races via unique constraints, then inserts entries + PPs + workouts.
- **`scrapers/`** — Equibase, DRF, Racing API scrapers (httpx + selectolax). Output `ScrapedCard` JSON, bridged to `ParsedEntry` via `ingest_scraped.py`.

### Feature Layer (`src/features/`)
- **`core.py`** — 50 features in 9 categories: speed (5), pace (8), class (6), form (6), jockey/trainer (10), post position (3), distance/surface (5), odds (4), equipment (3). All z-scored within the race field via `compute_race_features()`.
- **`pipeline.py`** — Builds full feature matrix across races using eager-loaded queries. Outputs DataFrame with `entry_id` index.

### Model Layer (`src/models/`)
- All models implement `BaseModel` ABC: `fit(X, y, odds)` and `predict_proba(X, odds)`.
- **Benter logistic** (`logistic.py`): Uses market odds as logit offset (coefficient ≈ 1.0), learns residual signal. This is the key architectural decision — the market is the baseline.
- **Predictions must sum to 1.0** across each race field (softmax normalization).
- **Monte Carlo** (`monte_carlo.py`): Henery normal model — converts win probs to ability scores, simulates finish positions for exotic bet probabilities.
- **Ensemble** (`ensemble.py`): Weighted average (0.7 LightGBM + 0.3 logistic).

### NLP Layer (`src/nlp/`)
- **`race_query.py`** — Parses natural language ("Saratoga race 5 today") into structured `ParsedRaceQuery` (track code, race number, date). Supports 60+ track aliases and named races.
- **`prompt_builder.py`** — Queries DB, computes all 50 features, formats a complete context block with per-horse metrics for LLM consumption. This is the "loaded prompt" pattern: user types plain English, all data is assembled behind it.

### Config (`config/settings.py`)
Dataclass-based config: `Settings.load()` returns `DatabaseConfig`, `ModelConfig`, `FeatureConfig`. DB sessions follow: `get_engine(settings)` → `get_session(engine)` → try/finally close pattern.

## Key Patterns

- **Unit of prediction**: `Entry` (horse × race). Feature engineering, model training, and evaluation all operate at this level.
- **Z-scoring within field**: Features are normalized per-race so models see relative strength, not absolute values. A `best_beyer=0.0` means field average.
- **Odds offset**: The Benter model's core insight. `logit(p_market)` is a fixed offset; the model learns only where the market is wrong.
- **Denormalized PPs**: Past performances are stored flat on `Entry` to enable fast feature computation without self-joins.
- **Scraper → ingest bridge**: All scrapers output `ScrapedCard` → `ingest_scraped.py` converts to `ParsedEntry` → same `ingest_entry()` path as BRIS files.

## Test Fixtures

`tests/conftest.py` provides an in-memory SQLite DB with an 8-horse sample race at Saratoga, including varied running styles, morning line odds, BRIS figures, and 3 past performances per entry.
