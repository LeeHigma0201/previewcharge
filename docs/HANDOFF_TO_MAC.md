# Handoff Note: Claude (Windows) → Claude (MacBook)

**Date written:** 2026-04-30, mid-card at Churchill Downs (Derby weekend Thursday).
**Author:** Claude on Jason's Windows machine, after a real-time race-day session that started ~10 AM ET and is ongoing through the 12-race CD card.
**Audience:** Whatever Claude session picks this up next on Jason's MacBook. Read this top-to-bottom before doing anything in this repo.

---

## What this repo is

HorseGPT v3.14 — a horse racing handicapping platform Jason runs at evchargeright.com / previewcharge-nine.vercel.app. The Python pipeline parses BRIS Ultimate PPs PDFs, scores horses, and feeds a Next.js web app (the bet sheet at `/bets` and the simulator at `/`). It's deployed on Vercel under team `chargeright`. Production deploys are CLI-driven (`vercel --prod` from repo root, NOT git push).

Scope today: **CD spring meet only**. Apr 25, 26, 29 cards already shipped. Today (Apr 30) is the in-flight card. **Derby is Saturday May 3** — this is the run-up.

## What happened today (the most important section)

### Starting state at 10 AM
- Apr 30 BRIS PDF wasn't parsed yet. Algo only had Apr 29 data loaded.
- The "algo" was a multiplicative residual stack on top of ML odds: `score = market_prob × bias_factor × ability_factor × (1 + tier_bonus) × sharp_money_boost`.
- `process_card.py` had two **silent bugs** I fixed early:
  1. `h.get("postPosition")` — always None because BRIS data uses `h.get("post")`. Result: **every horse got the inside-post bonus by default** because `post=0` triggered `post_iv_for(0)` → returned `post1to3IV` (1.55).
  2. `_ability_value` punished horses with single-Beyer figures (lone-Beyer trap).
- **Bigger problem we discovered around noon**: across 12 historical races we have results for (Apr 25 + R1, R2 of today), the algo top-1 hit rate was **5/12 = 42%** while just betting the ML chalk was **6/12 = 50%**. The algo had been UNDERPERFORMING by ~8 points. The residual stack was adding noise, not signal.

### Race-by-race results vs. algo

| R | Algo top-1 | ML chalk | Winner | Pool-disparity flag |
|---|---|---|---|---|
| R1 | ❌ #1 BFL | ❌ #1 | #4 Star's Image (9/2) | ✅ flagged #1 (chalk lost — 3rd) |
| R2 | ❌ #5 Shared Vision | ❌ #5 | #2 She'z the Law (15→1.6 live, 9.4× bet-down) | ✅ flagged #5 (3rd) |
| R3 | ❌ #5 Spotted | ❌ #5 | #2 Fresh Out (photo over #4 Silvertown) | ✅ flagged #5 (out of top 5) |
| R4 | ❌ #8 Theoretical | ❌ #8 | #12 Breaking Hearts (5/1) | ✅ flagged #8 (5th) |
| **R5** | ✅ **#3 Jinxzi** | ❌ #3 (this was algo top + ML chalk same race) | #3-#12 in order | (no flag fired — none warranted) |

R6 is the **UAE President Cup G1 Arabian Stakes** — model is Thoroughbred-only, **explicitly skipped** in `process_card.py` via `race.get("isArabian")`.
R7-R12 still ahead.

**The pivotal moment:** R5 was the FIRST race the algo's top 2 hit the exacta in order. This was after I shipped algo v2 (Tweaks A+B below). Before v2, algo had been 0/4 on top-1.

### Patterns we VALIDATED today (real, not noise)

1. **Pool-disparity chalk-doubt flag — 4-for-4.** When a horse is in the top-3 by live odds AND its win-pool % share exceeds its place-pool % share by >5pts, the public is over-betting; smart money in the place pool isn't following. Every such horse today lost. This is the strongest signal we have. It's grounded in how betting markets actually work (place pools are less casual-money-driven; the gap reveals casual vs. sharp divergence).

2. **Smart-money board signal.** When place-pool % share exceeds win-pool % share by ~5+pts (e.g. R5 #12 Tregetour at W17/P23/S10), that horse is a strong board play. R5 #12 finished 2nd. First clean validation.

3. **Today the track was closer-friendly.** Through 4 races, all 4 winners were P/EP/closer types. The CD spring-meet defaults (eIV 1.45, sIV 0.35) were wrong for today. Tweak B detected this and overrode the bias values once 4 races showed the pattern. R5 winner #3 Jinxzi (E from post 3) was tagged E-style but Tweak B's compressed range still kept him #1.

### Patterns that were N=1 hypothesis (NOT yet validated)

- **Lone-Beyer trap** (R1 only) — when only 1 Beyer figure exists, it's likely off-layoff and unreliable. Algo now defers to Prime Power.
- **Sharp 9× bet-down on a longshot wins** (R2 only) — She'z the Law went 15/1 ML to 1.6 live and won.
- **Mid-priced (5/1–12/1) W>>P = sharp WIN money** (R4 #11 only) — different from chalk-doubt despite same fingerprint.
- **Balanced-pool + top-tier connections in chaos races = sleeper** (R4 #12 only) — Cherie DeVaux + Jose Ortiz, perfectly balanced 13/13/12 pool, won at 5/1 while we had her 4th.

Don't ship more N=1 fixes. Each one is overfitting unless validated.

## What's in the repo (changes you'll see in this PR)

### Python pipeline (scripts/)
- **`parse_bris_pdf.py`** — patched the day-of-week regex (was hardcoded "Wednesday"), added `1‚` distance glyph for Arabian section, added `isArabian` flag detection (header starts with "Arabian PP's").
- **`apply_live_odds.py`** (new) — reads `live-snapshot.json` produced by Chrome scraping and applies live odds + scratches + pool % to `raw-entries.json`. Preserves true `mlOddsOriginal` across multiple updates (the original implementation was overwriting it on each apply, breaking the bet-down ratio detector).
- **`gen_cd_ts.py`** (new) — generates `web/app/lib/cd-<date>.ts` from `raw-entries.json`. Owns the canonical TS file. Crucially, `process_card.py` was patched to NOT overwrite the TS — `process_card.py`'s `write_ts_static` produces a limited-data version that strips Beyer/PP/etc.
- **`process_card.py`** — heavy refactor:
  - Bug fixes: `post` key (was `postPosition`), `post_iv_for(0)` returns 1.0 not the inside-post bonus.
  - Lone-Beyer protection in `_ability_value`.
  - `_ability_factors` clamp tightened from 0.7–1.4 to 0.85–1.15; multiplier from 0.25 to 0.15. After the historical audit showed residuals were adding noise.
  - `_sharp_money_signals` for ML→live bet-down ratio.
  - **`_pool_disparity_factor` (Tweak A)** — dual-mode penalty/bonus based on live-odds rank. Validated 4/4 today on chalk-doubt.
  - **`_expert_E_factor`** — TwinSpires Expert E rank bonus (×1.10/1.06/1.03).
  - **`TODAYS_BIAS_OVERRIDE` (Tweak B)** — auto-activates when `results.json` shows 4+ races completed. Compresses style IV range (eIV 1.45→1.10, sIV 0.35→0.90) and softens post bias.
  - Added 12 new CD-spring trainers to `TIER_TRAINERS` (Joe Sharp, Saffie Joseph Jr., Cherie DeVaux, Mark Casse, Dale Romans, Ian Wilkes, Rusty Arnold, Eddie Kenneally, Philip Bauer, Philip Damato, Thomas Drury Jr., Lauren Robson).
  - Skip Arabian races in main loop.
  - Picks.md now has columns for Style, PP, Beyer, Ability×, score breakdown.

### Web app (web/)
- **`web/app/lib/cd-2026-04-30.ts`** — auto-generated, BRIS-rich, 12 races, 104 horses (post-scratches).
- **`web/app/lib/results-store.ts`** — `CONFIRMED_RESULTS` populated as races run. Already contains R1–R5. **Important rule:** the `results-store.ts` `loadResults()` spreads `CONFIRMED_RESULTS` *over* localStorage — this is intentional but can BURN you if you leave yesterday's results in there. We hit this exact bug at noon and it caused the bet sheet to display R1+R2 as FINAL with yesterday's horses.
- **`web/app/lib/multi-race.ts`** — `MULTI_RACE_BETS` rewritten for today's 12-race structure with R6 Arabian excluded from all multi-race pools.
- **`web/app/bets/page.tsx`** — added a `LEARNED` banner system that activates as `results[N]` populates. Through-R4 banner explains the algo v2 ship + audit. Default `trackCondition` was "Sloppy" (yesterday's leftover) → changed to "Fast" for today.
- **`web/app/page.tsx`** + **`web/app/layout.tsx`** — date strings updated CD Wed Apr 29 → CD Thu Apr 30.
- **`web/app/api/chat/route.ts`** — ClarkBot. Updated system prompt with today's full card data, all algo internals (Benter anchor, bias multiplier, ability factor, lone-Beyer protection, sharp money detector, pool disparity, Expert E), and R1–R5 results + lessons. Two important AI SDK v6 gotchas:
  - `convertToModelMessages` is **async** — must `await` it.
  - `@ai-sdk/google` reads `GOOGLE_GENERATIVE_AI_API_KEY` by default; we already had `GEMINI_API_KEY` set, so route uses `createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY })`.
- **`web/app/components/ClarkBot.tsx`** (new) — floating green chat button bottom-right of every page. Renders on `/bets` and `/`. Uses `useChat` from `@ai-sdk/react` v6 (note the `parts: [{type:'text', text}]` shape; messages have `id` and `role` only, no top-level `content`).
- **`web/app/api/scratches/route.ts`** + **`web/app/api/race-insights/route.ts`** + **`web/app/api/live-results/route.ts`** + **`web/app/api/today/route.ts`** + **`web/app/api/race/route.ts`** — all updated CD_2026_04_29 → CD_2026_04_30, date constants flipped, weekday text changed Wed → Thu.

### Data (data/)
- **`data/cd-2026-04-29/`** — yesterday's full BRIS-parsed card.
- **`data/cd-2026-04-30/`** — today's BRIS-parsed card + `live-snapshot.json` (TwinSpires scrape with W/P/S pool %) + `results.json` (R1–R5 finishes) + `picks.md` + `exotics.csv` + `multi-race.md` + `horses.csv` + `races.csv` + `backtest.md`.

## How we scrape TwinSpires (the key tool today)

Jason logged in to TwinSpires via Chrome MCP this morning. From there:

1. Navigate to `/bet/program/classic/churchill-downs/cd/Thoroughbred/{N}/advanced` for a race's odds board, scratches, ML, and Profit Line.
2. Navigate to `/bet/program/classic/churchill-downs/cd/Thoroughbred/{N}/pools` for win/place/show pool % per horse — this is the data that drives the chalk-disparity flag.
3. Navigate to `/bet/program/classic/churchill-downs/cd/Thoroughbred/{N}/probables` for exotic probable payouts (haven't fully integrated yet).
4. The `cdux-todays-bets-menu-item` element opens a side panel showing his placed wagers — we used this to display his actual bets in the UI (panel since removed at his request).

Pool % data only becomes available ~30-45 minutes before each race goes off. Scrape the pools page on a re-fetch loop closer to post.

The extractor JS pattern is well-established in this session — search the conversation transcript for `.entry_col_odds` and `.pools-row` selectors.

## Open issues / known bugs we documented but did NOT fix

These are in the algo audit (12 issues found, only 4 critical fixed):

5. BRIS style codes can be wrong — R3 #4 Silvertown tagged S, ran as E. No fix.
6. `_ability_factors` returns 1.0 for all when fewer than 3 horses have valid ability data. Silent disable. Edge case but real.
7. Mud-% adjustment is dead code — `condition` field in `raw-entries.json` is None (BRIS PDF doesn't set it).
8. Multiplicative residual cascade. The fundamental shape problem. Jason's idea (a vectorial weighted-additive sum with renormalization for missing data) is the right rebuild — see "Where to go next" below.
9. `market_prob` returns 0.05 for missing odds. Should drop the horse from market normalization.
10. `plackett_luce_pair` is a stub that returns `{"top_k": top}` with no actual conditional probabilities. Exotic recommendations don't use real joint probs.
11. Exotic strategy thresholds (0.34, 0.78, 0.62) are gut-feel constants. Not validated.
12. Tier lists still incomplete (Gregory D. Foley — R2 winner's trainer — not on list).

## Where to go next on the Mac

In rough priority order:

### 1. Validate or invalidate the four "true" patterns on a 50+ race sample
We have:
- Pool-disparity chalk-doubt flag (4/4 today)
- Smart-money board signal (1/1 today on R5 #12)
- Mid-price W>>P = sharp WIN (1/1 on R4 #11)
- Closer-friendly track-day correction (1 day's data)

Need: 50+ races with pool data captured, run the algo with and without each signal, compare ROI per dollar bet. The single highest-value piece of work in this entire system.

### 2. Replace the multiplicative cascade with weighted-additive scoring
Jason's proposal (right call):
```
score = market_prob × exp(0.3 × weighted_delta_sum)
```
where each available signal contributes a delta with explicit weight, missing data contributes nothing (no penalty), weights normalize across what we actually have. This solves bugs 8 and 9 in one move and matches statistical best practice for sparse-data ensembles.

### 3. Live-odds delta integration into pre-race scoring
Currently `apply_live_odds.py` is a manual run-after-scrape. Should be a continuous polling loop that updates raw-entries.json every 5 min in the 30 min before post. Cortex notes flagged this as the single highest-leverage signal we don't yet have integrated. We've now used it ad-hoc all day (the Chrome MCP scrapes); need to formalize.

### 4. Pace projection (proper handicapper feature)
We have style IVs but no pace simulation. R3 #6 Kopiana was the lone E in a P/S-heavy field — by handicapper logic she should have set fractions and either wired or set up closers. The algo doesn't model this. Pace-sim would have changed the chaos-box rec to a key-#6 over closers.

### 5. Trainer pattern angles
Currently flat tier_bonus. Real handicapping uses "first off the claim", "blinkers on", "2nd start back from layoff", "trainer hot the last 14 days". None of this is in the algo. BRIS has the data; we just don't parse it.

### 6. The web infrastructure
- `process_card.py` and `gen_cd_ts.py` should be unified — they both write the TS file and we patched out one's writer. Should be one source of truth.
- The `MULTI_RACE_BETS` array is hardcoded per-day. Should be auto-detected from track pools.
- ClarkBot's system prompt is per-day-baked into route.ts. Should read from raw-entries.json at request time.

## Operational notes for race-day continuation

If you're continuing the card today (R6+):

- **R6 Arabian — DO NOT SCORE.** Skipped automatically by algo. Use it for visual/pace observation only.
- **R7 prelim picks already deployed**: #1 Honfleur (1.8) + #4 Cape Sounion (3.0) + #5 Heavenly Melody (4.5). Trifecta box `1-4-5` for $3. **But pool data wasn't in yet at deploy time.** Pull pools at 3:35 PM ET (~30 min before R7 post) and re-apply via `apply_live_odds.py` if any disparity fires.
- **`results.json` drives the Tweak B intra-card override.** When you log a finish, it auto-activates the closer-friendly bias for unrun races. Update `results-store.ts` `CONFIRMED_RESULTS` separately for the web UI (the two systems are not yet linked — that's bug #13).

If you're picking up tomorrow (Friday Apr 31, Oaks Day) or later:

- The CD spring meet runs through Derby Day May 3. Each new card needs a fresh BRIS PDF dropped in `D:/ChargeRight_User/Downloads/`, then the pipeline:
  ```bash
  python -c "from pypdf import PdfReader; r=PdfReader('D:/ChargeRight_User/Downloads/Churchill <day>.pdf'); open('data/cd_<day>_raw.txt','w',encoding='utf-8').write('\n'.join(p.extract_text() for p in r.pages))"
  python scripts/parse_bris_pdf.py data/cd_<day>_raw.txt CD <yyyy-mm-dd>
  python scripts/gen_cd_ts.py <yyyy-mm-dd>
  python scripts/process_card.py <yyyy-mm-dd>
  ```
- Update all 6 web file imports (`cd-2026-04-30` → new date), update layout/page strings, deploy.
- Reset `CONFIRMED_RESULTS` to `{}` in `results-store.ts` (we keep yesterday's only as a record — should not bleed into today's bet sheet).

## Bottom line for whoever picks this up

The single most important thing I learned today: **the residual stack we built (Beyer × PP × style × post bias × trainer tier) was adding noise, not signal.** It UNDERPERFORMED just betting the ML chalk by ~8 points across 12 historical races. The signals that DID work today (pool disparity, Expert E + bet-down combo, smart-money board lean) were sitting in TwinSpires the whole time, invisible to the algo because we weren't scraping pool data into the pipeline.

The algo got better today because we pivoted from "engineer features from BRIS data" to "ingest the betting market's own structural signals." That's the framing for everything that comes next.

Jason isn't a gambler — he's trying to prove that exploitable patterns exist in horse racing data and that we can structure exotics around them. The R5 exacta hit (#3-#12 in order, called by the algo's new top-2) is the first real evidence we have. Validate that signal at scale and the system has a real edge. Don't keep stacking N=1 hypotheses; we did too much of that today.

Production URL: https://previewcharge-nine.vercel.app/bets
Vercel project: chargeright/previewcharge (CLI deploy from repo root)
ClarkBot: floating green button on /bets and /, powered by Gemini Flash via existing `GEMINI_API_KEY`.

Good luck. Don't trust a pattern with N<5.
