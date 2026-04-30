# HorseGPT v3.14 — Build the 8 Exotic Betting Gaps

Read CLAUDE.md first. Then build these 8 features in order. Each one builds on the last. Run `make test` after each to confirm nothing breaks.

## Gap 1: Superfecta Probabilities (monte_carlo.py)

Add `top4_probs` (ndarray shape n) and `superfecta_probs` (dict of tuple→float, NOT a 4D tensor — too much memory) to `SimulationResult`. Update `henery_simulate()` to tally 4th place finishes and store top-N superfecta combos (keep only combos with prob > 1/n^4 to avoid dict bloat). Add superfecta support to `find_value_exotics()`.

## Gap 2: Capable Longshot Filter (longshot/signals.py)

Add a `capable_longshot_filter()` function that takes a `LongshotCandidate` + entry features and returns True only if ALL 5 pass:
1. `best_beyer >= race_class_par - 5` (has run a competitive figure)
2. `beyer_trend >= 0` (not declining)  
3. `days_since_last <= 90 OR trainer_layoff_win_pct >= 0.15`
4. `sim_win_pct >= 0.08` (Monte Carlo gives real chance)
5. `pace_scenario_favorable == True` (pace shape matches — closer in hot pace, speed in soft pace)

Wire this into `identify_longshot_candidates()` so candidates that fail the filter get flagged `capable=False` but still appear in output (user can see why they were filtered).

## Gap 3: Jockey/Trainer Combo Stats (features/core.py)

Add to `compute_jockey_trainer_features()`:
- `combo_win_pct`: Win% when this exact jockey/trainer pair works together
- `combo_starts`: Number of starts for this combo
- `combo_roi`: ROI for this combo
- `combo_uplift`: `combo_win_pct - max(jockey_win_pct, trainer_win_pct)` — how much better they are together

Query: filter Entry by `jockey == X AND trainer == Y AND race_date < today`. Minimum 5 starts to compute, else None.

## Gap 4: Track Bias Table (new file: src/data/track_bias.py + model update)

Create a new SQLAlchemy model `TrackBias`:
```python
class TrackBias(Base):
    __tablename__ = "track_bias"
    id, track_code, surface, condition, date_range_start, date_range_end,
    post_position_win_rates (JSON — list of floats indexed by PP),
    early_speed_win_pct, closer_win_pct, inside_win_pct, outside_win_pct,
    sample_size
```

Add a `compute_track_bias()` function that queries historical results for a track/surface/condition combo over the last 90 days and calculates PP win rates and style win rates. Add `track_bias_advantage` feature to `core.py` that looks up the bias for today's track/surface/condition and returns how much it helps this horse's PP and running style.

## Gap 5: Race Entropy (new: src/models/entropy.py)

```python
def race_entropy(win_probs: np.ndarray) -> float:
    """Shannon entropy of win probability distribution. Higher = more uncertain."""
    p = win_probs[win_probs > 0]
    return -np.sum(p * np.log2(p))
```

Add to `SimulationResult` as a computed property. This is used by the horizontal exotic sequencer to decide which legs to spread vs single.

## Gap 6: Horizontal Exotic Sequencer (new: src/models/horizontal.py)

Build ticket construction for daily double, pick 3, pick 4, pick 5, pick 6:

```python
@dataclass
class HorizontalTicket:
    bet_type: str  # "daily_double", "pick3", "pick4", "pick5", "pick6"
    legs: list[list[int]]  # List of program numbers per leg
    cost: float
    coverage_prob: float  # Sum of sim probabilities covered
    ces: float  # Coverage Efficiency Score = coverage_prob / cost

def build_horizontal_ticket(
    races: list[SimulationResult],
    bet_type: str,
    budget: float,
    base_bet: float = 0.50,
    alert_entries: list[list[int]] | None = None,  # Capable longshot alerts per leg
) -> HorizontalTicket:
```

Logic:
1. Compute entropy per race leg
2. Low entropy legs → single (1-2 horses), high entropy → spread (3-5 horses)
3. Always include capable longshot alerts in their leg's selections
4. Optimize total combos to fit within budget
5. Return ticket with cost and CES score

## Gap 7: Per-Combo EVPD (longshot/value.py)

Add to `value.py`:
```python
def compute_exotic_evpd(
    sim: SimulationResult,
    odds: np.ndarray,
    takeout: dict[str, float],  # {"exacta": 0.19, "trifecta": 0.235, "superfecta": 0.25, ...}
) -> dict[str, list[dict]]:
```

For each exotic type, compute estimated payoff per combo using odds-based approximation:
- `estimated_payoff = (1 / combo_implied_prob) * (1 - takeout)`
- `evpd = sim_prob * estimated_payoff`
- Return top 20 combos by EVPD for each exotic type

## Gap 8: Live Odds Pipeline (new: src/data/scrapers/live_odds.py)

Create a scraper that polls odds from a free source every 5 minutes in the 30 minutes before post time. Store in a new `OddsSnapshot` model:
```python
class OddsSnapshot(Base):
    __tablename__ = "odds_snapshots"
    id, race_id, timestamp, program_number, win_odds, 
    exacta_probable (JSON), trifecta_probable (JSON)
```

Add a `get_latest_odds()` function that returns the most recent snapshot for a race. This feeds the PDS calculation at post time.

## Testing

After all 8 gaps, add tests in `tests/`:
- `test_superfecta.py` — verify superfecta probs sum correctly
- `test_capable_filter.py` — verify 5-point filter with edge cases
- `test_horizontal.py` — verify ticket cost matches num_combos * base_bet
- `test_entropy.py` — verify entropy ranges (0 for certainty, log2(n) for uniform)
- `test_evpd.py` — verify EVPD > 0 for all returned combos

Run `make test` and `make lint` at the end.
