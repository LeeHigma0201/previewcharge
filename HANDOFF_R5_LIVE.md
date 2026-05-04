# HorseGPT — R5 Live Handoff (2026-05-02 Derby Day)

**Time of handoff:** ~30 min before R5 post (20 MTP at last check).
**Race up next:** **R5 — TWIN SPIRES TURF SPRINT S. -G2, $600K, 5 1/2 F Turf, 10 horses.**
**Bankroll remaining: $7.00 of original $9.00.**

---

## THE SITUATION IN ONE PARAGRAPH

Jason has bet R1 (lost, TRI key 11/3/5,6 missed on 3rd — actual 11-3-4) and R4 (lost, $0.50 TRI 4/1,5/1,5,6 missed because #6 R Disaster won at 7-1, our key #4 finished 2nd). The algo's directional reads have been MOSTLY right (faded chalks that lost, identified overlays that came in 2nd or 3rd) but our ticket structures haven't captured the upset winners. R3 had a CARRYOVER on Super Hi-5 ($11,228); R4 super was REFUNDED (5-horse field after #2 SCR); so the Hi-5 carryover **likely rolls into R5** which has a $266K Pick-5 pool starting at R5. **Your job: execute R5, then R7 (partial edge), then R12 Derby. Don't deploy any code — Jason said math first, no hallucinations.**

---

## CHROME TABS NEW CLAUDE NEEDS — confirm these immediately

**Browser:** "tams laptop" (deviceId `5a3797eb-3c27-4c14-8a6d-ffdfdff19d0a`) — Claude_in_Chrome MCP is connected.
**Open tabs (use `mcp__Control_Chrome__list_tabs` first to get fresh IDs):**
- TwinSpires R5 PPs / live odds: `https://www.twinspires.com/bet/program/classic/churchill-downs/cd/Thoroughbred/5/pps`
- TwinSpires daily results: `https://www.twinspires.com/bet/results/2026-05-02`
- Google Sheet (HorseGPT Derby Day): `https://docs.google.com/spreadsheets/d/1sjDEqTjwFtXa4MMTyKSNiIzw3hjYrxefwYJlGJDyzJ0/edit` — has tabs Card / Entries / Pools / Horses / Jockeys / Trainers / Pace / TrackBias / DerbyTrends / Sheet13 / Results / Bets / Scorecard
- BRIS PP PDF: `https://www.twinspires.com/bris-etl/products/bds-etl/products/uwb/2026/05/cdx0502u.pdf`
- Claude_in_Chrome MCP tab group ID: `711264971`, primary tab `492170943`

**Use `mcp__Control_Chrome__execute_javascript` with `tab_id` to scrape live data from any TS tab.** Returns text via `document.body.innerText` — works for win pool, odds, MTP, results.

**Sheets:** Sheets uses canvas-based grid. You CANNOT write cells via DOM. Two options:
1. Set clipboard via `navigator.clipboard.writeText(tsv)` then ask Jason to Cmd+V into A1 of Results tab
2. Build a Python data file in the worktree and tell Jason to manually paste

**Use computer-use only with Jason's explicit approval.** `request_access` timed out earlier — Jason has said "use control my Mac if you can" but auto-attempts have failed. Stick to Chrome MCP for browser actions; tell Jason to do the Sheet paste.

---

## ALGO STATE — what's been built and what works

### Modules in `/Users/jason/previewcharge/.claude/worktrees/thirsty-aryabhata-291678/src/models/`:

1. **`exotic_v2.py`** — Henery position-prob foundation
   - Constants: GAMMA_2ND=0.81, DELTA_3RD=0.65, EPSILON_4TH=0.55 (Lo & Bacon-Shone 2008)
   - `henery_position_probs(probs, gamma)` — closed-form Henery sigma/tau/eps
   - `trifecta_probability(horses, win_idx, place_idx, show_idx)` — proper joint prob

2. **`exotic_v3.py`** — Aggressive recommendation policy + position probs
   - **`position_probabilities(horses)` — BUG FIXED THIS SESSION.** Earlier version had wrong P3/P4 marginalization (sums across field were 132%, 154% instead of 100%). Now uses proper joint sum: `P(i=3rd) = Σ_{j} Σ_{k≠j,i} P(j=1st) × σ_k^j × τ_i^{j,k}`. Verified ΣP1 = ΣP2 = ΣP3 = ΣP4 = 1.000.
   - `aggressive_recommend()` — every race gets at least a saver ticket
   - `detect_angles()` — LONE_SPEED, SPEED_DUEL, OVERLAY_CLOSER, TOP_LAYOFF, PP_OVERLAY (PP-cited only)
   - `build_pick_chain()` — Pick-3/Pick-4 single+spread

3. **`public_bias.py`** — Public-money tilt model
   - `score_horse()` returns 0-20 score across color/name fluency/trainer star/jockey star/sire star/story/post superstition/consensus_trap
   - Lookup tables: `TRAINER_STAR`, `JOCKEY_STAR`, `SIRE_STAR`, `STORY_ANGLES`, `CONSENSUS_TRAP_HORSES = {Commandment, Renegade, Further Ado}`
   - Flag: PUBLIC_TRAP (score≥8 + odds<10), PUBLIC_OVERLAY (score≤3 + odds≥12), CONSENSUS_TRAP
   - `adjusted_win_prob()` applies gray-haircut (-18%), consensus -10%, story-trap -15%

4. **`cd_historian.py`** — Churchill Downs-specific patterns (built post R2 miss)
   - `CD_RAIL_MASTERS`: Velazquez 22%, Irad 20%, Saez 19%, Smith 20%, Castellano 18%, Hernandez Jr 18%, Gaffalione 17%, J.Ortiz 16%, Prat 17%
   - `CD_JOCKEY_WIN_RATE`, `CD_TRAINER_WIN_RATE` (Baffert 24%, Pletcher 22%, Cox 21%)
   - `CD_DISTANCE_PATTERNS`: dirt_route post-1 E = 1.20x, dirt_sprint post-1 E = 1.30x, etc.
   - `adjust_horse()` applies all four multiplicatively + reports adjustments

5. **`pace_handicapper.py`** — EquinEdge-style pace projection (built post R2 miss)
   - `compute_pace_score(e1, style, post, field_avg_e1)` — formula: `(e1/field_avg_e1)*2.0 + style_pts + post_bonus - post_penalty`
   - STYLE_PTS = {E:2.0, EP:1.5, P:0.5, S:0.0, NA:0.5}
   - `classify_race_shape(horses)` — returns LONE_SPEED / SLOW / HONEST / FAST / MELTDOWN
   - **Threshold tuning fixed this session:** MELTDOWN = `e_count≥3 AND top3_e1_avg≥93 AND ≥2 horses E1≥95` (dropped over-tight spread requirement)
   - Closer-overlay flagging: high LP relative to field avg + late-style OR LP-E1 differential ≥ 12

### Math invariants (all currently green):
- Sum of P1 across field = 1.0 ✓
- Sum of P2 across field = 1.0 ✓
- Sum of P3 across field = 1.0 ✓
- Sum of P4 across field = 1.0 ✓
- Henery's longshot asymmetry visible: chalk's P-curve decreases with position, longshot's increases (correct)

### What's NOT pushed yet (Jason said don't deploy until 95% confident):
- The position-prob bug fix in `exotic_v3.py`
- Pace handicapper (`pace_handicapper.py`)
- CD historian (`cd_historian.py`)
- Public bias scoring (`public_bias.py`)

These all live on disk but are not committed/deployed to Vercel. Status: working locally, validated against R2 + R3 + R4 retros directionally.

---

## R1–R4 RACE RESULTS + LESSONS LEARNED

### R1 — Maiden Special Weight, 1 1/16M Dirt
- **Finish: 11-3-4-6-2.** Powershift won at 4-1.
- **Algo top-3:** #11 Powershift, #3 Silent Way, #9 Winston Ave (scratched → replaced #4 in saver)
- **Hit:** 1st+2nd correct. **Missed 3rd** (#4 Ingleborough was algo rank 9).
- **Jason's bet:** $0.50 TRI 11/3/5,6 = **LOST** on 3rd
- **Payouts:** $0.50 Tri 11/3/4 = $42.07; $1 Super 11/3/4/6 = $188.44
- **Lesson:** Algo under-rated #4 Ingleborough — closer in maiden ranks with class drop. The "class drop in maiden" pattern isn't in `cd_historian.py` yet.

### R2 — OC 125k n1x, 1 1/16M Dirt — THE BIG MISS
- **Finish: 1-2-9-8-6.** Out of the Woods won at $26.14 (12-1).
- **Algo top-3 PRE-PACE-FIX:** #8 Taptastic, #4 Memory, #1 Out of the Woods
- **Pace handicapper RETRO** would have flagged #1 as MELTDOWN-leader rail-master (Velazquez + post 1 + style E + Beyer 94 + 22% historical CD rail rate). With pace handicapper, #1 ranks 2nd (17.8%) instead of 3rd (12.2%).
- **Jason's bet:** $0.50 TRI 4/8,1/8,1,9 = lost
- **Payouts:** $2 Exacta 1/2 = $299.98; $0.50 Trifecta 1/2/9 = $506.01; **$1 Super Hi-5 1-2-9-8-6 = $15,408.85** (the trophy of the day)
- **Lesson:** The miss triggered pace_handicapper.py + cd_historian.py. Velazquez/post-1/E-style + LP-better-than-E1 differential is now a flagged stack. Slide-anchor with proper stacks would have included #1 in slot 1; #2 + #9 longshot finishers would still have been missed by win-prob ceiling.

### R3 — OC 80k n2x, 1m Dirt
- **Finish: 10-14-6-12.** Vibe won at $16.48 (7-1). #14 Bullard placed at ~12-1 deep longshot.
- **Algo top-4 (post-pace-fix):** #12 Praetor, #6 Who Dey, #10 Vibe, #5 John Hancock
- **Hit:** 3 of 4 algo top horses ITM (#10, #6, #12), but in **wrong slots**. #14 was unflagged.
- **Pace handicapper got the MELTDOWN read RIGHT:** leader #5 John Hancock (E1=111) burned out as predicted.
- **Live odds drift signal worked:** #9 Keewaydin came IN 20→13 in last 5 min = sharp money — but he didn't ITM.
- **Carryover:** **Super Hi-5 had no winner → $11,228 carryover rolls forward** to next race with Hi-5 (R4 had only 5 horses → Hi-5 also refunded → carryover continues into R5).
- **Lesson:** #14 Bullard win was Velazquez's mount switch (Saffie Joseph's barn focus). Trainer-mount-shift signal not yet in algo.
- **Jason did not bet R3.**

### R4 — Derby City Distaff G1, 7f Dirt
- **Finish: 6-4-1.** R Disaster won at $16.26 (7-1). Algo top #4 finished 2nd.
- **Algo top-3:** #4 Ways and Means, #5 Splendora, #1 Usha
- **Public/Algo overlay analysis:** #4 was OVERLAY (algo 37%, public 29%), #5 was TRAP (algo 30%, public 40%). **Public was wrong on #5** — #5 didn't ITM. Algo's directional read validated.
- **TwinSpires AI ("EXPERT PICKS") had #6 R Disaster as 2ND PICK** — we noted this in pre-race scrape but didn't include #6 in slot 1 of our trifecta. **THIS IS THE ALGO PATCH OPPORTUNITY** — when TwinSpires AI disagrees with our top-1, include their pick in slot 1.
- **Jason's bet:** $0.50 TRI 4/1,5/1,5,6 = LOST (key was #4, actual was #6)
- **Payouts:** $0.50 Trifecta 6/4/1 = $40.65; **Superfecta REFUNDED** (5-horse field after #2 SCR didn't meet starter minimum); **Pick-3 R2/R3/R4 = $450.21**
- **$11,228 Hi-5 carryover continues** (no super or hi-5 paid out).

---

## R5 PRIORITY (you start here)

**R5 = TWIN SPIRES TURF SPRINT S. -G2 — $600K — 5 1/2F Turf — 10 horses — 20 MTP at handoff.**

### Live pool data (refresh before R5 by re-reading tab):
| # | Live | Pool $ | Public % |
|---|---|---|---|
| 1 | 27 | $10,912 | 2.8% |
| 2 | 22 | $13,391 | 3.4% |
| 3 | 3 | $73,883 | 19.0% (chalk) |
| 4 | 22 | $13,639 | 3.5% |
| 5 | 16 | $18,084 | 4.7% |
| 6 | 11 | $25,529 | 6.6% |
| 7 | 5/2 | $91,149 | 23.4% (top chalk) |
| 8 | 13 | $21,403 | 5.5% |
| 9 | 3 | $71,822 | 18.5% (co-chalk) |
| 10 | 5 | $48,971 | 12.6% |

**Pool sizes:** $1 Tri $206K, $1 Super $55K, $1 Pick-5 (R5-R9) $266K, **$1 Super Hi-5 $6,195** (PLUS the $11,228 carryover from R3 — verify this on the pool page; "Carryover" should be visible).

### Algo's R5 read (from earlier full-card output):
- **Pace shape: MELTDOWN** (top-3 E1=99)
- **Projected leader: #2 Bear River**
- **PUBLIC OVERLAYS flagged (algo says better than public has them at):**
  - #1 Wendelssohn (15-1 ML, 27 live — drifted)
  - **#2 Bear River (30-1 ML → 22 live, algo's MELTDOWN leader at 22-1 = potentially massive overlay)**
  - #6 Its Bourbon Thirty (15-1)
  - #4 Full Disclosure (30-1)

**Validation needed before R5 posts:**
1. **Re-run pace_handicapper on R5 with the actual PP data** — confirm MELTDOWN shape and leader candidate. Use raw-entries.json + horses.csv in `data/cd-2026-05-02/`.
2. **Pull live odds 5 MTP before post** — see if #2 Bear River drift continues or compresses.
3. **Check TwinSpires Expert Picks for R5** — note who they have as 1st/2nd/3rd. **R4 lesson: include their picks in slot 1 stack if they disagree.**
4. **Confirm Hi-5 carryover** — pull pool page, look for "Carryover" line.

### R5 ticket recommendation framework (NOT YET DECIDED):
**With $7 bankroll, R5 is NOT in the original "high edge" allocation** (Path A was R4 $2 + R7 $2 + R12 $5 = $9; R5 was skipped).

**However, IF carryover Hi-5 is confirmed loaded ($11k+), R5 Hi-5 becomes structurally +EV** because:
- Carryover is "free money" added to a small native pool ($6K)
- 10-horse field, Hi-5 needs all 5 finishers in order — chaos play
- A keyed Hi-5 part-wheel at $0.10 ($2-4) covers a swath

**R5 Hi-5 candidate structure (if you confirm carryover):**
- KEY pace-handicapper leader (#2 if validated) + chalk (#7 5/2)
- Wheel #3, #9, #10 (other top-pool horses)
- Wheel #6, #1 (overlays per algo)
- Cost target: $2-3 max

**Or skip R5 entirely** if carryover doesn't exist or pace shape doesn't validate. Save $7 for R7 + R12.

### Decision tree for R5:
```
IF carryover_hi5 ≥ $10,000 AND pace_shape == MELTDOWN AND #2 still at 15-1+:
    PLAY $2 Hi-5 part-wheel keyed on #2 + #7
ELIF Expert Picks align with #2 or another overlay:
    PLAY $1.50 trifecta key
ELSE:
    SKIP R5, save bankroll
```

---

## R7 PLAN (Distaff Turf Mile G1) — preserved from current session

**Algo top-2: #2 Sweet Rebecca + #3 Portfolio Duration** (Klaravich/Brown, ppRank 1)
**Market top-2: #2, #8** → **#3 is the partial-edge overlay**
**Pace shape: HONEST** (per earlier output)

**Recommended bet:** **$0.50 TRI 3 / 2,8 / 2,8,5 = 4 combos × $0.50 = $2.00**
- KEY #3 (Klaravich/Brown overlay)
- Wheel #2 (chalk place), #8 (also Klaravich), #5 (sharp signal candidate)

**Validation before betting:** scrape live R7 odds at MTP=5, check Expert Picks, confirm pace shape via pace_handicapper.

---

## R12 DERBY PLAN — Smart Anchor

**This is the day's biggest EV play. Concentrate bankroll here ($5).**

**Algo top picks (post all layers, with #9 The Puma RESTORED to field):**
1. #1 Renegade — PUBLIC_TRAP (Pletcher + Ortiz Jr + post 1)
2. #6 Commandment — PUBLIC_TRAP (AI consensus + post 5 + Into Mischief)
3. #18 Further Ado — CONSENSUS_TRAP (Velazquez, **highest Beyer 105 + Prime Power 150.7 = data-strongest**)
4. #12 Chief Wallabee — clean (Bill Mott, no public bias score)
5. #9 The Puma — clean
6. #15 Emerging Market — PUBLIC_OVERLAY (Chad Brown / Prat, 15-1 boring name)

**Smart Derby Anti-Public Ticket — $0.50 TRI:**
```
$0.50 TRI 12,18 / 1,6,12,18 / 1,6,15,12,18
= ~10-12 distinct combos × $0.50 = $5-6
```

Logic:
- KEYS the data-proven non-traps (#12 + #18 highest Beyer, both are Cox barn or comparable)
- Wheel uses chalk traps #1 + #6 in 2nd-3rd ITM coverage only (where price compression hurts less)
- Adds overlay #15 for show-position value if a longshot ITMs

**Validation before betting:**
- Pull live R12 odds at MTP=5
- Verify carryover status and Pick-N pool sizes
- Check Expert Picks one more time (consensus trap warning if they all agree on Renegade/Commandment)
- Smart Derby has 3 ticket structures saved in `web/app/lib/cd-2026-05-02-picks.json` under `smartDerby` — can use as starting templates

---

## CHALLENGES TO YOU (NEW CLAUDE) — make this better

The algo currently misses on these patterns. Each is an open puzzle:

1. **Slot-1 disagreement-with-Expert-Picks signal.** When TwinSpires' AI has a different #1 pick than ours, include their pick in slot 1 stack of the trifecta. R4 #6 was their 2nd pick; if we'd included #6 in slot 1 of our $0.50 TRI, we hit at $40.65 payout. **Build this into exotic_v3 pre-bet sanity-check.**

2. **Trainer-barn-focus-after-scratch.** When a trainer's primary entry scratches, their secondary entry's win rate spikes. R4: Saffie Joseph Jr lost #2 Haulin Ice → focused #6 R Disaster. This is a real angle (DRF documents it). **Add to cd_historian.py.**

3. **Class-drop-in-maiden.** R1: #4 Ingleborough was a closer dropping in class for the maiden — algo had him rank 9 (closer in maiden often closer overlooked). Add a "class drop" feature to exotic_v3 or a CD-specific maiden pattern in cd_historian.

4. **Slide-anchor improvements.** Current algo: each horse anchored at argmax(P1, P2, P3, P4). Validated theory but not aggressively stacking. **Try dynamic stacking based on P-curve gap** — if a horse's P3 is much higher than P1, that horse is a "show specialist" and should anchor slot 3 heavily even if they're not in algo top-3 by P1.

5. **Live-odds drift detection.** Current ad-hoc. Build a `mcp__Control_Chrome` polling loop that scrapes odds every 60 seconds in last 10 minutes pre-post and flags horses whose odds shift >20% as sharp/dumb signals.

6. **Push corrections.** Math bug fix (position_probabilities), pace_handicapper, cd_historian, public_bias all live on disk only. **Commit + deploy to Vercel** ONLY when Jason explicitly approves — he said don't deploy unsanctioned.

7. **The Sheet update is broken.** Sheets canvas grid doesn't accept synthetic paste from JS. Either get computer-use approved (request_access) for Cmd+V automation, or build a Python writer that uses Google Sheets API with OAuth (will need Jason to set up creds).

8. **Pick-N strategy under-utilized.** R3 paid $128 on $0.50 Pick-3, R4 paid $450 on $0.50 Pick-3. The Pick-N pools have positive ROI per TwinSpires 2023 data. **Build a Pick-3/Pick-4/Pick-5 analyzer that identifies single-able legs and recommends ticket structures.**

---

## THE EXACT ALGORITHM (in code) — review and improve

The pipeline:
1. **Parse PP** (`scripts/parse_bris_pdf.py`) → `data/cd-2026-05-02/raw-entries.json`
2. **Process card** (`scripts/process_card.py --strict`) → horses.csv (with score_pct, jockey/trainer tier, etc.)
3. **Apply CD historian** → adjusted win prob per horse
4. **Apply pace handicapper** → fade E1≥95 in MELTDOWN, boost closer overlays
5. **Renormalize** → final win probs
6. **Compute Henery position probs (FIXED)** → P1, P2, P3, P4 per horse
7. **Score public bias** → flag PUBLIC_TRAP / PUBLIC_OVERLAY / CONSENSUS_TRAP
8. **Build slide-anchor ticket** → each slot stacks horses by their P at that slot, threshold 65% of top
9. **EV check** → estimate hit prob × payout from pool data, compare to cost
10. **Recommend ticket** → smallest +EV structure given bankroll constraints

**Open algorithmic questions:**
- Are we under-weighting closer-overlay horses in MELTDOWN? +25% boost may not be enough.
- Is the slide-anchor 65% stacking threshold optimal? Could be 50% (wider) or 80% (tighter).
- Should we use the live tote pool as a replacement for ML odds in market_prob_pct? Currently we use ML.
- Is the cd_historian rail-master multiplier (1.18 for Velazquez at 22% rate) too small? In R2 it lifted #1 to rank 2, not 1. Maybe 1.25-1.30 is better.

---

## COPY-PASTE PROMPT FOR NEW SESSION

```
Pick up the HorseGPT Derby Day session — it's Race 5 next at Churchill Downs (TURF SPRINT G2, 5.5F turf, $600K, 10 horses).

FIRST THING TO DO: read /Users/jason/previewcharge/.claude/worktrees/thirsty-aryabhata-291678/HANDOFF_R5_LIVE.md top-to-bottom.

Then immediately:
1. Connect Chrome via mcp__Claude_in_Chrome__select_browser with deviceId 5a3797eb-3c27-4c14-8a6d-ffdfdff19d0a (browser "tams laptop")
2. Run mcp__Control_Chrome__list_tabs to find the live tabs
3. Pull R5 live odds + pool data from the TwinSpires R5 PPs tab
4. Verify the Hi-5 carryover ($11,228 from R3 should still be sitting on R5's Hi-5 pool — confirm via the "Carryover" indicator on the pool page)

Jason's situation:
- Bankroll: $7.00 remaining of $9 (R1 + R4 lost)
- Bet path remaining: R5 (only if carryover Hi-5 is loaded), R7 (partial edge $2), R12 Derby ($5 Smart Anchor)
- Math first, no hallucinations, do NOT deploy any code without explicit approval
- TwinSpires bet units: Trifecta $0.50 base, Superfecta $1, Hi-5 $0.10

Your immediate goal: validate R5 pace shape, confirm carryover, and either send a small Hi-5 ticket ($2-3) or skip and preserve bankroll for R7 + R12. Use Chrome MCP to scrape live data and TwinSpires Expert Picks before recommending.

Key algo modules in src/models/: exotic_v2.py (Henery), exotic_v3.py (position probs - bug FIXED this session, sums-to-1.0), public_bias.py, cd_historian.py, pace_handicapper.py. None pushed to Vercel. Don't push without Jason's approval.

Lesson from R4: when TwinSpires' "Expert Picks" disagree with our top-1, INCLUDE their pick in slot 1 of the trifecta. R4 #6 R Disaster was their 2nd pick; we missed including him and the trifecta paid $40.65 we couldn't capture.

Be terse. Communicate via iMessage to 502-408-0064 when sending bet recommendations. Use mcp__Read_and_Send_iMessages__send_imessage.
```

---

## OPEN ITEMS / LOOSE ENDS

- **Sheet update STILL not done.** Clipboard was set with R1+R2 results TSV but Jason needs to manually Cmd+V into A1 of Results tab. Or you build a Google Sheets API integration.
- **R3 + R4 results need to be added to the Sheet too.** Same approach — set clipboard with full TSV, ask for paste.
- **The Vercel-deployed site (https://previewcharge-nine.vercel.app/today) has STALE math** — it's running pre-bug-fix position probs. Don't direct Jason there for live decisions; use chat + iMessage instead.
- **R12 Derby smart anchor structures live in `web/app/lib/cd-2026-05-02-picks.json` under `smartDerby` key** — can use those as starting points for the Derby ticket.
- **Pace handicapper validation cases:** R3 correctly classified MELTDOWN; R2 retroactively MELTDOWN (would have lifted #1 but not enough); R4 classified FAST_PACE. R5 needs fresh validation against the actual PP data.
- **The $273k R12 Pick-N jackpot indicator** seen on TwinSpires earlier was the JACKPOT-8 Super Hi-5 carryover specifically for the Derby, NOT the regular Hi-5. Verify before factoring into Derby strategy.

Good luck. The math is sound; the patches are real; the misses are explainable. Discipline + execution > complexity.
