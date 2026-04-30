# HorseGPT Betting App Redesign + Derby War Room

**Date:** 2026-04-13
**Status:** Approved
**Scope:** UI redesign to match real betting apps + Derby War Room feature

## Summary

Redesign HorseGPT from a developer prototype into a betting-app-style interface focused on exotic bets (exacta, trifecta, superfecta) at Churchill Downs and Keeneland. Add a self-contained Derby War Room feature that tracks contenders over weeks and delivers scenario-based exotic analysis on race day.

## Two Modes

### 1. Daily Card Mode (morning routine)
- Pick CD or KEE (only these two tracks in the selector)
- App fetches today's card automatically
- Tap a race, data loads, exotic engine runs
- See ranked exotic combos with estimated payoffs
- Optional TVG screenshot upload to upgrade data quality

### 2. Derby War Room (self-contained feature)
- Separate `/derby` route
- Tracks ~20 contenders over weeks
- Auto-scrapes prep race results (Florida Derby, Blue Grass, Wood Memorial, Arkansas Derby, SA Derby)
- Contender profiles: Beyer trend, running style, connections, prep history
- Race day: exotic engine with accumulated data + multi-scenario pace analysis

## UI Design — Betting App Style

### Layout Structure
```
[Top Bar] Track selector | Date | Next post time
[Race Tabs] R1  R2  R3  R4  R5  R6  R7  R8  R9  R10  R11
[Race Card] Compact horse rows
[Bet Tabs] Exacta | Trifecta | Superfecta | Win
[Combos] Ranked exotic combinations
```

### Top Bar
- Track dropdown: Churchill Downs, Keeneland only
- Today's date
- Post time countdown for the selected race (from Equibase data)

### Race Tabs
- Horizontal scrollable row of race numbers
- Active race highlighted
- Shows race type below number (e.g., "6f Dirt MSW")
- Tapping a race loads its data automatically

### Race Card (per horse)
- Program number in colored circle
- Horse name (bold)
- Jockey / Trainer (smaller, gray)
- Morning line odds as fractional (5/2, 8/1, not 2.5, 8.0)
- Running style badge: Speed (red), Presser (orange), Stalker (yellow), Closer (blue), Deep Closer (purple)
- Key stats row: last Beyer, days rest, record (W-P-S from starts)
- "VALUE" tag when model probability beats morning line by 40%+
- Tap to expand: shows model insight detail (speed fig trend, pace fit, class analysis)

### Bet Type Tabs
- Exacta | Trifecta | Superfecta | Win
- Default to Exacta (most common exotic)
- Each tab shows ranked combinations for that bet type

### Exotic Combos Display
- Rank number
- Programs: #3 / #7 / #1 (bold numbers, slash separated)
- Horse names (smaller)
- Probability percentage
- Estimated payout (after takeout)
- "PLAY" badge on top value combos
- Total ticket cost for all PLAY combos at bottom

### Theme
- Dark background (near-black, like FanDuel Racing / DraftKings)
- White and light gray text
- Green for positive value / PLAY tags
- Red for warnings / scratches
- Blue accent for selected states
- Monospace for odds and payoffs

### What the UI does NOT show
- No z-scores, no sigma notation, no weight percentages
- No academic model breakdown in the main view
- No "Run Model" button — engine runs automatically when data loads
- No splash screen

### Fractional Odds Display
Convert decimal to fractional for display:
- 2.5 -> 5/2
- 8.0 -> 8/1
- 1.2 -> 6/5
- 1.0 -> Even
- 3.0 -> 3/1

## Data Flow

### Daily Card
1. User selects track (CD or KEE)
2. `/api/today` returns available races for that track
3. User taps a race number
4. `/api/race` fetches entries:
   - Try Equibase HTML scrape first
   - Fall back to Gemini search
   - Check for scratches
   - Enrich with Beyers, running styles, connections via Gemini grounded search
5. Monte Carlo engine runs client-side with the enriched data
6. Results populate the bet tabs automatically
7. Optional: user uploads TVG screenshots -> data merges -> engine re-runs

### Derby War Room
1. `/api/derby/contenders` returns all tracked contenders with profiles
2. `/api/derby/scrape` triggers prep race scraping (can be called manually or on schedule)
3. Contender profiles stored in SQLite `derby_contenders` table
4. On Derby Day: `/derby` page loads all contenders, engine runs with curated data
5. Scenario analysis: engine runs 3x with modified pace inputs (hot/contested/lone speed)
6. Three exotic slates displayed in tabs: "Hot Pace" / "Contested" / "Lone Speed"

## Database Schema Addition

```sql
CREATE TABLE derby_contenders (
    id INTEGER PRIMARY KEY,
    year INTEGER NOT NULL,           -- 2026
    horse_name TEXT NOT NULL,
    sire TEXT,
    trainer TEXT,
    jockey TEXT,                      -- assigned jockey (updated close to race)
    running_style TEXT,               -- E/EP/P/S/C
    points INTEGER DEFAULT 0,        -- Derby qualifying points
    morning_line_odds REAL,          -- set closer to race day
    post_position INTEGER,           -- drawn on Monday of Derby week
    weight INTEGER DEFAULT 126,      -- Derby weight
    notes TEXT,                       -- free text notes
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year, horse_name)
);

CREATE TABLE derby_prep_races (
    id INTEGER PRIMARY KEY,
    contender_id INTEGER REFERENCES derby_contenders(id),
    race_name TEXT NOT NULL,          -- "Florida Derby", "Blue Grass", etc.
    race_date TEXT NOT NULL,
    track_code TEXT NOT NULL,
    distance TEXT,
    surface TEXT DEFAULT 'Dirt',
    finish_position INTEGER,
    field_size INTEGER,
    beyer_speed INTEGER,
    final_odds REAL,
    margin TEXT,                       -- "2 lengths", "nose", etc.
    running_line TEXT,                 -- "3-2-1-1" (positions at each call)
    points_earned INTEGER DEFAULT 0,
    notes TEXT,
    UNIQUE(contender_id, race_name, race_date)
);
```

## File Structure

```
web/app/
  page.tsx                  -- Redesigned: dark theme, betting app layout
  derby/
    page.tsx                -- Derby War Room (self-contained)
  api/
    today/route.ts          -- Returns CD + KEE tracks and today's races
    race/route.ts           -- Fetches entries + enrichment (exists, updated)
    derby/
      contenders/route.ts   -- CRUD for derby contender profiles
      scrape/route.ts       -- Trigger prep race scraping
  lib/
    data.ts                 -- Monte Carlo engine (exists, unchanged)
    types.ts                -- Type definitions (exists, minor additions)
    odds.ts                 -- NEW: decimal-to-fractional odds conversion
    theme.ts                -- NEW: dark theme color tokens
```

## Out of Scope
- Betting integration (no real money transactions)
- Live odds feeds
- Mobile native app
- Tracks beyond CD and KEE (for now)
- User accounts / authentication
