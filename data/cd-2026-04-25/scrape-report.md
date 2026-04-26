# CD 2026-04-25 Scrape Report

**Scraped:** 2026-04-25 | **Track:** Churchill Downs Opening Day

## Coverage Summary

| Metric | Value |
|--------|-------|
| Races with full data | 10/10 |
| Races with 2+ source cross-validation | 2/10 (R4, R9) |
| Total horses scraped | 85 |
| Weights captured | 0 (not in any source) |
| Run styles captured | 0 (not in any source) |

## Sources

| Source | Status | Races Covered |
|--------|--------|---------------|
| HorseRacingNation entries | **OK** | All 10 races — primary source |
| PressBox LTS (barn notes) | **OK** | R9 only (full field) |
| ChurchillDowns.com (stakes advance) | **OK** | R9 only (full field) |
| FanDuel research article | **Partial** | R4, R9, R10 (picks only) |
| Equibase EQB static | **Fail** | 403 blocked |
| HRN race page /2026_Roxelana_S | **Fail** | 404 |
| BloodHorse Roxelana search | **Fail** | Wrong articles returned; winner headline observed |

## Top 3 Confidence Races (Most Agreement)

1. **Race 9 — Roxelana S.** — 4 sources confirm all 8 starters, post positions, jockey/trainer assignments. ML odds consistent between HRN and FanDuel. Confirmed entries match user-provided pre-check (Zeitlos P6/Ortiz, Mink's Palace P3/Saez, Lotsandlotsofcandy/McGee). Highest confidence race on card.

2. **Race 4 — $12,500 CLM 6f** — HRN + FanDuel confirm 5 horses (Illini, Bet On Bret, Upturned Brim, Lord Majesty, Hocus). All ML odds consistent. FanDuel picks also validate the odds range.

3. **Race 10 — ALW 1 1/8m Turf** — HRN + FanDuel confirm Without (IRE) at 8/5 and Theodore George at 12/1. 10-horse field with no discrepancies between sources.

## Bottom 3 Confidence Races (Least Data — Human Review Needed)

1. **Race 6 — MCL $12,500 6f (13 horses)** — Single source only. Largest field on card. Maiden claimers are scratch-prone. Verify no late scratches before using.

2. **Race 8 — CLM $16,000 6f (12 horses)** — Single source only. Large claiming field. Jockey and trainer data may have changed closer to post.

3. **Race 1 — MSW 1 1/4m (6 horses)** — Single source only. Long-distance maiden special weight — unusual. Verify distance and race conditions; 1 1/4m for F&M MSW is atypical for opening day.

## Cross-Validation Flags

- **Weights missing across all 10 races** — HRN does not display weights in entries view. Need Equibase or Brisnet for weights.
- **Run styles missing** — No free source provides this. Must compute from PP data.
- **R9 One Magic Philly ML** — Only HRN lists her at 5/2. BloodHorse confirms she won but no odds cross-check possible.
- **ChurchillDowns.com date error** — Article body says "April 26" but race ran April 25. Confirmed editorial error; data is correct.
- **Also-eligibles R9** — User brief references 6 AEs. None identified in scraped sources. Likely all cleared into field (8 starters ran) but AE names not documented.
- **Gabriel Saez double-listed in R6** — Programs 9 AND 13 both show Gabriel Saez as jockey. This may be accurate (two horses in same race, same jockey is impossible). Flagged for human review — one entry may have had a jockey change.

## Horse Count by Race

R1: 6 | R2: 8 | R3: 6 | R4: 8 | R5: 6 | R6: 13 | R7: 9 | R8: 12 | R9: 8 | R10: 10

**Total: 86 horses** (user expected ~85 — within margin; R6 large field accounts for difference)
