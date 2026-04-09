# Exotic Bet Structures

## Vertical Exotics (Single Race)

### Exacta
- **What**: Pick 1st and 2nd in exact order
- **Combinations**: `N * (N-1)` where N = number of horses used
- **Cost formula**: `base_bet * num_combinations`
- **Strategy**: Use Monte Carlo `sim_exacta_pct[i][j]` matrix. Key horses with PDS > 2.0 as the "over" horse (underlays by public). Box capable longshots with 2-3 logical contenders.
- **Key data**: sim_in_top2_pct, sim_exacta_pct matrix

### Trifecta
- **What**: Pick 1st, 2nd, 3rd in exact order
- **Combinations**: `N * (N-1) * (N-2)` for full box, but use partial/keyed structures
- **Structures**:
  - Key on top: 1 horse in 1st, X in 2nd, Y in 3rd → `1 * X * Y` combos
  - Key in 2nd: X in 1st, 1 horse in 2nd, Y in 3rd
  - Wheel: 1 horse with ALL others
  - Part-wheel: 1 horse with SELECTED others in remaining spots
- **Strategy**: Key the most likely winner (highest sim_win_pct). Spread 2nd/3rd with capable longshots. The "underneath" spots (2nd, 3rd) is where longshot value lives.
- **Key data**: sim_trifecta_pct tensor, sim_in_top3_pct

### Superfecta
- **What**: Pick 1st through 4th in exact order
- **Combinations**: `N * (N-1) * (N-2) * (N-3)` — explodes fast
- **Minimum bet**: Usually $0.10 (vs $1-2 for exacta/trifecta)
- **Strategy**: This is THE longshot bet. Use Monte Carlo to find 10-cent combos where sim probability × estimated payoff > $0.15 (50% edge minimum for the variance).
- **Key data**: sim_superfecta_pct tensor, sim_in_top4_pct

## Horizontal Exotics (Multi-Race)

### Daily Double
- **What**: Pick winners of 2 consecutive races
- **Combinations**: `R1_selections * R2_selections`
- **Strategy**: Single (or very few) in the "strong opinion" race, spread in the "weak opinion" race. If one leg has a PDS > 2.0 longshot, use it as the single.
- **Key data**: sim_win_pct per horse per race

### Pick 3
- **What**: Winners of 3 consecutive races
- **Combinations**: `R1 * R2 * R3`
- **Budget allocation**: Identify the "spread" leg (most uncertainty) and the "single" leg (highest confidence). Budget = base_bet * total_combos.
- **Strategy**: At least one leg should contain a capable longshot to create payoff asymmetry.

### Pick 4
- **What**: Winners of 4 consecutive races
- **Ticket construction**: Singles (1 horse) × Contenders (2-3 horses) × Spreads (4-6 horses)
- **Budget target**: $24-$96 range for $0.50 base
- **Strategy**: Need at least 1 single to keep cost manageable. The single should be your HIGHEST conviction play — where sim_win_pct aligns with a clear favorite OR where a capable longshot has PDS > 3.0.

### Pick 5
- **What**: Winners of 5 consecutive races
- **Unique feature**: Usually has mandatory payout days (forces full pool distribution)
- **Strategy**: Build two tickets: (A) "chalk" ticket with favorites/contenders, (B) "bomb" ticket with capable longshots in 2+ legs. The bomb ticket has low hit rate but massive ROI when it connects.

### Pick 6
- **What**: Winners of 6 consecutive races — the "lottery" bet
- **Jackpot structure**: Usually carryover pool. Only pays if you hit all 6 (consolation for 5/6).
- **Strategy**: Only play on large carryover days. Use Monte Carlo to find the 1-2 races with highest entropy (most uncertain outcomes) and spread those legs wide. Single the 2-3 most predictable legs.
- **Key data**: sim_win_pct distributions, race_entropy score

## Ticket Optimization Formulas

### Race Entropy
- **Definition**: How unpredictable a race is based on Monte Carlo output
- **Formula**: `H = -SUM(sim_win_pct[i] * log2(sim_win_pct[i]))` for all horses i
- **High entropy** (>3.0 bits): Wide-open race, spread this leg
- **Low entropy** (<2.0 bits): Predictable race, single or narrow this leg

### Optimal Ticket Cost
- **Principle**: Total ticket cost should be ≤ 2% of bankroll per card
- **Formula**: `max_ticket_cost = bankroll * 0.02`
- **Allocation**: Split ~60% to vertical exotics (exacta/tri/super), ~40% to horizontal (picks/doubles)

### Coverage Efficiency Score (CES)
- **Definition**: How much of the Monte Carlo probability space your ticket covers per dollar spent
- **Formula**: `CES = SUM(sim_prob_of_each_combo_on_ticket) / ticket_cost`
- **Target**: CES > 1.5 means your ticket covers 1.5x the probability you'd expect from random allocation

### Longshot Placement Strategy
- **Vertical exotics**: Longshots go in 2nd/3rd/4th slots (underneath), NOT on top. The public keys favorites on top — your edge is the underneath positions.
- **Horizontal exotics**: Longshots go in 1-2 legs as singles or "A" horses. This creates maximum payoff asymmetry. If you spread longshots across all legs, the ticket cost eats the edge.
- **Alert trigger**: When a horse has PDS > 2.0 AND passes the Capable Longshot Filter, flag it with a recommended position in each exotic structure.
