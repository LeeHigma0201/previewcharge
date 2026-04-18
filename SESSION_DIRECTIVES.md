# Keeneland Race Session Directives — 11 Separate Sessions

Each directive below is a self-contained prompt for a fresh Claude session.
Use one per race — start the session 15-25 minutes before post time.

**Reusable setup (paste at the top of each new session if needed):**
- Live tool: https://previewcharge-nine.vercel.app/ — login `jason` / `horse`
- Brisnet source PDFs: `/Users/jason/Downloads/Keenland.pdf` (Ultimate PPs), `/Users/jason/Downloads/Keenland race.pdf` (Premium Plus)
- Google Sheets: horse 2 (lineup), horse 3 (race metadata), Copy of Horse Racing Data (scratches)
- Project dir: `/Users/jason/previewcharge`

---

## DIRECTIVE TEMPLATE (used for each race below)

Replace `[N]`, `[POST TIME]`, `[TYPE]`, `[DISTANCE]`, `[SURFACE]` placeholders.

```
You are my betting advisor for Keeneland Race [N] ([TYPE], [DISTANCE] [SURFACE], post [POST TIME]).
Post time is in about [X] minutes.

STEP 1 — Load live tool state
Open https://previewcharge-nine.vercel.app/ via preview_start if needed, log in with jason/horse,
click race [N] in the race picker. Capture these facts:
- Ability ranking (top 5 horses + their win%)
- Tier assignments (A / B / C / × counts)
- Current pace scenario (Pace Meltdown / Speed Duel / etc.) and PPS score
- Recommended tickets with hit rate, payoff, EV, and cost
- Confidence level (HIGH / MED / LOW — green/yellow/red dot)

STEP 2 — Fetch live race-day intel
Click the "Fetch Live Intel" button. Report:
- Weather (temp, conditions, wind, precipitation chance)
- Track condition (dirt/turf firmness)
- Any last-minute scratches or jockey changes
- Sharp money observations
- Key insight

STEP 3 — Pull live tote odds
Ask me to read the tote odds from TwinSpires for each active horse.
For each horse, update the "Live Odds" input in the tool.
Re-read the tier/EV/ticket section after updates.

STEP 4 — Cross-reference with track bias live
Check the "Speed Bias (Meet)" and "Wire %" in the race header.
If the tool's pace scenario and track bias align with weather (wet track flips bias),
flag that as a confidence booster or downgrade.

STEP 5 — Recommend bets
Give me a small ($3-5), balanced ($10-15), and aggressive ($25-40) ticket combination
for this race. For each recommended ticket:
- Name the exact structure (STRAIGHT / KEY / BOX / KEY-BOX / PART-WHEEL)
- List horse programs and positions
- State hit rate, estimated payoff, and +EV
- Give TwinSpires click-by-click steps (copy from the tool's embedded instructions)

STEP 6 — Watch conditions
- Highlight any A-tier horse whose live odds drifted SHORTER than ML (market caught up → reduce stake)
- Highlight any B-tier horse whose odds drifted LONGER (now +EV → consider upgrading)
- Flag false favorites (× tier) — under NO circumstances key them

STEP 7 — Final decision
Based on current odds + intel + my risk tolerance ($X budget I'll tell you),
name the 2-3 tickets to actually play, with exact bet structures and amounts.
Verify total cost before I submit on TwinSpires.

If the confidence dot is LOW (red), warn me explicitly: data integrity issue,
check against NotebookLM or skip the race.
```

---

## RACE-SPECIFIC DIRECTIVES

### Race 1 — 1:00 PM — 1 1/16m Dirt — Mdn 110k — F&M MSW

**Already analyzed — see RACE_PLAYBOOK.md for the full bet card.**

Anchor: #3 Reality Star (6/1, A-tier +EV). Variance: #1 Miss Milky Way (8/1, A-tier +EV).

Skip session — use the playbook directly.

---

### Race 2 — 1:32 PM — 1 1/8m Dirt — Clm 20000n2L — 3&up Clm

```
Keeneland Race 2 advisor. Post 1:32 PM.
Small claiming field (9 horses), Whiskey Shot is the heavy favorite (9/5 ML).

Run the full 7-step directive from SESSION_DIRECTIVES.md. Pay specific attention to:
- Whiskey Shot (#8, 9/5 ML) has a 145-day layoff — his last-race Beyer was 38 (throwaway).
  Check if model flags him as false favorite.
- Tiz Freedom (#9, 3/1 ML) is top ability by the tool — verify.
- The "Ryu Mo" at 15/1 is a potential C-tier overlay — watch for bettors pushing him in.

Budget: I'll tell you. Confirm final tickets before I submit on TwinSpires.
```

---

### Race 3 — 2:04 PM — 5.5f Turf — Alw 120000n1x — F&M Alw

```
Keeneland Race 3 advisor. Post 2:04 PM.
LARGE 16-HORSE FIELD including 2 AE horses (Trust Fund Philly #15, Pillar of Beauty #16).
Turf sprint — speed bias 57%, rail impact 0.

Run the full 7-step directive. Specific checks:
- Hot Mash #10 (3/1 ML) has top Prime Power (142.5) — verify A-tier status
- Capturing #7 (8/1 ML) is the big-field overlay my algo flags
- Stepping Stones #12 (9/2) and Perfect Figure #8 (5/1) are chalk
- Double-check if AE horses are actually running (if main field complete, they don't run)

Because this is 16 horses, the algo's A-tier threshold is relaxed — ANY +EV anchor with
ratio ≥ 1.30 AND winPct ≥ 6% counts. Don't confuse this with a smaller-field A-tier.

Data confidence: MED (some disagreement across sources for horses 15-16).
Budget: small bets preferred for this chaotic race.
```

---

### Race 4 — 2:36 PM — 1 1/16m Dirt — Alw 30000s

```
Keeneland Race 4 advisor. Post 2:36 PM.
9-horse alw starter. Morunning (#3, 2/1) is favorite.

Run the full 7-step directive. Key observations:
- Morunning #3 has 8 wins from 17 starts at this level — legitimate 2/1 play IF model agrees
- Baytown Bruiser #4 (4/1) has highest Prime Power — check if he's the data anchor
- Protective #7 (12/1) was my gold test case — verify he's still +EV or has market caught up
- Pace Pressure will likely be 60-80 given multiple E/EP horses

Budget: I'll tell you. Key question: does the algo still like Protective, or has Morunning
become the legit anchor? Report which.
```

---

### Race 5 — 3:08 PM — 1m Dirt — MC 50000

```
Keeneland Race 5 advisor. Post 3:08 PM.
Maiden claiming $50k — 12 horses. Highly variable.

Run the full 7-step directive. Specifics:
- Susan's Boy #3 (4/1) and Blue Mountains #4 (4/1) are co-favorites
- Many unraced or N/A style horses — pace scenario likely unpredictable
- Discotheque #7 (6/1) is a potential overlay (Gemini data showed high model %)
- Street Party #10 (5/1) is another contender

Maiden claimers are variance races. Don't over-commit. Small bets preferred.
Confidence: MED.
```

---

### Race 6 — 3:40 PM — 1m Turf — Alw 120000n2L — 3yo Fillies

```
Keeneland Race 6 advisor. Post 3:40 PM.
10-horse turf mile for 3yo fillies. Kentucky Belle is HEAVY favorite (8/5).

Run the full 7-step directive. Critical observations:
- Kentucky Belle #9 (8/5) has Prime Power 139.4 (top) — model likely says true favorite
- Candy Rockette #8 (9/2) trained by Mott (W.I.) — strong barn
- Surprise Ending #7 (7/2) is second choice
- Check if 8/5 is a false favorite per model OR a justified chalk

For a heavy chalk race, the smart plays are usually trifectas boxing chalk + 1 longshot.
Key Kentucky Belle → box alternates → spice with C-tier.

Budget: I'll tell you. Confidence: MED.
```

---

### Race 7 — 4:12 PM — 6f Dirt — OC 80000n2x

```
Keeneland Race 7 advisor. Post 4:12 PM.
7-horse dirt sprint. Whatchatalkinabout (#7, 8/5 ML, PP 142.3) is heavy chalk.
Speed bias 100% at 6f dirt at KEE spring meet — huge edge to front-runners.

Run the full 7-step directive. Specifics:
- Whatchatalkinabout off 6-month layoff — verify if that's discounted
- Floodlites #1 (3/1) and Kalahari Dreams #3 (7/2) are the secondary chalk
- Modus Bestia #6 (6/1) and Politicallycorrect #5 (15/1) are potential C-tier
- In a speed-biased sprint, inside posts matter — check post position impact

In a 7-horse field the algo may flag multiple as excluded. Focus on overlays.
```

---

### Race 8 — 4:44 PM — 5.5f Turf — Alw 140000b

```
Keeneland Race 8 advisor. Post 4:44 PM.
Turf sprint. Arrest Me Red had top PP but should be MARKED SCRATCHED in data
(if not already — verify with the tool).

10-horse field AFTER scratches. Works for Me (#6, 4/1 AE), Troubleshooting (#1 MTO),
Full Disclosure (#2 AE) are scratched.

Run the full 7-step directive. Specifics:
- Dhabab #3 (8/1) and Run Carson #4 (10/1) have top PPs
- My Own #8 (9/2) has very high Prime Power (145.7)
- Silent Heart #7 has 11-month layoff — big discount

Confirm field size after scratches. Watch for mutuel pool craziness if coupled entries.
```

---

### Race 9 — 5:16 PM — 1 3/16m Dirt — Ben Ali S. (G3) — STAKES — $350K

```
Keeneland Race 9 advisor — BEN ALI GRADE 3 STAKES. Post 5:16 PM.
9-horse graded stakes field. Batten Down (#6, 2/1 ML) is the favorite. Rattle N Roll (#8, 3/1).

Run the full 7-step directive with EXTRA VIGILANCE. Specifics:
- This is a real stakes race with elite talent. ML odds are usually tighter and more accurate.
- Batten Down (Mott trainee) and Rattle N Roll (McPeek trainee) will drift based on late money.
- Honor Marie (#9, 10/1) is the algo's #1 ability horse — overlay potential.
- Stars and Stripes (#1, 4/1), British Isles (#4, 6/1) are other serious contenders.
- Guns and Glory #7 at 50/1 is the C-tier variance darkhorse (unlikely but cheap).

TAKE YOUR TIME. Stakes races are high-information markets — the smart money often shows up
in the final 5 minutes. Check live odds RIGHT BEFORE POST.

Budget: probably up to $30-50 for this race — it's high quality. Confidence: MED.
```

---

### Race 10 — 5:48 PM — 1 1/2m Turf — Elkhorn S. (G2) — STAKES — $400K

```
Keeneland Race 10 advisor — ELKHORN GRADE 2 STAKES. Post 5:48 PM.
13-horse field (after Dancin in Da'nile #13 + Padiddle #1 scratches = 11 active).

Run the full 7-step directive. Specifics:
- Burnham Square #6 (4/1 ML) is the heavy chalk
- Tawny Port #8 (9/2) has top Prime Power (160.3) — should be A-tier
- Truly Quality #7 (5/1) has PP 159.4 — also top
- Grand Sonata #4 (6/1), Fleetfoot #12 (12/1) are live contenders
- My algo currently has Navy Seal #9 as top ability — verify this is correct
  (might be a case where style/pace interaction favors EP over closers on turf)

This is a marathon distance (1.5 miles) — pedigree/stamina matters. Closers favored.

Budget: probably $25-50 for a G2. Watch for sharp money moves.
```

---

### Race 11 — 6:20 PM — 7f Dirt — Mdn 110k — 3yo Fillies MSW

```
Keeneland Race 11 advisor. Post 6:20 PM.
12-horse 3yo filly MSW at 7f dirt. Full Dolly (#4) scratched.

Run the full 7-step directive. Specifics:
- Be the Light #10 (3/1) is ML favorite — verify ability rank
- Miss Complicated #12 (5/1) has top Prime Power (121.4)
- Island Flower #8 (4/1) is another chalk choice
- Many first-start or lightly raced horses — high variance
- Dirt 7f at KEE spring shows wire% of 50% — front runners favored

This is a GAMBLE race (maidens are hard to handicap). Small bets only.
This is the last race of the day — final post-time money moves.
```

---

## QUICK REFERENCE — Per-race difficulty

| Race | Difficulty | Reason |
|---|---|---|
| 1 | Easy | 6-horse field, clear overlays |
| 2 | Medium | Favorite on 145-day layoff — check discount |
| 3 | Hard | 16-horse turf sprint, chaotic |
| 4 | Medium | 2/1 favorite with real credentials |
| 5 | Hard | Maiden claiming 12-horse field |
| 6 | Medium | Heavy chalk (8/5) — lever or fade |
| 7 | Easy-Medium | 7-horse sprint, speed bias favors fav |
| 8 | Medium | Scratches affect field — verify |
| 9 | **HIGH STAKES** | BenAli G3 — take your time |
| 10 | **HIGH STAKES** | Elkhorn G2 — marathon distance |
| 11 | Hard | MSW fillies, many unknowns |

---

## RISK MANAGEMENT

Total daily budget rule of thumb:
- Conservative ($30): 1-2 tickets per race, small bets only
- Moderate ($75): 2-3 tickets per race, balance of straight/box/key
- Aggressive ($200+): Full ticket slate, larger stakes on stakes races

Never key a ×-tier (excluded) horse. The model says they're overbet — keying them eats the takeout twice.

If the algo says NO A-tier horses exist in a race, consider skipping that race entirely.
