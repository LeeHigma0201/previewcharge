// Keeneland — Saturday, April 18, 2026
// Static card pulled from Brisnet Race Summary / Track Bias Stats PDF
// (bypasses Gemini/Equibase for reliability on race day)

export interface StaticHorse {
  program: string;
  name: string;
  mlOdds: number;           // decimal odds
  style: string;            // E, EP, P, S, C
  last3Beyer: number[];     // speed last race, back speed, and prior — best available from PDF
  daysSinceLast: number;
  weight: number;
  primePower?: number;      // Brisnet Prime Power (composite rating)
  currentClass?: number;    // Brisnet Current Class
  avgClassLast3?: number;   // Brisnet Avg Class Last 3
  earlyPaceLast?: number;   // Brisnet Early Pace Last Race
  latePaceLast?: number;    // Brisnet Late Pace Last Race
  mudPct?: number;          // Pedigree Mud/Turf %
  isClassDrop?: boolean;    // inferred: currentClass < avgClassLast3
}

// Per-race track bias (from Brisnet Track Bias Stats — WEEK totals, most recent signal)
// IV = Impact Value. IV > 1.0 means that style/post wins more than expected.
export interface TrackBias {
  surface: "Dirt" | "Turf";
  distanceLabel: string;
  speedBiasPct: number;     // % of recent races where wire-to-wire or early leaders held
  railBias: string;         // "+", "0", "-" — rail running indicator
  // Runstyle IVs (Week totals)
  eIV: number;
  epIV: number;
  pIV: number;
  sIV: number;
  // Post position IVs (Week totals)
  post1to3IV: number;
  post4to7IV: number;
  post8plusIV: number;
}

export interface StaticRace {
  raceNumber: number;
  postTime: string;
  raceType: string;
  distance: string;
  surface: "Dirt" | "Turf";
  purse: number;
  condition: string;
  name?: string;            // stakes name if applicable
  trackBias: TrackBias;
  horses: StaticHorse[];
}

// Helper to build horse entries compactly
const h = (
  program: string, name: string, ml: number, style: string,
  beyers: number[], days: number, weight: number,
  extras: Partial<StaticHorse> = {},
): StaticHorse => ({
  program, name, mlOdds: ml, style,
  last3Beyer: beyers, daysSinceLast: days, weight,
  ...extras,
});

// ── RACE 1 — MSW 3yo+ F&M 1 1/16m Dirt $110K ──
// Post 1:00 PM. Dirt 8.5f. Week: Speed bias 86%, Rail 0,
// E 1.58 / EP 1.63 / P 0.00 / S 0.64. Posts 1-3 IV 0.00, 4-7 IV 1.07, 8+ IV 2.62.
const race1: StaticRace = {
  raceNumber: 1, postTime: "1:00 PM",
  raceType: "MSW", distance: "1 1/16m", surface: "Dirt", purse: 110000, condition: "Fast",
  trackBias: {
    surface: "Dirt", distanceLabel: "8.5f",
    speedBiasPct: 86, railBias: "0",
    eIV: 1.58, epIV: 1.63, pIV: 0.00, sIV: 0.64,
    post1to3IV: 0.00, post4to7IV: 1.07, post8plusIV: 2.62,
  },
  horses: [
    h("4", "Raghba",        3.0, "EP", [71, 89, 94],  57, 118, { primePower: 122.0, currentClass: 114.3, avgClassLast3: 112.9, earlyPaceLast: 73, latePaceLast: 77, mudPct: 18 }),
    h("2", "Song of Sarah", 2.0, "EP", [84, 75, 85],  34, 118, { primePower: 121.7, currentClass: 113.9, avgClassLast3: 112.4, earlyPaceLast: 76, latePaceLast: 86 }),
    h("3", "Reality Star",  6.0, "P",  [80, 84, 81],  98, 118, { primePower: 117.5, currentClass: 0,     avgClassLast3: 110.2, earlyPaceLast: 77, latePaceLast: 82, mudPct: 14 }),
    h("5", "Babysitter",    4.5, "P",  [75, 80, 82],  57, 118, { primePower: 0,     currentClass: 111.7, avgClassLast3: 108.2, earlyPaceLast: 88, latePaceLast: 74, mudPct: 11 }),
    h("1", "Miss Milky Way",8.0, "E",  [65, 85, 73],  28, 118, { primePower: 118.1, currentClass: 111.5, avgClassLast3: 110.4, earlyPaceLast: 0,  latePaceLast: 69 }),
    h("6", "Sonhador",      4.0, "S",  [73, 86, 64], 119, 118, { primePower: 118.1, currentClass: 110.0, avgClassLast3: 112.2, earlyPaceLast: 71, latePaceLast: 83, mudPct: 14 }),
  ],
};

// ── RACE 2 — CLM 20000n2L 1 1/8m Dirt $49K ──
// Post 1:32 PM. Dirt 9.0f. Week: Speed bias 0%, Rail +, E 0.00 / EP 0.00 / P 2.65 / S 1.97.
// Posts 1-3 IV 2.21, 4-7 IV 1.47, 8+ IV 0.00. CLOSER BIAS.
const race2: StaticRace = {
  raceNumber: 2, postTime: "1:32 PM",
  raceType: "CLM 20000n2L", distance: "1 1/8m", surface: "Dirt", purse: 49000, condition: "Fast",
  trackBias: {
    surface: "Dirt", distanceLabel: "9.0f",
    speedBiasPct: 0, railBias: "+",
    eIV: 0.00, epIV: 0.00, pIV: 2.65, sIV: 1.97,
    post1to3IV: 2.21, post4to7IV: 1.47, post8plusIV: 0.00,
  },
  horses: [
    h("4", "Bonafide",         20.0, "P",  [81, 81, 80],  34, 120, { primePower: 119.4, currentClass: 109.9, avgClassLast3: 108.8, earlyPaceLast: 90, latePaceLast: 84 }),
    h("8", "Whiskey Shot",      9.4, "P",  [38, 38, 86], 205, 127, { primePower: 115.2, currentClass: 111.0, avgClassLast3: 110.8, earlyPaceLast: 86, latePaceLast: 78, mudPct: 6 }),
    h("9", "Tiz Freedom",       3.0, "P",  [69, 53, 83],  15, 120, { primePower: 119.0, currentClass: 0,     avgClassLast3: 108.9, earlyPaceLast: 0,  latePaceLast: 63, mudPct: 7 }),
    h("1", "D Day Sky",         4.5, "EP", [72, 77, 81],  29, 120, { primePower: 114.6, currentClass: 111.0, avgClassLast3: 110.1, earlyPaceLast: 83, latePaceLast: 66, mudPct: 20 }),
    h("5", "Consolidated",      6.0, "EP", [77, 80, 81],  65, 127, { primePower: 118.1, currentClass: 109.7, avgClassLast3: 108.5, earlyPaceLast: 76, latePaceLast: 84, mudPct: 15 }),
    h("2", "Romantic Lead",    10.0, "P",  [74, 78, 70],  22, 120, { primePower: 110.1, currentClass: 108.8, avgClassLast3: 107.5, earlyPaceLast: 83, latePaceLast: 100 }),
    h("3", "Stonemont Reunion", 8.0, "P",  [80, 80, 82],  31, 120, { primePower: 111.0, currentClass: 109.9, avgClassLast3: 108.9, earlyPaceLast: 80, latePaceLast: 97 }),
    h("6", "Phraseologism",    20.0, "S",  [69, 69, 50],  22, 120, { primePower: 106.4, currentClass: 0,     avgClassLast3: 107.6, earlyPaceLast: 46, latePaceLast: 70 }),
    h("7", "Ryu Mo",           15.0, "E",  [72, 77, 67],  21, 120, { primePower: 116.3, currentClass: 0,     avgClassLast3: 107.5, earlyPaceLast: 55, latePaceLast: 70 }),
  ],
};

// ── RACE 3 — ALW 120000n1x F&M 5.5f Turf $120K ──
// Post 2:04 PM. Turf 5.5f. Week: Speed bias 75%, Rail +, E 0.79 / EP 1.87++ / P 1.34 / S 0.00.
// Posts 1-3 IV 0.00, 4-7 IV 0.68+, 8+ IV 1.11/1.41.
const race3: StaticRace = {
  raceNumber: 3, postTime: "2:04 PM",
  raceType: "ALW 120000n1x", distance: "5.5f", surface: "Turf", purse: 120000, condition: "Firm",
  trackBias: {
    surface: "Turf", distanceLabel: "5.5f",
    speedBiasPct: 75, railBias: "+",
    eIV: 0.79, epIV: 1.87, pIV: 1.34, sIV: 0.00,
    post1to3IV: 0.00, post4to7IV: 0.68, post8plusIV: 1.41,
  },
  horses: [
    h("10", "Hot Mash",           3.0, "EP", [86, 86, 103], 217, 126, { primePower: 142.5, currentClass: 0,     avgClassLast3: 115.6, earlyPaceLast: 100, latePaceLast: 90, mudPct: 20 }),
    h("7",  "Capturing",          8.0, "P",  [86, 86, 89],  57, 126, { primePower: 131.1, currentClass: 113.1, avgClassLast3: 114.1, earlyPaceLast: 92,  latePaceLast: 89, mudPct: 15 }),
    h("8",  "Perfect Figure",     3.0, "EP", [82, 83, 82], 259, 126, { primePower: 125.7, currentClass: 112.7, avgClassLast3: 113.5, earlyPaceLast: 94,  latePaceLast: 81, mudPct: 17 }),
    h("4",  "Glean",             15.0, "EP", [77, 77, 96], 336, 126, { primePower: 112.1, currentClass: 0,     avgClassLast3: 113.0, earlyPaceLast: 98,  latePaceLast: 77, mudPct: 11 }),
    h("2",  "Pillar of Beauty",   6.0, "EP", [83, 84, 94],  43, 126, { primePower: 122.7, currentClass: 112.7, avgClassLast3: 113.0, earlyPaceLast: 93,  latePaceLast: 86, mudPct: 17 }),
    h("1",  "Stepping Stones",    4.5, "EP", [80, 83, 82],  36, 126, { primePower: 124.9, currentClass: 112.7, avgClassLast3: 112.5, earlyPaceLast: 92,  latePaceLast: 81, mudPct: 19 }),
    h("2",  "Viva Vienne",       20.0, "P",  [75, 75, 69],  43, 126, { primePower: 121.9, currentClass: 112.5, avgClassLast3: 112.1, earlyPaceLast: 86,  latePaceLast: 80 }),
    h("9",  "Bourbon Notes",      6.0, "EP", [86, 86, 95],  35, 126, { primePower: 129.2, currentClass: 110.9, avgClassLast3: 112.5, earlyPaceLast: 93,  latePaceLast: 84, mudPct: 10 }),
    h("14", "J Z's Last Schance",20.0, "S",  [79, 81, 89],  38, 126, { primePower: 118.2, currentClass: 112.2, avgClassLast3: 112.3, earlyPaceLast: 82,  latePaceLast: 82, mudPct: 28 }),
    h("3",  "Betty's Dance",     10.0, "P",  [79, 79, 99],  43, 126, { primePower: 122.7, currentClass: 112.4, avgClassLast3: 113.0, earlyPaceLast: 89,  latePaceLast: 72 }),
    h("11", "Something Stronger",10.0, "EP", [81, 83, 91],  70, 126, { primePower: 119.1, currentClass: 111.1, avgClassLast3: 111.4, earlyPaceLast: 89,  latePaceLast: 81, mudPct: 18 }),
    h("6",  "Valala",            20.0, "E",  [78, 78, 80],  24, 126, { primePower: 111.4, currentClass: 0,     avgClassLast3: 112.6, earlyPaceLast: 85,  latePaceLast: 80 }),
    h("16", "Miss Lonelle",      20.0, "P",  [70, 70, 85],  38, 126, { primePower: 109.3, currentClass: 110.2, avgClassLast3: 111.0, earlyPaceLast: 0,   latePaceLast: 70 }),
    h("1",  "Bolt Dior",         15.0, "P",  [70, 70, 83],  24, 126, { primePower: 119.8, currentClass: 0,     avgClassLast3: 111.9, earlyPaceLast: 83,  latePaceLast: 72 }),
    h("5",  "Family",            12.0, "EP", [72, 72, 83],  38, 126, { primePower: 111.4, currentClass: 0,     avgClassLast3: 111.4, earlyPaceLast: 82,  latePaceLast: 72 }),
    h("15", "Trust Fund Philly",  8.0, "EP", [78, 78, 83],  49, 126, { primePower: 124.9, currentClass: 0,     avgClassLast3: 110.0, earlyPaceLast: 88,  latePaceLast: 74 }),
  ],
};

// ── RACE 4 — ALW 30000s 1 1/16m Dirt $55K ──
// Post 2:36 PM. Dirt 8.5f. Week same as Race 1 (86% speed, strong EP).
const race4: StaticRace = {
  raceNumber: 4, postTime: "2:36 PM",
  raceType: "ALW 30000s", distance: "1 1/16m", surface: "Dirt", purse: 55000, condition: "Fast",
  trackBias: {
    surface: "Dirt", distanceLabel: "8.5f",
    speedBiasPct: 86, railBias: "0",
    eIV: 1.58, epIV: 1.63, pIV: 0.00, sIV: 0.64,
    post1to3IV: 0.00, post4to7IV: 1.07, post8plusIV: 2.62,
  },
  horses: [
    h("4", "Baytown Bruiser",     4.0, "EP", [90, 92, 90],  42, 127, { primePower: 125.8, currentClass: 114.8, avgClassLast3: 114.5, earlyPaceLast: 90,  latePaceLast: 91, mudPct: 22 }),
    h("5", "Mary's Boy Bolt",     3.0, "EP", [86, 88, 89],  37, 127, { primePower: 123.0, currentClass: 113.7, avgClassLast3: 113.1, earlyPaceLast: 89,  latePaceLast: 87, mudPct: 15 }),
    h("7", "Protective",         12.0, "P",  [78, 89, 83],  15, 127, { primePower: 128.8, currentClass: 113.5, avgClassLast3: 112.9, earlyPaceLast: 85,  latePaceLast: 86, mudPct: 12 }),
    h("3", "Morunning",           2.0, "E",  [80, 89, 81],  43, 127, { primePower: 124.2, currentClass: 113.0, avgClassLast3: 110.4, earlyPaceLast: 76,  latePaceLast: 81, mudPct: 16 }),
    h("2", "Askari",              6.0, "P",  [80, 80, 82],  35, 127, { primePower: 122.3, currentClass: 113.0, avgClassLast3: 112.4, earlyPaceLast: 84,  latePaceLast: 83, mudPct: 17 }),
    h("6", "Armed N Dangerous",  10.0, "P",  [78, 86, 81],  34, 127, { primePower: 118.4, currentClass: 113.0, avgClassLast3: 112.1, earlyPaceLast: 83,  latePaceLast: 78, mudPct: 14 }),
    h("4", "Truly Legit",        15.0, "P",  [72, 78, 74],  30, 127, { primePower: 118.8, currentClass: 112.6, avgClassLast3: 111.7, earlyPaceLast: 72,  latePaceLast: 81, mudPct: 15 }),
    h("1", "Mountain Wolf",      30.0, "P",  [0,  79, 81],  32, 127, { primePower: 118.1, currentClass: 111.6, avgClassLast3: 111.6, earlyPaceLast: 80,  latePaceLast: 78, mudPct: 14 }),
    h("8", "Ice Shot",            8.0, "P",  [76, 78, 69],  57, 127, { primePower: 114.6, currentClass: 110.1, avgClassLast3: 110.4, earlyPaceLast: 72,  latePaceLast: 67, mudPct: 12 }),
  ],
};

// ── RACE 5 — MCL 50000 1 1/16m Dirt $55K ──
// Post 3:08 PM. Dirt 8.5f same bias.
const race5: StaticRace = {
  raceNumber: 5, postTime: "3:08 PM",
  raceType: "MCL 50000", distance: "1 1/16m", surface: "Dirt", purse: 55000, condition: "Fast",
  trackBias: {
    surface: "Dirt", distanceLabel: "8.5f",
    speedBiasPct: 86, railBias: "0",
    eIV: 1.58, epIV: 1.63, pIV: 0.00, sIV: 0.64,
    post1to3IV: 0.00, post4to7IV: 1.07, post8plusIV: 2.62,
  },
  horses: [
    h("3",  "Susan's Boy",      4.0, "P",  [83, 88, 83],  59, 118, { primePower: 123.8, currentClass: 111.9, avgClassLast3: 111.4, earlyPaceLast: 93, latePaceLast: 88, mudPct: 20 }),
    h("7",  "Discotheque",      6.0, "EP", [77, 83, 80],  44, 118, { primePower: 119.0, currentClass: 111.0, avgClassLast3: 110.4, earlyPaceLast: 91, latePaceLast: 83, mudPct: 12 }),
    h("4",  "Street Party",     5.0, "E",  [81, 81, 83],  60, 118, { primePower: 118.0, currentClass: 109.6, avgClassLast3: 110.1, earlyPaceLast: 87, latePaceLast: 81, mudPct: 17 }),
    h("6",  "Money Man",        8.0, "P",  [76, 84, 89],  87, 118, { primePower: 116.8, currentClass: 0,     avgClassLast3: 110.0, earlyPaceLast: 80, latePaceLast: 78, mudPct: 16 }),
    h("12", "Pelican Bay",     20.0, "S",  [72, 69, 73],  72, 118, { primePower: 115.2, currentClass: 109.4, avgClassLast3: 110.0, earlyPaceLast: 87, latePaceLast: 77, mudPct: 10 }),
    h("2",  "Blue Mountains",   8.0, "E",  [66, 69, 72],  38, 118, { primePower: 115.9, currentClass: 0,     avgClassLast3: 110.1, earlyPaceLast: 86, latePaceLast: 66, mudPct: 16 }),
    h("1",  "Dare Defying",    12.0, "P",  [62, 0,  72],  15, 118, { primePower: 110.8, currentClass: 106.5, avgClassLast3: 109.8, earlyPaceLast: 80, latePaceLast: 65 }),
    h("5",  "Stop the Nonsense",20.0,"S",  [53, 0,  0],   38, 118, { primePower: 104.6, currentClass: 0,     avgClassLast3: 106.3, earlyPaceLast: 0,  latePaceLast: 39 }),
    h("11", "Tremendously",     8.0, "P",  [39, 0,  75],  531, 118, { primePower: 103.6, currentClass: 0,    avgClassLast3: 106.3, earlyPaceLast: 75, latePaceLast: 21 }),
    h("1",  "Good Willie",     10.0, "P",  [0,  0,  0],   0,   118, { primePower: 109.9, currentClass: 0,     avgClassLast3: 107.9, earlyPaceLast: 82, latePaceLast: 66 }),
    h("10", "Syntagma",        15.0, "P",  [68, 0,  0],   65, 118, { primePower: 102.0, currentClass: 0,     avgClassLast3: 106.9, earlyPaceLast: 70, latePaceLast: 65 }),
    h("9",  "Road Trippin",    12.0, "S",  [0,  0,  77],  28, 118, { primePower: 78.0,  currentClass: 0,     avgClassLast3: 106.5, earlyPaceLast: 69, latePaceLast: 46 }),
  ],
};

// ── RACE 6 — ALW 120000n2L F 3yo 1 1/8m Turf $120K ──
// Post 3:40 PM. Turf routes. Week: Speed bias 56%, Rail +, E 0.62 / EP 2.21++ / P 0.69 / S 0.71.
// Posts 1-3 IV 1.28, 4-7 IV 0.64, 8+ IV 1.00.
const race6: StaticRace = {
  raceNumber: 6, postTime: "3:40 PM",
  raceType: "ALW 120000n2L", distance: "1 1/8m", surface: "Turf", purse: 120000, condition: "Firm",
  trackBias: {
    surface: "Turf", distanceLabel: "routes",
    speedBiasPct: 56, railBias: "+",
    eIV: 0.62, epIV: 2.21, pIV: 0.69, sIV: 0.71,
    post1to3IV: 1.28, post4to7IV: 0.64, post8plusIV: 1.00,
  },
  horses: [
    h("7",  "Surprise Ending", 3.5, "P",  [88, 88, 84],  77, 122, { primePower: 139.4, currentClass: 114.0, avgClassLast3: 113.9, earlyPaceLast: 89, latePaceLast: 94, mudPct: 15 }),
    h("4",  "Dagmara",         8.0, "EP", [84, 81, 87],  49, 122, { primePower: 136.1, currentClass: 112.9, avgClassLast3: 0,     earlyPaceLast: 86, latePaceLast: 88, mudPct: 20 }),
    h("3",  "Candy Rockette",  4.5, "P",  [81, 79, 71],  48, 122, { primePower: 132.2, currentClass: 0,     avgClassLast3: 113.2, earlyPaceLast: 83, latePaceLast: 84, mudPct: 16 }),
    h("8",  "Kentucky Belle",  1.6, "S",  [79, 65, 89],  42, 122, { primePower: 129.2, currentClass: 112.7, avgClassLast3: 111.5, earlyPaceLast: 73, latePaceLast: 82 }),
    h("10", "Temple Goddess", 30.0, "EP", [76, 0,  90],  28, 122, { primePower: 120.3, currentClass: 110.5, avgClassLast3: 112.3, earlyPaceLast: 72, latePaceLast: 78, mudPct: 11 }),
    h("5",  "Ring Rights",    12.0, "S",  [71, 0,  73],  48, 122, { primePower: 118.5, currentClass: 0,     avgClassLast3: 111.7, earlyPaceLast: 69, latePaceLast: 77, mudPct: 16 }),
    h("2",  "Classic Glide",  15.0, "P",  [74, 0,  65],  48, 122, { primePower: 109.3, currentClass: 0,     avgClassLast3: 112.3, earlyPaceLast: 69, latePaceLast: 81, mudPct: 18 }),
    h("8",  "Bless Her",       6.0, "P",  [84, 79, 85],  28, 122, { primePower: 126.6, currentClass: 110.5, avgClassLast3: 113.2, earlyPaceLast: 83, latePaceLast: 86, mudPct: 17 }),
    h("1",  "Bright Star",    30.0, "P",  [72, 0,  0],   0,   122, { primePower: 109.3, currentClass: 0,     avgClassLast3: 111.7, earlyPaceLast: 77, latePaceLast: 82, mudPct: 12 }),
    h("6",  "Unlimited Gold", 30.0, "EP", [72, 71, 67], 129, 122, { primePower: 114.7, currentClass: 0,     avgClassLast3: 109.6, earlyPaceLast: 68, latePaceLast: 77, mudPct: 20 }),
  ],
};

// ── RACE 7 — OC 80000n2x 6f Dirt $130K ──
// Post 4:12 PM. Dirt 6f. Week: Speed bias 100%, Rail +, E 0.92 / EP 2.64++ / P 0.00 / S 0.00.
// Posts 1-3 IV 1.32, 4-7 IV 1.32, 8+ IV 0.81. STRONG SPEED BIAS.
const race7: StaticRace = {
  raceNumber: 7, postTime: "4:12 PM",
  raceType: "OC 80000n2x", distance: "6f", surface: "Dirt", purse: 130000, condition: "Fast",
  trackBias: {
    surface: "Dirt", distanceLabel: "6.0f",
    speedBiasPct: 100, railBias: "+",
    eIV: 0.92, epIV: 2.64, pIV: 0.00, sIV: 0.00,
    post1to3IV: 1.32, post4to7IV: 1.32, post8plusIV: 0.81,
  },
  horses: [
    h("7", "Whatchatalkinabout", 2.1, "EP", [89, 100, 102], 168, 121, { primePower: 142.3, currentClass: 115.8, avgClassLast3: 118.3, earlyPaceLast: 104, latePaceLast: 92, mudPct: 12 }),
    h("4", "Keep It Easy",       6.0, "EP", [78, 93, 92],   45, 121, { primePower: 132.2, currentClass: 114.9, avgClassLast3: 116.3, earlyPaceLast: 78,  latePaceLast: 88, mudPct: 16 }),
    h("3", "Kalahari Dreams",    3.5, "P",  [92, 103, 94], 120, 121, { primePower: 133.0, currentClass: 111.2, avgClassLast3: 115.3, earlyPaceLast: 101, latePaceLast: 89, mudPct: 16 }),
    h("1", "Floodlites",         3.0, "EP", [98, 98, 96], 126, 121, { primePower: 130.0, currentClass: 0,     avgClassLast3: 115.1, earlyPaceLast: 97,  latePaceLast: 92, mudPct: 16 }),
    h("2", "Can Do Andrew",     12.0, "P",  [76, 93, 95], 239, 121, { primePower: 128.7, currentClass: 0,     avgClassLast3: 114.6, earlyPaceLast: 97,  latePaceLast: 74, mudPct: 16 }),
    h("5", "Politicallycorrect",15.0, "EP", [85, 96, 92],  64, 121, { primePower: 126.8, currentClass: 0,     avgClassLast3: 113.8, earlyPaceLast: 93,  latePaceLast: 81, mudPct: 14 }),
    h("6", "Modus Bestia",       6.0, "E",  [85, 93, 101], 62, 121, { primePower: 126.7, currentClass: 0,     avgClassLast3: 113.4, earlyPaceLast: 67,  latePaceLast: 66, mudPct: 19 }),
  ],
};

// ── RACE 8 — ALW 140000b 5.5f Turf $140K ──
// Post 4:44 PM. Turf 5.5f (same as R3 week bias).
const race8: StaticRace = {
  raceNumber: 8, postTime: "4:44 PM",
  raceType: "ALW 140000b", distance: "5.5f", surface: "Turf", purse: 140000, condition: "Firm",
  trackBias: {
    surface: "Turf", distanceLabel: "5.5f",
    speedBiasPct: 75, railBias: "+",
    eIV: 0.79, epIV: 1.87, pIV: 1.34, sIV: 0.00,
    post1to3IV: 0.00, post4to7IV: 0.68, post8plusIV: 1.41,
  },
  horses: [
    h("11", "Arrest Me Red",    3.0, "S",  [91, 99, 99],  42, 123, { primePower: 148.1, currentClass: 117.9, avgClassLast3: 117.8, earlyPaceLast: 101, latePaceLast: 96, mudPct: 15 }),
    h("3",  "Dhabab",           8.0, "S",  [81, 98, 92], 142, 123, { primePower: 146.0, currentClass: 115.8, avgClassLast3: 117.4, earlyPaceLast: 99,  latePaceLast: 91, mudPct: 11 }),
    h("2",  "Full Disclosure", 12.0, "EP", [91, 95, 95],  84, 123, { primePower: 145.8, currentClass: 115.5, avgClassLast3: 117.1, earlyPaceLast: 96,  latePaceLast: 90, mudPct: 18 }),
    h("4",  "Run Carson",      10.0, "EP", [89, 94, 99],  59, 123, { primePower: 145.7, currentClass: 115.3, avgClassLast3: 116.4, earlyPaceLast: 95,  latePaceLast: 90, mudPct: 11 }),
    h("7",  "Silent Heart",    10.0, "EP", [86, 82, 91], 322, 123, { primePower: 139.2, currentClass: 115.3, avgClassLast3: 116.3, earlyPaceLast: 82,  latePaceLast: 81 }),
    h("6",  "Works for Me",     4.0, "P",  [80, 85, 84],  63, 123, { primePower: 136.6, currentClass: 115.5, avgClassLast3: 116.0, earlyPaceLast: 84,  latePaceLast: 78, mudPct: 11 }),
    h("9",  "Seminole Chief", 15.0,  "EP", [82, 85, 85],  49, 123, { primePower: 128.6, currentClass: 0,     avgClassLast3: 115.7, earlyPaceLast: 83,  latePaceLast: 78, mudPct: 20 }),
    h("1",  "Troubleshooting",  6.0, "P",  [78, 78, 78], 147, 123, { primePower: 126.8, currentClass: 0,     avgClassLast3: 115.7, earlyPaceLast: 75,  latePaceLast: 65, mudPct: 20 }),
    h("10", "Runnin' Rocket", 20.0,  "EP", [68, 68, 73],  42, 123, { primePower: 117.7, currentClass: 0,     avgClassLast3: 114.6, earlyPaceLast: 68,  latePaceLast: 61, mudPct: 14 }),
    h("5",  "Coming in Hot",  30.0,  "P",  [68, 68, 87],  19, 123, { primePower: 112.1, currentClass: 0,     avgClassLast3: 112.1, earlyPaceLast: 61,  latePaceLast: 61, mudPct: 19 }),
    h("8",  "My Own",          9.4, "E",  [91, 85, 95],   37, 123, { primePower: 139.2, currentClass: 0,     avgClassLast3: 115.7, earlyPaceLast: 84,  latePaceLast: 90, mudPct: 9 }),
  ],
};

// ── RACE 9 — Ben Ali S. (G3) 1 1/8m Dirt $350K ──
// Post 5:16 PM. Dirt routes. Week: Speed bias 60%, Rail +, E 1.04 / EP 1.08 / P 0.82 / S 1.20+.
// Posts 1-3 IV 0.72, 4-7 IV 1.20, 8+ IV 2.62.
const race9: StaticRace = {
  raceNumber: 9, postTime: "5:16 PM",
  raceType: "STK G3", distance: "1 1/8m", surface: "Dirt", purse: 350000, condition: "Fast", name: "Ben Ali S. (G3)",
  trackBias: {
    surface: "Dirt", distanceLabel: "routes",
    speedBiasPct: 60, railBias: "+",
    eIV: 1.04, epIV: 1.08, pIV: 0.82, sIV: 1.20,
    post1to3IV: 0.72, post4to7IV: 1.20, post8plusIV: 2.62,
  },
  horses: [
    h("8", "Rattle N Roll",      3.0, "S",  [100, 97, 102], 63, 126, { primePower: 141.5, currentClass: 121.2, avgClassLast3: 120.2, earlyPaceLast: 95,  latePaceLast: 109, mudPct: 7 }),
    h("4", "Awesome Aaron",     15.0, "EP", [98, 98, 113],  21, 126, { primePower: 141.2, currentClass: 120.5, avgClassLast3: 119.7, earlyPaceLast: 95,  latePaceLast: 88, mudPct: 17 }),
    h("3", "Stars and Stripes",  4.0, "P",  [100, 88, 104], 41, 126, { primePower: 139.5, currentClass: 119.3, avgClassLast3: 119.6, earlyPaceLast: 93,  latePaceLast: 95, mudPct: 11 }),
    h("9", "Honor Marie",       10.0, "S",  [92, 89, 95],   28, 126, { primePower: 138.8, currentClass: 117.7, avgClassLast3: 119.0, earlyPaceLast: 83,  latePaceLast: 96, mudPct: 16 }),
    h("5", "San Siro",           8.0, "P",  [89, 98, 97],   28, 126, { primePower: 118.3, currentClass: 0,     avgClassLast3: 118.0, earlyPaceLast: 81,  latePaceLast: 87, mudPct: 12 }),
    h("1", "British Isles",      6.0, "EP", [92, 99, 93],   42, 126, { primePower: 138.5, currentClass: 0,     avgClassLast3: 118.0, earlyPaceLast: 89,  latePaceLast: 92, mudPct: 8 }),
    h("6", "Batten Down",        2.0, "P",  [82, 98, 96],   21, 126, { primePower: 134.7, currentClass: 0,     avgClassLast3: 115.8, earlyPaceLast: 81,  latePaceLast: 75, mudPct: 17 }),
    h("2", "Tennessee Lamb",    12.0, "EP", [82, 91, 94],   21, 126, { primePower: 127.1, currentClass: 0,     avgClassLast3: 115.8, earlyPaceLast: 41,  latePaceLast: 74, mudPct: 19 }),
    h("7", "Guns and Glory",    50.0, "P",  [0, 0, 41],     21, 126, { primePower: 122.2, currentClass: 0,     avgClassLast3: 112.5, earlyPaceLast: 0,   latePaceLast: 0, mudPct: 20 }),
  ],
};

// ── RACE 10 — VisitLEX Elkhorn S. (G2) 1 1/2m Turf $400K ──
// Post 5:48 PM. Turf routes (same as R6).
const race10: StaticRace = {
  raceNumber: 10, postTime: "5:48 PM",
  raceType: "STK G2", distance: "1 1/2m", surface: "Turf", purse: 400000, condition: "Firm", name: "Elkhorn S. (G2)",
  trackBias: {
    surface: "Turf", distanceLabel: "routes",
    speedBiasPct: 56, railBias: "+",
    eIV: 0.62, epIV: 2.21, pIV: 0.69, sIV: 0.71,
    post1to3IV: 1.28, post4to7IV: 0.64, post8plusIV: 1.00,
  },
  horses: [
    h("8",  "Tawny Port",       4.5, "S",  [99, 99, 99],  168, 126, { primePower: 160.3, currentClass: 119.9, avgClassLast3: 120.2, earlyPaceLast: 99,  latePaceLast: 98, mudPct: 15 }),
    h("9",  "Navy Seal",       15.0, "EP", [98, 101, 94], 167, 126, { primePower: 159.4, currentClass: 119.4, avgClassLast3: 119.5, earlyPaceLast: 97,  latePaceLast: 94, mudPct: 18 }),
    h("13", "Dancin in Da'nile",10.0, "P",  [97, 97, 104],  49, 126, { primePower: 154.8, currentClass: 118.7, avgClassLast3: 118.6, earlyPaceLast: 89,  latePaceLast: 94, mudPct: 15 }),
    h("4",  "Grand Sonata",     6.0, "EP", [96, 98, 89],  49, 126, { primePower: 151.6, currentClass: 118.1, avgClassLast3: 118.4, earlyPaceLast: 87,  latePaceLast: 88, mudPct: 10 }),
    h("3",  "Padiddle",        15.0, "S",  [94, 94, 83],  49, 126, { primePower: 151.0, currentClass: 117.7, avgClassLast3: 117.5, earlyPaceLast: 81,  latePaceLast: 86, mudPct: 10 }),
    h("5",  "Utah Beach",       8.0, "P",  [73, 101, 84],  28, 126, { primePower: 153.0, currentClass: 118.4, avgClassLast3: 118.0, earlyPaceLast: 87,  latePaceLast: 85, mudPct: 10 }),
    h("7",  "Truly Quality",    5.0, "EP", [99, 99, 87],  49, 126, { primePower: 159.4, currentClass: 119.9, avgClassLast3: 120.2, earlyPaceLast: 99,  latePaceLast: 98 }),
    h("1",  "Anegada",         15.0, "P",  [94, 96, 100], 49, 126, { primePower: 151.0, currentClass: 118.0, avgClassLast3: 117.9, earlyPaceLast: 80,  latePaceLast: 86 }),
    h("10", "Presider",        20.0, "EP", [92, 90, 80],  56, 126, { primePower: 151.6, currentClass: 115.5, avgClassLast3: 118.4, earlyPaceLast: 81,  latePaceLast: 85, mudPct: 12 }),
    h("6",  "Burnham Square",   4.0, "S",  [84, 84, 73],  49, 126, { primePower: 154.8, currentClass: 115.3, avgClassLast3: 118.6, earlyPaceLast: 84,  latePaceLast: 98, mudPct: 15 }),
    h("5",  "Fleetfoot",       12.0, "P",  [82, 82, 78], 167, 126, { primePower: 116.6, currentClass: 0,     avgClassLast3: 116.6, earlyPaceLast: 0,   latePaceLast: 72 }),
    h("11", "Freedom's Way",   20.0, "EP", [75, 75, 84], 269, 126, { primePower: 143.2, currentClass: 0,     avgClassLast3: 115.3, earlyPaceLast: 60,  latePaceLast: 77, mudPct: 11 }),
    h("2",  "Desvio",           8.0, "S",  [73, 73, 60], 167, 126, { primePower: 142.9, currentClass: 0,     avgClassLast3: 116.3, earlyPaceLast: 58,  latePaceLast: 60 }),
  ],
};

// ── RACE 11 — MSW F 3yo 7f Dirt $110K ──
// Post 6:20 PM. Dirt sprints. Week limited sample: Speed bias 100%, E 2.88 / EP 0.00.
// Posts 1-3 IV 0.00, 4-7 IV 1.75, 8+ IV 0.00.
const race11: StaticRace = {
  raceNumber: 11, postTime: "6:20 PM",
  raceType: "MSW", distance: "7f", surface: "Dirt", purse: 110000, condition: "Fast",
  trackBias: {
    surface: "Dirt", distanceLabel: "7.0f",
    speedBiasPct: 100, railBias: "+",
    eIV: 2.88, epIV: 0.00, pIV: 0.00, sIV: 0.00,
    post1to3IV: 0.00, post4to7IV: 1.75, post8plusIV: 0.00,
  },
  horses: [
    h("10", "Be the Light",          3.0, "S",  [81, 81, 80],  36, 120, { primePower: 121.6, currentClass: 112.3, avgClassLast3: 113.5, earlyPaceLast: 97,  latePaceLast: 84, mudPct: 20 }),
    h("3",  "Fast Gun",              6.0, "P",  [80, 77, 0],   36, 120, { primePower: 119.9, currentClass: 111.7, avgClassLast3: 112.9, earlyPaceLast: 93,  latePaceLast: 82 }),
    h("6",  "Army's Marauder",      10.0, "P",  [79, 75, 0],  23,  120, { primePower: 118.6, currentClass: 111.6, avgClassLast3: 112.3, earlyPaceLast: 89,  latePaceLast: 79, mudPct: 19 }),
    h("5",  "Miss Complicated",      5.0, "P",  [77, 75, 0],  34,  120, { primePower: 117.6, currentClass: 0,     avgClassLast3: 113.5, earlyPaceLast: 93,  latePaceLast: 90, mudPct: 15 }),
    h("4",  "Island Flower",         4.0, "S",  [74, 73, 0],   63, 120, { primePower: 112.4, currentClass: 0,     avgClassLast3: 110.6, earlyPaceLast: 75,  latePaceLast: 74 }),
    h("2",  "River Rise",           30.0, "E",  [72, 72, 54],  100, 120, { primePower: 110.9, currentClass: 0,    avgClassLast3: 110.3, earlyPaceLast: 72,  latePaceLast: 78, mudPct: 14 }),
    h("7",  "West of Lex",          12.0, "E",  [67, 72, 0],   28, 120, { primePower: 109.4, currentClass: 0,     avgClassLast3: 110.3, earlyPaceLast: 79,  latePaceLast: 76 }),
    h("8",  "Thesewallshaveears",   20.0, "S",  [72, 76, 0],   63, 120, { primePower: 109.5, currentClass: 0,     avgClassLast3: 109.5, earlyPaceLast: 0,   latePaceLast: 79, mudPct: 20 }),
    h("4",  "Full Dolly",           15.0, "S",  [67, 67, 0],  100, 120, { primePower: 108.8, currentClass: 0,     avgClassLast3: 110.8, earlyPaceLast: 77,  latePaceLast: 80, mudPct: 15 }),
    h("11", "Rhapsody in Blue",     10.0, "S",  [53, 0, 0],    87, 120, { primePower: 102.7, currentClass: 0,     avgClassLast3: 108.9, earlyPaceLast: 49,  latePaceLast: 76 }),
    h("1",  "She's Our Girl",       10.0, "P",  [0, 0, 0],     0,  120, { primePower: 0,     currentClass: 0,     avgClassLast3: 0,     earlyPaceLast: 0,   latePaceLast: 0, mudPct: 18 }),
    h("9",  "Govern",               10.0, "S",  [0, 0, 79],    29, 120, { primePower: 0,     currentClass: 0,     avgClassLast3: 0,     earlyPaceLast: 0,   latePaceLast: 0, mudPct: 19 }),
  ],
};

export const KEENELAND_APR18_2026: StaticRace[] = [
  race1, race2, race3, race4, race5, race6,
  race7, race8, race9, race10, race11,
];

export const KEE_APR18_DATE = "2026-04-18";

// Mark class drop using currentClass vs avgClassLast3 heuristic
for (const r of KEENELAND_APR18_2026) {
  for (const h of r.horses) {
    if (h.currentClass && h.avgClassLast3 && h.currentClass < h.avgClassLast3) {
      h.isClassDrop = true;
    }
  }
}
