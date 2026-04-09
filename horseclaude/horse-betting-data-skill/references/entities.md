# Entity Definitions — Exotic Horse Betting

## Horse
- **What it is**: A unique Thoroughbred identified by name + year of birth (names recycle after ~5 years)
- **Primary ID**: `horse_id` (internal UUID), also keyed by `registration_number` from Jockey Club
- **Key attributes**: name, age, sex, sire, dam, dam_sire, owner, breeder, color
- **Gotcha**: Same horse name can exist across years. Always pair name + foaling_year or use registration_number.

## Race
- **What it is**: A single contest at a specific track on a specific date
- **Primary ID**: `race_id` (composite: track_code + date + race_number)
- **Key attributes**: track_code, date, race_number, post_time, distance_furlongs, surface (dirt/turf/synthetic), race_type (maiden/claiming/allowance/stakes/graded_stakes), class_level, purse, conditions_text, age_restriction, sex_restriction, weather, track_condition (fast/good/muddy/sloppy/yielding/firm/soft), rail_position, temp_fahrenheit
- **Relationships**: Has many entries (horse-race junction). Belongs to a race_card (all races at a track on a date).

## Entry (Past Performance Line)
- **What it is**: A horse's participation in a specific race — the atomic unit of all analysis
- **Primary ID**: `entry_id` (composite: race_id + horse_id)
- **Key attributes**: program_number, post_position, morning_line_odds, final_odds, finish_position, beaten_lengths, final_time_seconds, speed_figure (Beyer/TimeformUS/Brisnet), jockey_id, trainer_id, weight_carried, medication (Lasix/Bute), equipment (blinkers/mud_calks), claim_price, running_positions (array: call positions at each point of call), fractional_times (array), last_3_furlong_time, trip_notes, comment
- **Relationships**: Belongs to a race. Belongs to a horse. References jockey, trainer.

## Jockey
- **Primary ID**: `jockey_id`
- **Key attributes**: name, current_meet_stats (wins/places/shows/starts), win_pct, roi, surface_stats, distance_stats, trainer_combo_stats
- **Why it matters for exotics**: Jockey/trainer combos have massive win% variance. A 5% overall trainer can be 22% with a specific rider.

## Trainer
- **Primary ID**: `trainer_id`
- **Key attributes**: name, current_meet_stats, win_pct, roi, first_time_starter_stats, layoff_stats (days since last race buckets), surface_change_stats, distance_change_stats, class_change_stats, medication_change_stats
- **Why it matters for exotics**: Trainer patterns (e.g., "lethal with first-time Lasix" or "wins at 30% dropping in class") are the highest-signal factors for longshot detection.

## Track
- **Primary ID**: `track_code` (3-letter code, e.g., SAR, DMR, CD, GP)
- **Key attributes**: name, location, surface_types, circumference_furlongs, stretch_length, altitude, typical_speed_figure_par (by class level), rail_bias_data
- **Why it matters**: Track bias (inside speed favoring, closer-friendly, etc.) directly shifts Monte Carlo probability distributions.

## Track Condition Profile
- **What it is**: Historical track bias data per surface/condition combo
- **Key attributes**: track_code, surface, condition, date_range, inside_vs_outside_win%, early_speed_vs_closers_win%, post_position_win_rates (array by PP 1-12+)
- **Why it matters for exotics**: If posts 1-3 win 45% on a given day's dirt surface, that reshapes every exotic combination.

## Race Card
- **What it is**: All races at a track on a given date — the container for horizontal exotics
- **Primary ID**: `card_id` (composite: track_code + date)
- **Key attributes**: track_code, date, num_races, first_post, multi_race_exotic_pools (pick3_legs, pick4_legs, pick5_legs, pick6_legs, daily_double_legs)
