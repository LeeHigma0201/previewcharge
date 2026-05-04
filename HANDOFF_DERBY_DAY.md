# HorseGPT — Derby Day Handoff (2026-05-02)

**Branch:** `claude/thirsty-aryabhata-291678`
**Working tree:** `/Users/jason/previewcharge/.claude/worktrees/thirsty-aryabhata-291678`
**Previous Claude session:** shipped algo hardening + adversarial-review-driven audit. Read this doc top-to-bottom before touching anything.

Jason is in the room. He will log into TwinSpires in Chrome and download a Brisnet PP file shortly after this session starts. Your job today: make the algo as confident as possible, ship a leaner site with today's picks live, and rename ClarkBot → HorseGPT across the codebase.

---

## TL;DR — what to do, in order

1. **Open Chrome and ask Jason which browser to use.**
   - There are 2 connected browsers: "Browser 1" and "tams laptop"
   - Use `mcp__Claude_in_Chrome__list_connected_browsers` then `AskUserQuestion` to let Jason pick
   - DO NOT pick one yourself — system requires user confirmation
2. **Wait for Jason to log into TwinSpires + download the PP file.** Don't navigate to TwinSpires login on your own. He'll tell you when it's downloaded.
3. **Parse the PP into `data/cd-2026-05-02/raw-entries.json`** — use `scripts/parse_bris_pdf.py` (already exists).
4. **Run the hardened algo:** `python3 scripts/process_card.py 2026-05-02 --strict` — `--strict` is critical on Derby Day (PASS instead of downsize on chalk-match races).
5. **Update the site with today's picks** — wire `cd-2026-05-02.ts` into `web/app/today/page.tsx` and the bet sheet at `/bets`.
6. **Rename ClarkBot → HorseGPT** across 8+ files (list below).
7. **Strip the junk** from `web/app/page.tsx` — TVG screenshot uploader, Monte Carlo simulator, "Full simulator →" link on bets page. The page should ONLY show today's picks + the bet sheet.
8. **Make the algo more confident** (concrete proposals at end of this doc).
9. **Verify the site with preview tools before reporting done.**

---

## What just shipped (read before changing anything)

### Adversarial reviews drove the hardening

Two LLMs (DeepSeek + Kimi) independently demolished the original "+222.7% ROI" thesis. Both picked the same load-bearing weakness: the algo's "ordering edge" claim is unfalsifiable because the algo's top-2 = market's top-2 in 80%+ of races. The chalk-overlap stratification audit ([data/analysis/chalk_overlap_audit_2026-04-30_2026-04-25.md](data/analysis/chalk_overlap_audit_2026-04-30_2026-04-25.md)) confirmed this on Apr 30:

| Tier | Races | Box hits | Algo $ returned | Mkt $ returned |
|---|---|---|---|---|
| FULL EDGE | 0 | 0 | $0 | $0 |
| PARTIAL EDGE | 1 (R8) | 1 | (results.json missing exacta) | $0 |
| CHALK MATCH | 8 | 2 | $57.28 | $57.28 |

**The algo's recorded ROI = the market's recorded ROI in the chalk-match bin.** Algo added zero ordering value in 80%+ of Apr 30 races. The R5 outlier ($56 payout) was a CHALK MATCH race — both algo and market boxes hit. The only race with real algo divergence was R8 (algo correctly chose #2 over #1 for second spot).

### What that means for today

- The **default** behavior on chalk-match races is now **downsize unit cost 50%**.
- The **`--strict` flag** changes that to **PASS entirely** on chalk-match races.
- Use `--strict` on Derby Day. Do NOT bet chalk-match races on Derby. The expectation is that 70-90% of Derby races will be CHALK MATCH and Jason should be passing on most of them.
- Jason's exotic-bet thesis (use exotic models since we predict top horses) only works in the FULL/PARTIAL EDGE bins. CHALK MATCH bin = paying takeout to bet market chalk.

### Code changes shipped in `scripts/process_card.py`

- New `compute_chalk_overlap(scored, k=2)` — tags each race FULL_EDGE / PARTIAL_EDGE / CHALK_MATCH
- `best_exotic_strategy()` now applies edge guardrail: downsize 50% on CHALK_MATCH (or PASS in strict mode)
- Module flags: `DISABLE_CHALK_DOUBT=True` (default off — was overfit per reviewers), `DISABLE_TWEAK_B=True` (default off — mid-card hand-tuning was contamination)
- CLI flags: `--strict`, `--enable-chalk-doubt`, `--enable-tweak-b`
- `picks.md` now shows edge-tier badge per race + bankroll discipline header
- `backtest.md` stratifies hits/ROI by chalk_overlap bin

### New tool: `scripts/chalk_overlap_audit.py`

Standalone audit that runs the falsification test on `horses.csv` + `results.json` without re-scoring. Use it after each card to track edge-bin performance over time. Usage:

```bash
python3 scripts/chalk_overlap_audit.py 2026-05-02 [2026-04-30 ...]
```

Output goes to `data/analysis/chalk_overlap_audit_<dates>.md`.

---

## Chrome workflow

```
1. Call mcp__Claude_in_Chrome__list_connected_browsers
2. Call AskUserQuestion with all browsers as options + "Open confirmation in every Chrome"
3. Once Jason picks: mcp__Claude_in_Chrome__select_browser(deviceId)
4. Wait for Jason to log into TwinSpires and download the PP file
5. Don't auto-navigate — let him control the login and download
```

After PP downloads:
```bash
ls -lt /Users/jason/Downloads/*.pdf | head -3
# Most likely the new PP file
```

Then parse it:
```bash
python3 scripts/parse_bris_pdf.py "/Users/jason/Downloads/<filename>.pdf" \
  --output data/cd-2026-05-02/raw-entries.json
```

(Verify `parse_bris_pdf.py` actually has that interface — read it first.)

Then process:
```bash
python3 scripts/process_card.py 2026-05-02 --strict
```

Outputs:
- `data/cd-2026-05-02/picks.md`
- `data/cd-2026-05-02/horses.csv`
- `data/cd-2026-05-02/races.csv`
- `data/cd-2026-05-02/exotics.csv`
- `web/app/lib/cd-2026-05-02.ts` (only if it doesn't already exist)

---

## Site changes

### 1. Rename ClarkBot → HorseGPT

Files (verified via grep):

- `web/app/components/ClarkBot.tsx` — rename file to `HorseGPT.tsx`, rename component, update aria-labels, update placeholder text
- `web/app/page.tsx:15` — import path
- `web/app/page.tsx:868` — `<ClarkBot />` usage
- `web/app/bets/page.tsx:6` — import path
- `web/app/bets/page.tsx:572` — `<ClarkBot />` usage
- `web/app/api/chat/route.ts:12,20` — system prompt mentions "ClarkBot" multiple times — also update the `SYSTEM_PROMPT` to say "HorseGPT" and reflect the new architecture (chalk-overlap awareness)

Search to verify nothing missed:
```bash
grep -rn "ClarkBot\|clarkbot" web/ --include="*.tsx" --include="*.ts"
```

### 2. Remove TVG screenshot uploader

Located in `web/app/page.tsx`. Search `tvg`/`TVG` in that file. The whole flow (state, upload handler, merge logic) is intertwined — removing it cleanly will require:

- Strip `tvgData`, `tvgLoading`, `tvgUploaded` state
- Remove the upload UI (around line 560-600 — the per-category screenshot uploaders)
- Remove all `TVG` data merging in the simulation function
- Drop the "TVG Data (Full)" / "Search Data (Partial)" badge

### 3. Remove Monte Carlo simulator

Also in `web/app/page.tsx`. The whole simulator block:
- `runSimulation` import (line 13)
- `<a href="#simulator">Simulator</a>` nav link (line 59)
- `<div id="simulator">` block (line 62 onward)
- `runSimulation(entries, simCount, raceInfo)` calls
- Monte Carlo simulation slider (line 603-680)
- Simulation info display (line 691-695)

After cleanup, `web/app/page.tsx` should be a thin landing page that links to `/today` and `/bets`. Probably under 200 lines.

### 4. Remove "Full simulator →" link on bets page

`web/app/bets/page.tsx:533` — drop the link.

### 5. Update with today's picks

Once `process_card.py` runs and creates `web/app/lib/cd-2026-05-02.ts`, wire it into:

- `web/app/today/page.tsx` — replace the loaded card with `cd20260502Card`
- `web/app/bets/page.tsx` — same
- Look at how `cd-2026-04-30.ts` is currently imported in those pages and follow the pattern

### 6. Verify the site with preview tools

After all edits:
```
preview_start (if not already running)
preview_eval -> reload
preview_console_logs (check for errors)
preview_snapshot of /, /today, /bets (verify rendering)
preview_screenshot for the user
```

`web/AGENTS.md` flags: this Next.js has breaking changes from training data — read `node_modules/next/dist/docs/` if you hit weird API issues.

---

## Making the algo more confident

Jason's ask: "the algo needs to be made as confident as possible." After what the reviewers found, "confident" = "honest about when it has an edge AND aggressive when it does." Here's the prioritized list:

### Highest impact (do these today if time)

1. **Default `--strict` in production paths.** Make the website's "today picks" view always run in strict mode. The CHALK MATCH races should literally show "PASS — algo top-2 = market top-2."
2. **Show chalk-overlap badge on every race tile.** The user should see at a glance which races are bettable vs. PASSes.
3. **Confidence interval on top-1 score.** Currently scores are point estimates. Compute std-dev across small ML-odds perturbations (e.g., ±10% odds noise, see how stable the top-1 ranking is). Display as e.g. "65% top-1 (stable across 50 noise samples)" vs "30% top-1 (top changes in 12% of samples)".
4. **Stratified live ROI tracking.** After each Derby race, run `chalk_overlap_audit.py` and update a live ROI scoreboard on the site — by tier. Jason should see in real-time whether his EDGE bin bets are paying.

### Medium impact (next session)

5. **Validate calibration via reliability diagrams.** Bin all Apr 30 + Apr 25 (when results land) predicted-win-prob into deciles and plot empirical hit rate vs predicted. If the curve drifts from y=x, apply temperature scaling or Platt scaling to recalibrate. Kimi flagged this as a real concern.
6. **Replace softmax-of-heuristic with Plackett-Luce direct ordering model.** This is the "model what you actually claim" critique. If we claim ordering edge, we should fit a model that scores PERMUTATIONS not just win-probs. See `src/models/logistic.py` for skeleton.
7. **Wire `BenterLogisticModel`** (in `src/models/logistic.py`) into the actual runtime path. Right now it's research code; `process_card.py` is a heuristic. Either use it or stop calling the algo "Benter."

### Lower impact (future)

8. **Live-odds Polling and re-rank.** ML odds are stale by post time. Pull live odds 5/3/1 MTP from TwinSpires and recompute chalk_overlap with live odds, not ML.
9. **Trifecta/superfecta keys not boxes.** When the algo's #1 has >35% score AND CHALK MATCH is FALSE, the right exotic structure is "key over wide spread" not "box". The current code does this at top_score >= 0.34 but doesn't gate on edge tier.
10. **Strip out the `_pool_disparity_factor` fully.** It's gated off but the code is still alive. Once you're sure no future flag turns it back on, delete the function.

---

## Exotic-bet strategy (Jason's thesis)

> "use the exotic bet models to make big gains since we can predict the likely top horses"

The Apr 30 audit shows this thesis is RIGHT in principle and WRONG as currently implemented:

- Right: in races where the algo finds 1+ horse the market doesn't have in its top-2, the algo's ordering can produce real exotic edge. R8 was the proof.
- Wrong: the current strategy bets boxes in EVERY race. 80% of those races are chalk-match, which means we're paying 22% takeout to bet two market-supported horses. That's negative-EV unless the market is incompetent.

Strategy that survives the reviewers:

- **Bet ONLY the FULL EDGE and PARTIAL EDGE races.** Strict mode enforces this.
- **In FULL EDGE races, key the algo's #1 over a 4-horse spread.** If the algo really sees something the market doesn't, the trifecta/super wheels are where the math pays.
- **In PARTIAL EDGE races, bet a forward exacta of algo's top-2 (not a box).** The 1-horse divergence is specifically about ordering — capture it forward, not boxed.
- **In CHALK MATCH races: PASS.** No bet placed. Even if we win, the win was the market's, not the algo's.

This is a much smaller daily bet sheet than before. That's the point.

---

## Files modified in this session

- `scripts/process_card.py` (+279 / −55 lines)
- `scripts/chalk_overlap_audit.py` (new, ~250 lines)
- `data/analysis/chalk_overlap_audit_2026-04-30_2026-04-25.md` (audit output)
- `HANDOFF_DERBY_DAY.md` (this doc)

Already committed and pushed. Pull `claude/thirsty-aryabhata-291678` and start there.

---

## Critical: Don't undo the hardening

The chalk-doubt overlay (`_pool_disparity_factor` chalk-doubt branch) and Tweak B (intra-card style override) are gated OFF for a reason. Both reviewers flagged them as overfitting / contamination. If you find yourself wanting to re-enable them to "boost confidence," DON'T. That's regression to the un-falsifiable claims that started this whole thread. The correct path is items 5-7 above (better calibration, real model, real edge attribution).

If Jason asks you to re-enable: explain that DeepSeek + Kimi reviews + the Apr 30 stratified audit all point the same direction, and propose item 3 (confidence intervals) instead.

---

## Reading order for first 10 minutes

1. This doc (you're here)
2. `data/analysis/chalk_overlap_audit_2026-04-30_2026-04-25.md` — the audit findings
3. `docs/ALGO_THESIS.md` — original thesis (now mostly invalidated)
4. `scripts/process_card.py` lines 1-50 (header) and 240-420 (scoring + edge guardrail)
5. `web/AGENTS.md` (Next.js gotchas)

Don't read everything. Read enough to act.
