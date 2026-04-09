# Monte Carlo Simulation Pipeline

## Architecture Overview

```
[Scraped Data] → [Normalization] → [Feature Engineering] → [Distribution Fitting] 
    → [Correlation Matrix] → [N Simulations] → [Finish Order Tallies] 
    → [Probability Matrices] → [EVPD Calculation] → [Alert Engine]
```

## Step 1: Normalization Layer

### Input: Raw scraped past performances
- final_time_seconds (per entry)
- speed_figures (Beyer/Brisnet/TimeformUS)
- fractional_times array
- running_positions array
- beaten_lengths

### Normalize to common scale
```python
# Convert all speed figures to 0-130 Beyer-equivalent scale
def normalize_speed_figure(raw, source):
    params = {
        'beyer': {'mean': 75, 'std': 15},
        'brisnet': {'mean': 80, 'std': 14},
        'timeformus': {'mean': 78, 'std': 16},
    }
    src = params[source]
    target = params['beyer']
    return (raw - src['mean']) / src['std'] * target['std'] + target['mean']
```

### Convert times to feet-per-second
```python
def time_to_fps(distance_furlongs, time_seconds):
    feet = distance_furlongs * 660
    return feet / time_seconds
```

## Step 2: Feature Engineering

### Per-horse feature vector for each race
```python
features = {
    'casf': float,              # Class-Adjusted Speed Figure
    'sft': float,               # Speed Figure Trend (slope)
    'psf_1yr': float,           # Peak Speed Figure, 1 year
    'ep_figure': float,         # Early Pace Figure
    'lp_figure': float,         # Late Pace Figure
    'pace_shape': str,          # E/EP/P/S/C classification
    'dslr': int,                # Days Since Last Race
    'class_movement': int,      # Class level delta
    'surface_change': bool,
    'distance_change': float,   # Delta in furlongs
    'jockey_win_pct': float,
    'trainer_win_pct': float,
    'jockey_trainer_combo_pct': float,
    'post_position': int,
    'weight_carried': int,
    'medication_change': bool,
    'equipment_change': bool,
    'track_bias_advantage': float,  # From track condition profile
}
```

## Step 3: Distribution Fitting

### Predicted finish time distribution per horse
```python
import numpy as np
from scipy import stats

def fit_horse_distribution(horse_entries, today_race):
    """
    Returns (mu, sigma) for predicted finish time in seconds.
    """
    # Get last 5 relevant races (same surface, similar distance)
    relevant = filter_relevant_races(horse_entries, today_race)
    
    if len(relevant) < 3:
        # Insufficient data — use class par with high uncertainty
        mu = get_class_par_time(today_race.class_level, today_race.distance)
        sigma = 2.0  # High uncertainty = 2 second std dev
        return mu, sigma
    
    # Adjust historical times to today's conditions
    adjusted_times = []
    for entry in relevant:
        adj = entry.final_time_seconds
        adj += track_variant_adjustment(entry, today_race)
        adj += distance_adjustment(entry, today_race)
        adj += class_adjustment(entry, today_race)
        adjusted_times.append(adj)
    
    mu = np.average(adjusted_times, weights=[5,4,3,2,1][:len(adjusted_times)])
    sigma = np.std(adjusted_times)
    sigma = max(sigma, 0.3)  # Floor at 0.3s — no horse is that consistent
    
    # Apply form cycle adjustments
    if horse.sft > 3:  # Improving form
        mu -= 0.3  # Shift faster
    elif horse.sft < -3:  # Declining form
        mu += 0.3  # Shift slower
    
    return mu, sigma
```

## Step 4: Correlation Structure

### Why correlations matter for exotics
Horses don't finish independently. If the pace is hot, ALL closers improve simultaneously. This creates correlated finishes that are critical for exacta/trifecta/superfecta accuracy.

```python
def build_correlation_matrix(entries, pace_scenario_prob):
    """
    Returns NxN correlation matrix for finish times.
    """
    n = len(entries)
    corr = np.eye(n)
    
    for i in range(n):
        for j in range(i+1, n):
            # Same pace shape = positively correlated
            if entries[i].pace_shape == entries[j].pace_shape:
                if entries[i].pace_shape in ('E', 'EP'):
                    # Speed horses hurt each other
                    corr[i][j] = corr[j][i] = 0.3
                else:
                    # Closers benefit together from pace collapse
                    corr[i][j] = corr[j][i] = 0.25
            
            # Opposite pace shapes = negatively correlated
            elif (entries[i].pace_shape in ('E','EP') and 
                  entries[j].pace_shape in ('S','C')):
                corr[i][j] = corr[j][i] = -0.15
            
            else:
                corr[i][j] = corr[j][i] = 0.05  # Mild positive default
    
    return corr
```

## Step 5: Simulation Engine

```python
from scipy.stats import multivariate_normal

def run_monte_carlo(entries, n_sims=10000):
    """
    Returns finish order frequencies for all exotic bet types.
    """
    n = len(entries)
    
    # Build distribution parameters
    mus = []
    sigmas = []
    for entry in entries:
        mu, sigma = fit_horse_distribution(entry.past_performances, entry.race)
        mus.append(mu)
        sigmas.append(sigma)
    
    mus = np.array(mus)
    sigmas = np.array(sigmas)
    corr = build_correlation_matrix(entries)
    
    # Build covariance matrix from correlation + individual sigmas
    cov = np.outer(sigmas, sigmas) * corr
    
    # Run simulations
    sim_times = multivariate_normal.rvs(mean=mus, cov=cov, size=n_sims)
    
    # Tally results
    results = {
        'win_count': np.zeros(n),
        'top2_count': np.zeros(n),
        'top3_count': np.zeros(n),
        'top4_count': np.zeros(n),
        'exacta_count': np.zeros((n, n)),
        'trifecta_count': np.zeros((n, n, n)),
        # Superfecta stored as dict of tuples for memory efficiency
        'superfecta_count': defaultdict(int),
    }
    
    for sim in range(n_sims):
        # Lower time = faster = better finish
        order = np.argsort(sim_times[sim])
        
        results['win_count'][order[0]] += 1
        for pos in range(min(2, n)):
            results['top2_count'][order[pos]] += 1
        for pos in range(min(3, n)):
            results['top3_count'][order[pos]] += 1
        for pos in range(min(4, n)):
            results['top4_count'][order[pos]] += 1
        
        if n >= 2:
            results['exacta_count'][order[0]][order[1]] += 1
        if n >= 3:
            results['trifecta_count'][order[0]][order[1]][order[2]] += 1
        if n >= 4:
            key = (order[0], order[1], order[2], order[3])
            results['superfecta_count'][key] += 1
    
    # Convert to probabilities
    for key in ['win_count', 'top2_count', 'top3_count', 'top4_count']:
        results[key.replace('count','pct')] = results[key] / n_sims
    results['exacta_pct'] = results['exacta_count'] / n_sims
    results['trifecta_pct'] = results['trifecta_count'] / n_sims
    results['superfecta_pct'] = {k: v/n_sims for k,v in results['superfecta_count'].items()}
    
    return results
```

## Step 6: Alert Engine

```python
def generate_alerts(sim_results, entries, odds):
    """
    Flag capable longshots with positive expected value in exotic positions.
    """
    alerts = []
    n = len(entries)
    
    for i in range(n):
        horse = entries[i]
        implied_prob = 1.0 / odds[i]  # Convert decimal odds
        sim_win = sim_results['win_pct'][i]
        pds = sim_win / implied_prob if implied_prob > 0 else 0
        
        # Check Capable Longshot Filter
        if pds < 2.0:
            continue
        if horse.psf_1yr < horse.race.class_par - 5:
            continue
        if horse.sft < 0:
            continue
        if horse.dslr > 90 and horse.trainer_layoff_win_pct < 0.15:
            continue
        if sim_win < 0.08:
            continue
        
        alert = {
            'horse': horse.name,
            'program_number': horse.program_number,
            'pds': pds,
            'sim_win_pct': sim_win,
            'board_odds': odds[i],
            'capable': True,
            'recommended_exotic_positions': [],
        }
        
        # Determine best exotic placement
        if sim_results['top2_pct'][i] > 0.15:
            alert['recommended_exotic_positions'].append('EXACTA_UNDERNEATH')
        if sim_results['top3_pct'][i] > 0.20:
            alert['recommended_exotic_positions'].append('TRIFECTA_2ND_3RD')
        if sim_results['top4_pct'][i] > 0.25:
            alert['recommended_exotic_positions'].append('SUPERFECTA_SPREAD')
        if pds > 3.0 and sim_win > 0.12:
            alert['recommended_exotic_positions'].append('HORIZONTAL_SINGLE')
        
        alerts.append(alert)
    
    return alerts
```

## Step 7: Horizontal Exotic Sequencer

```python
def build_horizontal_ticket(races, sim_results_per_race, budget, bet_type='pick4'):
    """
    Construct optimal multi-race ticket given budget constraint.
    """
    num_legs = {'daily_double': 2, 'pick3': 3, 'pick4': 4, 'pick5': 5, 'pick6': 6}
    legs = num_legs[bet_type]
    base_bet = 0.50 if legs >= 4 else 1.00
    
    # Calculate entropy per race
    entropies = []
    for race_sims in sim_results_per_race:
        win_pcts = race_sims['win_pct']
        h = -np.sum(win_pcts * np.log2(win_pcts + 1e-10))
        entropies.append(h)
    
    # Sort legs by entropy
    leg_order = np.argsort(entropies)  # Low entropy first (best singles)
    
    # Allocate horses per leg
    max_combos = budget / base_bet
    selections_per_leg = allocate_selections(entropies, max_combos, legs)
    
    ticket = []
    for leg_idx in range(legs):
        race_sims = sim_results_per_race[leg_idx]
        n_selections = selections_per_leg[leg_idx]
        
        # Pick top N by sim_win_pct, but include any PDS > 2.0 alerts
        candidates = list(range(len(race_sims['win_pct'])))
        candidates.sort(key=lambda x: race_sims['win_pct'][x], reverse=True)
        
        # Always include capable longshot alerts
        alert_horses = [i for i in candidates if is_alert(i, race_sims)]
        top_horses = candidates[:n_selections]
        
        leg_selections = list(set(top_horses + alert_horses))[:n_selections + 1]
        ticket.append(leg_selections)
    
    return ticket
```

## Simulation Parameters

| Parameter | Default | Range | Notes |
|-----------|---------|-------|-------|
| n_sims | 10,000 | 5K-50K | Higher for superfecta accuracy |
| temperature | 17 | 12-25 | Controls base probability spread |
| min_sigma | 0.3s | 0.2-0.5 | Floor for time std dev |
| form_adjustment | 0.3s | 0.1-0.5 | SFT impact on predicted time |
| corr_same_pace | 0.3 | 0.1-0.5 | Correlation between same pace types |
| corr_opposite_pace | -0.15 | -0.3 to 0 | Anti-correlation between E and C types |
| pds_alert_threshold | 2.0 | 1.5-3.0 | Minimum PDS to trigger longshot alert |
| min_sim_win_pct | 0.08 | 0.05-0.12 | Floor sim win% for capable filter |
| evpd_vertical_threshold | 1.5 | 1.2-2.0 | Min EV for vertical exotic bets |
| evpd_horizontal_threshold | 2.0 | 1.5-3.0 | Min EV for horizontal exotic bets |
