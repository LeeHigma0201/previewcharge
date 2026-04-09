# Metrics & Formulas — Exotic Horse Betting

## Core Speed Metrics

### Adjusted Speed Figure (ASF)
- **Definition**: Normalized performance rating accounting for track variant, distance, and surface
- **Formula**: `raw_speed_figure + track_variant + distance_adjustment + surface_adjustment`
- **Source**: Entry.speed_figure (Beyer/Brisnet/TimeformUS) → normalize to common 0-130 scale
- **Normalization**: `normalized = (raw - source_mean) / source_std * target_std + target_mean`
- **Caveats**: Different speed figure providers use different scales. Always normalize before comparing.

### Speed Figure Trend (SFT)
- **Definition**: Weighted slope of last N speed figures — detects improving/declining form
- **Formula**: `weighted_linear_regression(last_5_ASFs, weights=[5,4,3,2,1])` (most recent = highest weight)
- **Interpretation**: Positive slope = improving. > +3 per race = sharp improvement (longshot trigger).

### Peak Speed Figure (PSF)
- **Definition**: Highest ASF in lifetime or specified window
- **Formula**: `MAX(ASF) WHERE entry.date >= window_start`
- **Windows**: Last 1 year (primary), Last 2 years (secondary), Lifetime (tertiary)

### Class-Adjusted Speed Figure (CASF)
- **Definition**: ASF adjusted for the class level of the race it was earned in
- **Formula**: `ASF + (today_class_par - earned_class_par) * 0.5`
- **Why**: A 90 Beyer in a G1 stakes is not the same as a 90 in a $16K claimer

## Pace Analysis Metrics

### Early Pace Figure (EP)
- **Definition**: Speed through the first call (typically first 2-4 furlongs depending on distance)
- **Formula**: For sprints (≤7f): `feet_per_second(first_call_distance, first_fractional_time)` normalized to 0-130 scale. For routes (>7f): use half-mile time.

### Late Pace Figure (LP)
- **Definition**: Speed from the last intermediate call to the finish
- **Formula**: `feet_per_second(stretch_distance, final_time - last_call_time)` normalized

### Pace Shape Classification
- **Categories**: E (Early speed, on lead), EP (Early presser, 1-3 lengths off), P (Presser, stalking), S (Sustained, mid-pack closer), C (Deep closer, last to first)
- **Assignment**: Based on running position at first call relative to field size
- **Formula**: `position_at_first_call / field_size` → E: 0-0.2, EP: 0.2-0.4, P: 0.4-0.6, S: 0.6-0.8, C: 0.8-1.0

### Pace Scenario Probability
- **Definition**: Probability of contested (hot) vs uncontested (slow) early pace
- **Formula**: Count horses with EP classification (E or EP). If ≥3 E-types → "hot pace" probability HIGH. If 1 or 0 E-types → "slow pace" probability HIGH.
- **Impact on exotics**: Hot pace = closers improve, longshot closers become live. Slow pace = speed horses hold, favorites more likely to wire the field.

## Form Cycle Metrics

### Days Since Last Race (DSLR)
- **Definition**: Calendar days between today and horse's last race
- **Thresholds**: Fresh (0-30), Short rest (31-60), Normal (61-90), Freshened (91-180), Extended layoff (181-365), Long layoff (365+)
- **Interaction**: Cross-reference with trainer_layoff_stats. Some trainers are 35% with 60-90 day layoffs.

### Class Movement
- **Definition**: Direction and magnitude of class change from last race
- **Formula**: `today_class_level - last_race_class_level` (positive = dropping, negative = rising)
- **Encoding**: class_levels mapped numerically: MCL=1, MSW=2, CLM_low=3, CLM_mid=4, CLM_high=5, ALW=6, ALW_N/W2=7, Stakes=8, G3=9, G2=10, G1=11

### Surface/Distance Change Flags
- **surface_change**: Boolean — different surface than last race
- **distance_change**: Categorical — shorter/same/longer (with magnitude in furlongs)
- **first_time_surface**: Boolean — horse has never raced on today's surface
- **first_time_distance_range**: Boolean — horse has never raced at today's distance category (sprint/route)

## Monte Carlo Input Variables

### Win Probability (pre-simulation)
- **Definition**: Base probability derived from CASF relative to field
- **Formula**: `softmax(CASF_i / temperature)` across all entries i in the race
- **Temperature**: 15-20 (higher = more entropy = more longshot-friendly)
- **NOT used for betting decisions** — this is the INPUT to Monte Carlo, not the output

### Finish Distribution Parameters
- **Per horse**: `mu = predicted_final_time, sigma = std_dev(last_5_final_times)`
- **Correlation structure**: Pace-dependent. E-type horses are negatively correlated with each other (if one leads, others are closer). C-types are positively correlated (all benefit from pace collapse).

### Simulation Output Metrics
- **sim_win_pct**: % of N simulations where horse finishes 1st
- **sim_exacta_pct[i][j]**: % of sims with horse i 1st, horse j 2nd
- **sim_trifecta_pct[i][j][k]**: % of sims with exact 1-2-3 order
- **sim_superfecta_pct[i][j][k][l]**: % of sims with exact 1-2-3-4
- **sim_in_top2_pct**: % of sims horse finishes 1st or 2nd (key for exacta coverage)
- **sim_in_top3_pct**: % of sims horse finishes top 3 (key for trifecta coverage)
- **sim_in_top4_pct**: % of sims horse finishes top 4 (key for superfecta coverage)

## Longshot Alert Metrics

### Probability Divergence Score (PDS)
- **Definition**: How much the Monte Carlo sim disagrees with the public odds
- **Formula**: `PDS = sim_win_pct / implied_prob_from_odds`
- **Where**: `implied_prob_from_odds = 1 / (decimal_odds)` (after takeout adjustment)
- **Alert threshold**: PDS > 2.0 = Monte Carlo says horse is 2x more likely than odds imply
- **CRITICAL**: PDS > 2.0 alone doesn't trigger an alert. Must also pass the "capable" filter.

### Capable Longshot Filter
- **Definition**: Minimum performance thresholds a horse must meet to be flagged despite high odds
- **Criteria (ALL must pass)**:
  1. `PSF_1year >= race_class_par - 5` (has run a figure within 5 points of today's class)
  2. `SFT >= 0` (not in declining form)
  3. `DSLR <= 90 OR trainer_layoff_win_pct >= 15%` (not stale, or trainer wins off layoffs)
  4. `sim_win_pct >= 8%` (Monte Carlo gives real chance, not noise)
  5. `pace_scenario_favorable = TRUE` (pace shape matches probable pace scenario)

### Expected Value Per Dollar (EVPD)
- **Definition**: For each exotic combination, the expected payout per $1 wagered
- **Formula (exacta example)**: `EVPD = sim_exacta_pct[i][j] * estimated_exacta_payoff[i][j]`
- **Estimated payoff**: Derived from probable pool distribution (odds-based approximation)
- **Bet threshold**: EVPD > 1.5 for vertical exotics, EVPD > 2.0 for horizontal exotics (higher variance needs higher edge)
