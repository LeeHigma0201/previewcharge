# Keeneland — Saturday April 18, 2026 — Race Playbook

Live tool: **https://previewcharge-nine.vercel.app/** (login `jason` / `horse`)
Bookmark TwinSpires: https://www.twinspires.com/ — enable Keeneland in Track list.

> **Algorithm rule:** ability ranking stays stable; only the EV / tier / ticket layer shifts when you update live odds. Update odds as the tote board ticks down toward post — especially in the last 5 minutes.

---

## RACE 1 — 1:00 PM — 1 1/16m Dirt — Mdn 110k — 3yo+ F&M MSW — $110K

**Pace:** 6-horse field, no speed duel expected. Honest pace.

### Ability ranking (stable)
| Rank | # | Horse | Style | Win% |
|---|---|---|---|---|
| 1 | 6 | Sonhador | Closer | 19.5% |
| 2 | 3 | Reality Star | Stalker | 19.3% |
| 3 | 4 | Raghba | Presser | 18.5% |
| 4 | 2 | Song of Sarah | Presser | 17.4% |
| 5 | 1 | Miss Milky Way | Speed | 15.2% |
| 6 | 5 | Babysitter | Stalker | 10.1% |

### EV overlay (ML odds)
| # | Horse | ML | Model % | Market % | EV | Tier |
|---|---|---|---|---|---|---|
| 3 | Reality Star | 6/1 | 19.3% | 14% | 1.06 | **A** |
| 1 | Miss Milky Way | 8/1 | 15.2% | 11% | 1.06 | **A** |
| 6 | Sonhador | 4/1 | 19.5% | 20% | 0.76 | B |
| 4 | Raghba | 3/1 | 18.5% | 25% | 0.58 | × false fav |
| 2 | Song of Sarah | 2/1 | 17.4% | 33% | 0.41 | × false fav |
| 5 | Babysitter | 9/2 | 10.1% | 18% | 0.43 | × false fav |

**Primary anchor:** Reality Star #3 (A-tier, +35% edge at 6/1)
**Variance anchor:** Miss Milky Way #1 (A-tier, +36% edge at 8/1)

### Recommended plays (sorted by EV-per-dollar)

| Cost | Ticket | Hit% | Payoff | +EV |
|---|---|---|---|---|
| $1.00 | **Trifecta STRAIGHT #3-6-1** (Reality Star / Sonhador / Miss Milky Way) | 1.2% | ~$282 | +$2.39 |
| $2.00 | **Trifecta VARIANCE** #1 (8/1) keyed, BOX #3,#6 for 2-3 | 2.0% | ~$311 | +$4.26 |
| $6.00 | **Trifecta BOX** #6,#3,#1 | 6.2% | ~$292 | **+$12.21** (best EV) |
| $4.00 | **Exacta KEY** #3 over #6,#1 | 8.3% | ~$94 | +$3.80 |
| $12.00 | **Exacta BOX** #6,#3,#1 | 23.1% | ~$93 | +$9.51 |
| $2.00 | **Exacta STRAIGHT** #3 / #6 | 4.7% | ~$73 | +$1.43 |

### Small-bet / high-upside triple (total $3)
1. $1 Trifecta STRAIGHT #3-6-1 (algo base)
2. $2 Trifecta VARIANCE #1 / BOX #3,#6 (catches #1 win)
3. Skip exactas at this budget

### Balanced ($9 total)
Add $6 Trifecta BOX #6,#3,#1 to the above.

### TwinSpires steps (use tool's embedded instructions per ticket)
For each ticket, click the "▸ TwinSpires betting steps" expander in the tool.

### Watch at post time
- If Reality Star drifts shorter than 9/2, the market caught up — trim exacta stakes
- If Sonhador drifts shorter than 3/1, consider them an A-tier override
- Raghba at 5/1+ would be worth reconsidering (but unlikely to drift)

---

## How to use this playbook for Races 2-11

I've written separate directive prompts in `SESSION_DIRECTIVES.md` — one per race. Each directive is a self-contained prompt you can paste into a fresh Claude session. It will:
1. Load the live tool state
2. Refresh odds and intel via Gemini
3. Apply the algorithm's output
4. Produce this exact format of betting plan
5. Give you TwinSpires click-by-click instructions

Use them in sequence — one per new session — starting 20-30 minutes before each race's post time.
