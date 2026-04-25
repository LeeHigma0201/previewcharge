---
name: race-day
description: HorseGPT race-day workflow — prep handicapping for an upcoming card, refresh the live bet sheet, and verify the deployed simulator. Use when Jason says "race day", "prep Keeneland", "update bet sheet", or names a specific track + date for handicapping.
---

# Race-Day Workflow

## When to use
- Jason mentions an upcoming race date (e.g. "Keeneland Saturday", "Apr 26 card").
- Bet sheet at `/bets` needs a refresh after new data lands.
- Verifying the deployed simulator at https://previewcharge-nine.vercel.app.

## Repo entry points
- **Web UI**: `web/app/page.tsx` (simulator), `web/app/bets/page.tsx` (bet sheet), `web/app/today/page.tsx` (race-day card)
- **EV math**: `web/app/lib/ev-math.ts` — corrected pari-mutuel formulas (`winEV`, `exactaEV`, `trifectaEV`, `superfectaEV`, `isFalseFavorite`, `classifyTier`)
- **CD context**: `web/app/lib/cd-context.ts` — Churchill Downs–specific factors
- **Track-bias data**: `web/app/lib/keeneland-apr18.ts` (template for new dates)
- **Multi-race plays**: `web/app/lib/multi-race.ts` (Pick 3/4/5/6)
- **Backend pipeline (Python)**: `src/data/`, `src/features/`, `src/models/`

## Pre-card checklist
1. Fresh PP data ingested (`make ingest-scraped` or scrape with `make scrape`)
2. Track bias for the meet date is loaded — check `web/app/lib/<track>-<date>.ts`
3. ML odds + entries up to date in the day's data file
4. Run typecheck before deploy: `cd web && npx tsc --noEmit`

## Deploy flow
- Project is connected to `LeeHigma0201/previewcharge` on Vercel under team `chargeright`
- **Production deploys are CLI-driven** (`vercel --prod` from repo root), NOT git push
- Preview: `vercel deploy` → returns a `*-chargeright.vercel.app` URL
- After deploy, verify the canonical URL: `curl -sI https://previewcharge-nine.vercel.app/`

## Verifying badges work
- VALUE badge: green, shows when `overlay > threshold` (modelProb >> marketProb)
- FADE badge: red, shows when `isFalseFavorite()` is true (ML favorite ranks #4+ by model)
- Both render inside `result.predictions.map` in `web/app/page.tsx` — additive, never mutually exclusive

## Cortex
Use `mcp__cortex__cortex_context("horsegpt race day")` for prior-session context. Log novel race-day learnings via `mcp__cortex__cortex_log`.
