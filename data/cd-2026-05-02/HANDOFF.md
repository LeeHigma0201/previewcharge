# Derby 152 Session Handoff — 2026-05-02

**Session ended:** 2026-05-02 ~00:20 ET (Saturday morning, ~16 hours before Derby post)
**Worktree:** `/Users/jason/previewcharge/.claude/worktrees/dreamy-tu-73504c`
**Branch:** `claude/dreamy-tu-73504c`
**PR:** [#8](https://github.com/LeeHigma0201/previewcharge/pull/8) (open, head commit `93accf4`)

---

## What was built this session

### 1. CLAUDE.md rewritten (PR #8 commit `ff8eb1b`)
Prior version pre-dated entire layers. Now covers:
- Two-stage Benter architecture (Stage 1 ability, Stage 2 overlay)
- Agent-dispatch pattern (`src/agents/dispatcher.py` + `keeneland_preview.py`)
- Daily card workflow (`process_card.py`, `sandbox_score.py`, `data/cd-*/`)
- Betting + longshot layers, web frontend boundary
- 7 SQLAlchemy tables (added TrackBias, OddsSnapshot)

### 2. Pulled in Apr 30 merged data
3 commits ahead landed: ALGO_THESIS.md, CD_2026_04_30_DAILY_REPORT.md, PICKS_THINKING_LOG.md, results.json, R9/R10/R11 pool snapshots, algo-perf-summary.json, web/bets/page.tsx LEARNED banner + scorecard.

### 3. Google Sheet for Derby Day live tracking
**URL:** https://docs.google.com/spreadsheets/d/1sjDEqTjwFtXa4MMTyKSNiIzw3hjYrxefwYJlGJDyzJ0/edit

**13 tabs (gid in parens):**
| Tab | Status | Purpose |
|---|---|---|
| Card (0) | populated 14 races | Race info, post times, distance/surface/purse, stakes flags |
| Entries (1343826769) | populated 169 horses | Saddle/post/horse/jockey/trainer/ML |
| Pools (1487302951) | empty | Live W/P/S pool % capture |
| Horses (1417549449) | populated 24 Derby | Per-Derby-horse: sire/dam_sire/Beyer/HRN/preps/style/key signals |
| Jockeys (2066285679) | populated 15 | Hot/cold tier, YTD stats, Derby record, mounts |
| Trainers (1920720223) | populated 19 | Derby lifetime, 2026 prep wins, flags |
| Pace (2028078595) | empty | Per-race pace projections (Wave 2) |
| TrackBias (2090673642) | populated | CD spring 2026 bias + Saturday weather |
| DerbyTrends (129919148) | populated | 20yr post records, every winner, chalk drought |
| Results | empty | Post-race finishes + payouts |
| Bets | empty | What I bet, what hit |
| Scorecard | empty | Cumulative metrics |
| Sheet13 | buffer | reserve |

### 4. Wave 1 parallel Sonnet agents (5/5 complete)
All saved as JSON in `data/cd-2026-05-02/`:
- `raw-entries.json` — full 14-race CD card from HRN
- `derby-horses-1-12.json` — Renegade through Chief Wallabee deep-dive
- `derby-horses-13-24.json` — Silent Tactic through Corona de Oro (incl. AE)
- `jockey-stats.json` — 15 jockeys hot/cold tier
- `trainer-stats.json` — 19 trainers Derby record + 2026 preps
- `track-bias-derby-trends.json` — CD bias + 20yr Derby + Saturday weather
- `DERBY_INTEL.md` — digest of load-bearing findings + locked betting rules
- `sheet-url.txt` — sheet pointer + tab gid map

### 5. .gitignore + commit
Added Derby Day file allowlist patterns. Committed `93accf4` and pushed to PR #8.

### 6. Cortex pattern logged
Stored the per-entity parallel-agent pattern under HorseGPT for future race-day reuse.

---

## Field state (Saturday morning)

**Derby final field: 20 starters** (out of 20 main + 4 AE):

**Scratches (3):**
- PP5 Right to Party (McPeek) — vet right-front lameness May 1, McPeek disputed
- PP13 Silent Tactic (Casse) — bruised foot Apr 29, pointing Preakness
- PP20 Fulleffort (Cox) — chipped ankle Apr 30, never raced on dirt anyway

**AE draw-ins (3):**
- Great White (Ennis) — drew in for Silent Tactic
- Ocelli (Beckman) — drew in for Fulleffort (only maiden in field)
- Robusta (O'Neill) — drew in for Right to Party, **inherits post 20 (far outside)**

**Did not draw in:** Corona de Oro (Stewart) at 9 AM deadline May 1.

---

## The 5 algo signals that matter for the Derby

1. **Renegade #1 4-1 chalk has DOUBLE historical headwind**
   - Post 1: 0-for-91 since Ferdinand 1986 (40-yr drought)
   - Chalk drought: 0/7 ML favorites have won since Justify 2018
   - Pletcher: 2-for-65 lifetime (3.1%)
   - Private clockers note workouts not sharpest

2. **Six Speed #17 50-1 = DEAD post**
   - Post 17 has NEVER produced a Derby winner all-time (0-for-42)
   - Already had stamina concern after fading late in UAE Derby

3. **Emerging Market #15 15-1 = best overlay combo**
   - Post 15 = 10.2% historical (Orb 2013, American Pharoah 2015)
   - Closer style + Chad Brown (0-for-9 first Derby win attempt)
   - Bullet 4f at CD on 4/18
   - Concern: only 3rd career start (last Derby winner in 3rd was Leonatus 1883)

4. **Further Ado #18 6-1 = field-best Beyer 106**
   - Post 18 = Sovereignty 2025 + American Pharoah 2015 won here
   - Blue Grass G1 by 11L (HRN 127)
   - Velazquez = 3-time Derby winner (would tie 4-Derby record)
   - Concern: Gun Runner sons historically underperform Derby vs preps

5. **Beyer 100+ club has only 3 horses**
   - Further Ado 106 (PP18, 6-1)
   - Commandment 101 (PP6, 6-1) — exact prep clone of Sovereignty 2025
   - So Happy 100 (PP8, 15-1 ML → 6-1 live, sharp money move)
   - **These are the algo top-3 lock.**

### Bonus signals
- **Jose Ortiz HOT** — 5-for-13 on Oaks Day (5/1) including the Oaks G1; he rides **Golden Tempo PP19 30-1**
- **Chief Wallabee #12 8-1** — first-time blinkers, Mott "monster work" April 20, defending champ Mott/Alvarado
- **Incredibolt #11 20-1** — 2-for-2 at Churchill Downs specifically
- **Danon Bourbon #7 20-1 → 14-1** — Japanese sharp money move on undefeated 3-for-3 horse
- **The Puma #9 10-1** — FL Derby G1 2nd by NOSE to Commandment, mirrors Mage 2023 + Sovereignty 2025 path

---

## Weather (LOCKED for Saturday)

- **Mostly sunny through 6pm**, 16% precip at 6:57 PM post
- 60°F, 6 mph N wind
- **Dirt: FAST. Turf: FIRM. No off-turf scenario.**
- Speed horses get full benefit. Closer-friendly fractions still possible in 20-horse Derby pace pressure.

---

## Locked betting rules (from Apr 30 review)

1. **The algo's top-N ranking is the base layer.** Don't override on pool flags.
2. **Chalk-doubt flag does NOT apply in stakes with top-tier J+T.** N=3 same direction failure (R9/R10/R11 last Thursday). Derby is the ultimate stakes — IGNORE flag fires on Renegade/Commandment/Further Ado/Chief Wallabee/Emerging Market.
3. **Smart-money board (P>W on non-chalk) = BOARD predictor for under-spread.** Use for 4th/5th horse selection in tri/super.
4. **Use algo top-4 in tri/super, top-5 for Derby super box** (chaos coverage on 20-horse field).
5. **Fractional Kelly 25%, 2% bankroll cap per longshot.**
6. **Closers dominated 35% of last 20 winners.** 20-horse Derby creates brutal pace pressures.

---

## Mac session betting losses to learn from

Apr 30 net was **~-$13.50 on $17 wagered** because the Mac Claude session **faded chalks based on flag overrides** in stakes (R9 Lagynos, R10 Maximum Bourbon — both lost the bet). The algo had #9 in its top-3 — flag fade was wrong twice. **The corrected framework: pool flags = secondary signals, not win-prob overrides.**

---

## What's NOT done (work for next session)

### Highest value:
1. **Wave 2 per-race pace agents** for non-Derby stakes (R4 Derby City Distaff, R7 Churchill Distaff Turf Mile, R8 Pat Day Mile, R9 American Turf, R10 Churchill Downs S, R11 Bourbon Turf Classic). Each agent: project E/EP/P/S/C distribution, lone-speed candidates, hot-pace setup, top-2/3 algo picks. ~6 parallel Sonnet agents.

### Race-day execution:
2. **Final vet/scratch sweep** Saturday morning before R1 (late scratches change post positions on AE).
3. **Live odds + pool % capture** during the day. Empty Pools tab is ready — populate via Wave 2 polling agent or manual TwinSpires scrape.
4. **Stage 2 overlay scoring** — once live odds are in, compute model_prob vs implied_prob for each race, identify overlays. The repo has `src/models/overlay.py` for this.
5. **Ticket construction** — apply locked rules to build:
   - Win bets on top-3 by Beyer (Further Ado, Commandment, So Happy)
   - $1 EX BOX algo top-2 every race (the strategy that produced +222.7% on Apr 30 backtest, but driven by R5 outlier — N=1 caveat)
   - $0.10 SUPER BOX algo top-5 for Derby
   - Smart-money board horses for 4th/5th in tri/super under-spreads
6. **Results + Scorecard population** post-race.

### Engineering (if time):
7. **Stakes-segmentation guard in `_pool_disparity_factor`** ([scripts/process_card.py:241](scripts/process_card.py:241)) — `if purse > 100000 and trainer in TIER_TRAINERS and jockey in TIER_JOCKEYS: return (0.0, 1.0)`. The locked R9/R10/R11 lesson should ship as code before next stakes day.
8. **Top-4 default in `_build_recommendations`** — in tri/super box, use top-4 (top-5 for purse > $100K).
9. **Bet sheet "next race" Arabian skip bug** — affects only Apr 30 history view.

---

## Gotchas (lessons for the next session)

- **Sheets parses leading `+`/`-` as formula start.** TrackBias tab has #ERROR! on `rail_bias = "+"`. Workaround: prefix with `'` or write as `"plus"`/`"minus"`.
- **Gemini side panel keeps reopening** in Sheets after URL navigation. Click X at approximately (1383, 162), then click cell A1, then paste.
- **`navigator.clipboard.writeText` requires document focus** — click on the page (any cell) before running JS clipboard write.
- **MCP tab group is separate from user's Chrome tabs.** The user's TwinSpires tab is in a different window — to scrape it I had to open my own. Login state doesn't carry; public pages only without explicit auth flow.
- **Equibase blocks scraping (403)** consistently. HRN, AmericasBestRacing, BloodHorse, official Churchill Downs and NOAA worked. Don't waste agents trying Equibase first.
- **Token efficiency**: Per-entity bulk agents work better than 1-per-horse. Two horse-deep-dive agents (12 horses each) cost less than 24 individual agents.

---

## Files committed this session (PR #8 commit `93accf4`)

```
.gitignore (updated allowlist)
data/cd-2026-05-02/DERBY_INTEL.md
data/cd-2026-05-02/derby-horses-1-12.json
data/cd-2026-05-02/derby-horses-13-24.json
data/cd-2026-05-02/jockey-stats.json
data/cd-2026-05-02/raw-entries.json
data/cd-2026-05-02/sheet-url.txt
data/cd-2026-05-02/track-bias-derby-trends.json
data/cd-2026-05-02/trainer-stats.json
```

PR #8 also has the CLAUDE.md rewrite (commit `ff8eb1b`).

---

## Quick-reference URLs / IDs

- **Sheet:** https://docs.google.com/spreadsheets/d/1sjDEqTjwFtXa4MMTyKSNiIzw3hjYrxefwYJlGJDyzJ0/edit
- **PR:** https://github.com/LeeHigma0201/previewcharge/pull/8
- **Worktree path:** `/Users/jason/previewcharge/.claude/worktrees/dreamy-tu-73504c`
- **Data folder:** `data/cd-2026-05-02/`
- **Cortex node:** `HorseGPT`
- **Pipeline trigger:** `python scripts/process_card.py 2026-05-02` (after `raw-entries.json` is in place)
- **Stage 1 sandbox scorer:** `python scripts/sandbox_score.py 2026-05-02`

---

## TL;DR for the next session

> 16 hours from Derby post. The Beyer-100+ club is the algo top-3 lock: **Further Ado #18, Commandment #6, So Happy #8**. The chalk **Renegade #1** has double historical headwind. Use top-5 super box for chaos coverage. Don't fade chalk on flags in stakes. Spawn Wave 2 (per-race pace) for the rest of the card. Live data goes into the Pools / Results / Bets / Scorecard tabs as the day progresses.
