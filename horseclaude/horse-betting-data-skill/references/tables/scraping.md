# Web Scraping Data Sources & Schema

## Primary Data Sources

### Equibase.com (Race Results + Entries)
- **What to scrape**: Race results, entries/fields for upcoming races, past performances
- **Update frequency**: Entries posted ~48hrs before post time, results within 30min of race
- **Key pages**:
  - `/static/entry/{track_code}/{date}` — full card entries
  - `/static/results/{track_code}/{date}` — race results
  - `/static/chart/{track_code}/{date}/{race_number}` — detailed race chart

### Data points per source

#### From Race Entries Page:
```
race_number, post_time, distance, surface, race_type, class_level, purse,
conditions_text, age_restriction, sex_restriction
```
Per horse in entry:
```
program_number, horse_name, morning_line_odds, jockey, trainer,
weight, medication, equipment, owner, post_position
```

#### From Race Results / Charts:
```
track_condition, weather, temp, rail_position, final_time,
fractional_times[], run_up_distance
```
Per horse in result:
```
finish_position, beaten_lengths, official_time, speed_figure,
running_positions[], jockey, trainer, weight_carried,
claim_price (if claimed), comment, post_position,
start_position, odds (final)
```

#### From Past Performances (most critical):
Last 10 races per horse:
```
date, track, distance, surface, condition, race_type, class_level,
purse, field_size, post_position, running_positions[],
fractional_times[], final_time, speed_figure, beaten_lengths,
finish_position, jockey, trainer, weight, medication, equipment,
odds, comment
```

## Derived/Calculated Fields (Not Scraped)

These are computed from raw scraped data:

```
adjusted_speed_figure (ASF)     — from speed_figure + variant
speed_figure_trend (SFT)        — from last 5 ASFs
peak_speed_figure (PSF)         — MAX(ASF) in window
class_adjusted_speed_fig (CASF) — ASF + class adjustment
early_pace_figure (EP)          — from fractional_times
late_pace_figure (LP)           — from fractional_times + final_time
pace_shape                      — from running_positions
days_since_last_race (DSLR)     — date arithmetic
class_movement                  — class level delta
surface_change                  — compare to today
distance_change                 — compare to today
```

## Scraping Schedule

| Data Type | Frequency | Timing | Priority |
|-----------|-----------|--------|----------|
| Tomorrow's entries | Daily | 6 PM ET | HIGH |
| Today's results | Per-race | ~30min post-race | HIGH |
| Past performances | On-demand | When entries posted | HIGH |
| Track conditions | Hourly | Race day only | MEDIUM |
| Odds (live) | Every 5 min | 30min pre-race to post | HIGH |
| Jockey/Trainer stats | Weekly | Sunday night | LOW |
| Track bias data | Weekly | After each meet week | MEDIUM |

## Data Validation Rules

### Hard Constraints (reject if violated)
- `final_time > 0`
- `finish_position >= 1 AND finish_position <= field_size`
- `speed_figure >= 0 AND speed_figure <= 140`
- `distance_furlongs >= 2 AND distance_furlongs <= 16`
- `post_position >= 1`
- `field_size >= 2`

### Soft Constraints (flag for review)
- `speed_figure` jumps > 20 points from last race (possible error or outlier)
- `final_time` deviates > 3 std dev from class par (possible timing error)
- Missing fractional_times (some tracks don't report all calls)
- `beaten_lengths > 50` (horse may have been pulled up / DNF)

### Exclusion Filters (always apply)
- `dnf = TRUE` — Did Not Finish
- `dq = TRUE` — Disqualified (use original finish for time, DQ'd position for finish)
- `steeplechase = TRUE` — Different sport, exclude from flat analysis
- `race_type = 'trial'` — Trial races have different dynamics

## Database Schema (Supabase/PostgreSQL)

```sql
-- Core tables
CREATE TABLE horses (
    horse_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    foaling_year INT,
    sex CHAR(1),  -- C/F/G/H/M/R
    sire TEXT,
    dam TEXT,
    dam_sire TEXT,
    registration_number TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tracks (
    track_code CHAR(3) PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    surface_types TEXT[],
    circumference_furlongs FLOAT,
    stretch_length_furlongs FLOAT,
    altitude_feet INT
);

CREATE TABLE races (
    race_id TEXT PRIMARY KEY,  -- {track_code}_{date}_{race_number}
    track_code CHAR(3) REFERENCES tracks(track_code),
    race_date DATE NOT NULL,
    race_number INT NOT NULL,
    post_time TIMESTAMPTZ,
    distance_furlongs FLOAT NOT NULL,
    surface TEXT NOT NULL,  -- dirt/turf/synthetic
    track_condition TEXT,
    race_type TEXT NOT NULL,
    class_level INT,
    purse INT,
    conditions_text TEXT,
    age_restriction TEXT,
    sex_restriction TEXT,
    field_size INT,
    weather TEXT,
    temp_fahrenheit INT,
    rail_position TEXT,
    final_time_seconds FLOAT,
    fractional_times FLOAT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE entries (
    entry_id TEXT PRIMARY KEY,  -- {race_id}_{program_number}
    race_id TEXT REFERENCES races(race_id),
    horse_id UUID REFERENCES horses(horse_id),
    program_number INT NOT NULL,
    post_position INT,
    morning_line_odds FLOAT,
    final_odds FLOAT,
    jockey_id UUID,
    trainer_id UUID,
    weight_carried INT,
    medication TEXT[],
    equipment TEXT[],
    finish_position INT,
    beaten_lengths FLOAT,
    final_time_seconds FLOAT,
    speed_figure INT,
    speed_figure_source TEXT,
    running_positions INT[],
    entry_fractional_times FLOAT[],
    last_3f_time FLOAT,
    comment TEXT,
    claim_price INT,
    -- Computed fields (populated by pipeline)
    asf FLOAT,
    ep_figure FLOAT,
    lp_figure FLOAT,
    pace_shape CHAR(2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE jockeys (
    jockey_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trainers (
    trainer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aggregated stats tables (refreshed periodically)
CREATE TABLE jockey_stats (
    jockey_id UUID REFERENCES jockeys(jockey_id),
    track_code CHAR(3),
    period_start DATE,
    period_end DATE,
    starts INT, wins INT, places INT, shows INT,
    win_pct FLOAT, roi FLOAT,
    surface_stats JSONB,
    distance_stats JSONB,
    PRIMARY KEY (jockey_id, track_code, period_start)
);

CREATE TABLE trainer_stats (
    trainer_id UUID REFERENCES trainers(trainer_id),
    track_code CHAR(3),
    period_start DATE,
    period_end DATE,
    starts INT, wins INT, places INT, shows INT,
    win_pct FLOAT, roi FLOAT,
    first_time_starter_stats JSONB,
    layoff_stats JSONB,  -- keyed by DSLR bucket
    surface_change_stats JSONB,
    class_change_stats JSONB,
    PRIMARY KEY (trainer_id, track_code, period_start)
);

CREATE TABLE jockey_trainer_combos (
    jockey_id UUID REFERENCES jockeys(jockey_id),
    trainer_id UUID REFERENCES trainers(trainer_id),
    period_start DATE,
    starts INT, wins INT,
    win_pct FLOAT, roi FLOAT,
    PRIMARY KEY (jockey_id, trainer_id, period_start)
);

CREATE TABLE track_bias (
    track_code CHAR(3) REFERENCES tracks(track_code),
    surface TEXT,
    condition TEXT,
    date_range_start DATE,
    date_range_end DATE,
    post_position_win_rates FLOAT[],  -- indexed by PP
    early_speed_win_pct FLOAT,
    closer_win_pct FLOAT,
    inside_win_pct FLOAT,
    outside_win_pct FLOAT,
    PRIMARY KEY (track_code, surface, condition, date_range_start)
);

-- Simulation results (per race card)
CREATE TABLE sim_results (
    race_id TEXT REFERENCES races(race_id),
    sim_timestamp TIMESTAMPTZ DEFAULT NOW(),
    n_sims INT,
    win_pcts FLOAT[],  -- indexed by program_number
    top2_pcts FLOAT[],
    top3_pcts FLOAT[],
    top4_pcts FLOAT[],
    exacta_matrix FLOAT[][],
    race_entropy FLOAT,
    PRIMARY KEY (race_id, sim_timestamp)
);

CREATE TABLE alerts (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    race_id TEXT REFERENCES races(race_id),
    entry_id TEXT REFERENCES entries(entry_id),
    alert_type TEXT,  -- 'capable_longshot', 'value_exotic', 'pace_collapse'
    pds FLOAT,
    sim_win_pct FLOAT,
    board_odds FLOAT,
    recommended_positions TEXT[],
    evpd JSONB,  -- per exotic type
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_entries_horse ON entries(horse_id);
CREATE INDEX idx_entries_race ON entries(race_id);
CREATE INDEX idx_races_track_date ON races(track_code, race_date);
CREATE INDEX idx_alerts_race ON alerts(race_id);
CREATE INDEX idx_entries_jockey ON entries(jockey_id);
CREATE INDEX idx_entries_trainer ON entries(trainer_id);
```
