// Churchill Downs — Sunday, April 26, 2026 ("Sunday Funday" — 2nd day of Spring Meet)
// Static card transcribed from Brisnet Race Summary PDF (productdownload 2.pdf)
// Data captured 2026-04-26 09:40 AM ET. First post 12:45 PM.
//
// Track-bias values use Brisnet WEEK totals where N>=5 races. For races with sparse
// week samples (R6 turf 5.5f N=1, R9 turf 8.5f N=1), Meet totals are used instead —
// noted inline.
//
// Apr 18 cortex-flagged risks addressed in transcription:
//  - Program numbers cross-checked against the PP-block left-margin headers, not the
//    ML-rank ordering of the Race Summary table
//  - Field sizes audited per race (R1=7, R2=11, R3=10, R4=8, R5=10, R6=8, R7=10, R8=9, R9=11)
//  - 0 used for unknown/maiden-first-start values per the keeneland-apr18 convention

import type { StaticRace, StaticHorse } from "./keeneland-apr18";

const h = (
  program: string, name: string, ml: number, style: string,
  beyers: number[], days: number, weight: number,
  extras: Partial<StaticHorse> = {},
): StaticHorse => ({
  program, name, mlOdds: ml, style,
  last3Beyer: beyers, daysSinceLast: days, weight,
  ...extras,
});

// ── R1 — ALW 50000s 1 1/16m Dirt $83K ──
// Post 12:45 PM. Dirt 8.5f. WEEK (N=8): Speed bias 63%, Rail +,
// E 1.81++ / EP 0.57 / P 0.77 / S 0.41. Posts 1-3 IV 1.74, 4-7 IV 0.55, 8+ IV 0.69.
const race1: StaticRace = {
  raceNumber: 1, postTime: "12:45 PM",
  raceType: "ALW 50000s", distance: "1 1/16m", surface: "Dirt", purse: 83000, condition: "Fast",
  trackBias: {
    surface: "Dirt", distanceLabel: "8.5f",
    speedBiasPct: 63, railBias: "+",
    eIV: 1.81, epIV: 0.57, pIV: 0.77, sIV: 0.41,
    post1to3IV: 1.74, post4to7IV: 0.55, post8plusIV: 0.69,
  },
  horses: [
    h("5", "Nogradi",            1.8, "P",  [87, 97, 90],  46, 118, { primePower: 132.6, currentClass: 115.1, avgClassLast3: 115.2, earlyPaceLast: 67, latePaceLast: 96, mudPct: 12 }),
    h("7", "Six String Prince",  8.0, "E",  [84, 85, 60],  23, 118, { primePower: 119.6, currentClass: 114.0, avgClassLast3: 112.1, earlyPaceLast: 95, latePaceLast: 80, mudPct: 17 }),
    h("2", "Bourbon Flight",     5.0, "EP", [82, 82, 75],  45, 118, { primePower: 121.0, currentClass: 112.2, avgClassLast3: 110.3, earlyPaceLast: 79, latePaceLast: 85, mudPct: 11 }),
    h("1", "C McGriff",          6.0, "EP", [82, 82, 75],  43, 118, { primePower: 120.3, currentClass: 112.9, avgClassLast3: 112.1, earlyPaceLast: 84, latePaceLast: 72, mudPct: 14 }),
    h("4", "Midway Munny",      10.0, "EP", [81, 76, 51],  30, 118, { primePower: 118.1, currentClass: 111.0, avgClassLast3: 109.0, earlyPaceLast: 71, latePaceLast: 94, mudPct: 17 }),
    h("3", "Different Gravy",    4.5, "E",  [83, 83, 66],  52, 118, { primePower: 120.1, currentClass: 111.4, avgClassLast3: 111.6, earlyPaceLast: 85, latePaceLast: 83, mudPct: 15 }),
    h("6", "Cant Stop Munnings", 3.5, "EP", [83, 66, 88],  86, 118, { primePower: 119.7, currentClass: 0,     avgClassLast3: 111.2, earlyPaceLast: 88, latePaceLast: 84, mudPct: 9 }),
  ],
};

// ── R2 — MSW 92K 4 1/2f Dirt 2yo Fillies $92K ──
// Post 1:14 PM. Dirt sprint. WEEK (N=28): Speed bias 66%, Rail +,
// E 1.20++ / EP 0.92 / P 1.23+ / S 0.57. Posts 1-3 IV 0.29, 4-7 IV 0.95, 8+ IV 1.52.
// MAIDEN race — most horses have NA across all stat columns (first start).
const race2: StaticRace = {
  raceNumber: 2, postTime: "1:14 PM",
  raceType: "MSW 92k", distance: "4 1/2f", surface: "Dirt", purse: 92000, condition: "Fast",
  trackBias: {
    surface: "Dirt", distanceLabel: "4.5f",
    speedBiasPct: 66, railBias: "+",
    eIV: 1.20, epIV: 0.92, pIV: 1.23, sIV: 0.57,
    post1to3IV: 0.29, post4to7IV: 0.95, post8plusIV: 1.52,
  },
  horses: [
    h("1",  "Respected Mind",      20.0, "E",  [73, 73, 0],  18, 119, { primePower: 117.3, currentClass: 113.1, avgClassLast3: 113.1, earlyPaceLast: 89,  latePaceLast: 76 }),
    h("11", "Angel Life",          30.0, "S",  [50, 50, 0],  18, 119, { primePower: 105.3, currentClass: 109.0, avgClassLast3: 109.0, earlyPaceLast: 81,  latePaceLast: 63 }),
    h("2",  "Storm Diva",           8.0, "P",  [0,  0,  0],   0, 119, { primePower: 0, currentClass: 0, avgClassLast3: 0, earlyPaceLast: 0, latePaceLast: 0 }),
    h("3",  "Rebelka",             20.0, "P",  [0,  0,  0],   0, 119, { primePower: 0, currentClass: 0, avgClassLast3: 0, earlyPaceLast: 0, latePaceLast: 0 }),
    h("4",  "Youhadme At Merlot", 12.0, "P",  [0,  0,  0],   0, 119, { primePower: 0, currentClass: 0, avgClassLast3: 0, earlyPaceLast: 0, latePaceLast: 0 }),
    h("5",  "Go New York Go",      4.5, "P",  [0,  0,  0],   0, 119, { primePower: 0, currentClass: 0, avgClassLast3: 0, earlyPaceLast: 0, latePaceLast: 0 }),
    h("6",  "Valkyrie",             5.0, "P",  [0,  0,  0],   0, 119, { primePower: 0, currentClass: 0, avgClassLast3: 0, earlyPaceLast: 0, latePaceLast: 0 }),
    h("7",  "Cardio Cat",           3.0, "P",  [0,  0,  0],   0, 119, { primePower: 0, currentClass: 0, avgClassLast3: 0, earlyPaceLast: 0, latePaceLast: 0 }),
    h("8",  "She's Toasty",         4.0, "P",  [0,  0,  0],   0, 119, { primePower: 0, currentClass: 0, avgClassLast3: 0, earlyPaceLast: 0, latePaceLast: 0 }),
    h("9",  "Lady Lux",             6.0, "P",  [0,  0,  0],   0, 119, { primePower: 0, currentClass: 0, avgClassLast3: 0, earlyPaceLast: 0, latePaceLast: 0 }),
    h("10", "Powerful Rose",       30.0, "P",  [0,  0,  0],   0, 119, { primePower: 0, currentClass: 0, avgClassLast3: 0, earlyPaceLast: 0, latePaceLast: 0 }),
  ],
};

// ── R3 — MCL 20000 6 1/2f Dirt F&M 3up $48K ──
// Post 1:43 PM. Dirt 6.5f. WEEK (N=6): Speed bias 83%, Rail +,
// E 1.53++ / EP 0.87 / P 1.10 / S 0.00. Posts 1-3 IV 0.00, 4-7 IV 1.19, 8+ IV 1.12.
const race3: StaticRace = {
  raceNumber: 3, postTime: "1:43 PM",
  raceType: "MCL 20000", distance: "6 1/2f", surface: "Dirt", purse: 48000, condition: "Fast",
  trackBias: {
    surface: "Dirt", distanceLabel: "6.5f",
    speedBiasPct: 83, railBias: "+",
    eIV: 1.53, epIV: 0.87, pIV: 1.10, sIV: 0.00,
    post1to3IV: 0.00, post4to7IV: 1.19, post8plusIV: 1.12,
  },
  horses: [
    h("8",  "Will Believe",         4.5, "S",  [51, 0,  0],  45, 124, { primePower: 114.8, currentClass: 109.5, avgClassLast3: 0,     earlyPaceLast: 100, latePaceLast: 91 }),
    h("10", "State Charmer",        3.0, "P",  [63, 66, 0],  15, 119, { primePower: 110.4, currentClass: 108.9, avgClassLast3: 109.7, earlyPaceLast: 86,  latePaceLast: 64 }),
    h("1",  "Juanita Mychiquita",   4.0, "EP", [68, 0,  0],  46, 119, { primePower: 109.8, currentClass: 0,     avgClassLast3: 109.5, earlyPaceLast: 0,   latePaceLast: 91, mudPct: 9 }),
    h("7",  "Gladly",               5.0, "S",  [63, 0,  0],  31, 119, { primePower: 110.7, currentClass: 107.8, avgClassLast3: 108.9, earlyPaceLast: 79,  latePaceLast: 72, mudPct: 11 }),
    h("2",  "Rocky World",         10.0, "E",  [58, 57, 0],  30, 119, { primePower: 105.8, currentClass: 105.8, avgClassLast3: 107.4, earlyPaceLast: 80,  latePaceLast: 74, mudPct: 11 }),
    h("6",  "Betty Hello",         15.0, "P",  [60, 53, 0],  19, 119, { primePower: 100.6, currentClass: 103.1, avgClassLast3: 105.7, earlyPaceLast: 72,  latePaceLast: 60, mudPct: 14 }),
    h("5",  "Baby Hello",          12.0, "S",  [44, 0,  0],  42, 119, { primePower: 95.3,  currentClass: 0,     avgClassLast3: 104.0, earlyPaceLast: 64,  latePaceLast: 38, mudPct: 12 }),
    h("3",  "Ladies Love Cash",    20.0, "P",  [0,  0,  0],   0, 119, { primePower: 0,     currentClass: 0,     avgClassLast3: 0,     earlyPaceLast: 0,   latePaceLast: 0 }),
    h("4",  "High Grace",          15.0, "P",  [65, 0,  0],  44, 119, { primePower: 109.8, currentClass: 0,     avgClassLast3: 105.5, earlyPaceLast: 80,  latePaceLast: 77 }),
    h("9",  "Flashy Aviator",       6.0, "P",  [0,  0,  0],   0, 119, { primePower: 0,     currentClass: 0,     avgClassLast3: 0,     earlyPaceLast: 0,   latePaceLast: 0 }),
  ],
};

// ── R4 — CLM 40000 7f Dirt 3yo $78K (S.20 Derby City-6) ──
// Post 2:14 PM. Dirt 7.0f. WEEK (N=8): Speed bias 63%, Rail +,
// E 1.24 / EP 0.87 / P 1.23 / S 0.55. Posts 1-3 IV 1.17, 4-7 IV 0.58, 8+ IV 1.50.
const race4: StaticRace = {
  raceNumber: 4, postTime: "2:14 PM",
  raceType: "CLM 40000", distance: "7f", surface: "Dirt", purse: 78000, condition: "Fast",
  trackBias: {
    surface: "Dirt", distanceLabel: "7.0f",
    speedBiasPct: 63, railBias: "+",
    eIV: 1.24, epIV: 0.87, pIV: 1.23, sIV: 0.55,
    post1to3IV: 1.17, post4to7IV: 0.58, post8plusIV: 1.50,
  },
  horses: [
    h("5", "Mischief Mania",   3.5, "EP", [87, 87, 83],  18, 122, { primePower: 122.8, currentClass: 113.2, avgClassLast3: 111.8, earlyPaceLast: 91, latePaceLast: 87, mudPct: 18 }),
    h("8", "Epic Summer",      1.6, "E",  [68, 78, 76],  28, 122, { primePower: 123.5, currentClass: 113.8, avgClassLast3: 112.1, earlyPaceLast: 88, latePaceLast: 76, mudPct: 22 }),
    h("2", "Versed",          15.0, "EP", [82, 70, 78],  18, 122, { primePower: 110.3, currentClass: 0,     avgClassLast3: 110.8, earlyPaceLast: 87, latePaceLast: 69 }),
    h("7", "Kid Twist",        4.5, "P",  [83, 78, 76],  29, 122, { primePower: 120.5, currentClass: 0,     avgClassLast3: 110.7, earlyPaceLast: 93, latePaceLast: 87, mudPct: 14 }),
    h("1", "Nuck Chorris",     3.0, "S",  [78, 76, 65],  29, 122, { primePower: 111.2, currentClass: 111.4, avgClassLast3: 111.2, earlyPaceLast: 81, latePaceLast: 84, mudPct: 14 }),
    h("6", "Sonic Surge",      8.0, "E",  [75, 82, 71],  35, 122, { primePower: 118.9, currentClass: 111.1, avgClassLast3: 110.7, earlyPaceLast: 85, latePaceLast: 80, mudPct: 19 }),
    h("3", "Coal Fired",      20.0, "E",  [70, 76, 70],  63, 122, { primePower: 116.8, currentClass: 110.8, avgClassLast3: 110.5, earlyPaceLast: 86, latePaceLast: 74 }),
    h("4", "Perfect Audible", 10.0, "EP", [66, 70, 66],  18, 122, { primePower: 117.7, currentClass: 0,     avgClassLast3: 108.0, earlyPaceLast: 99, latePaceLast: 49, mudPct: 15 }),
  ],
};

// ── R5 — MCL 12500 6f Dirt 3up $35K ──
// Post 2:47 PM. Dirt 6.0f. WEEK (N=13): Speed bias 57%, Rail +,
// E 0.88 / EP 1.03 / P 1.47+ / S 0.83. Posts 1-3 IV 0.00, 4-7 IV 0.80, 8+ IV 1.76.
const race5: StaticRace = {
  raceNumber: 5, postTime: "2:47 PM",
  raceType: "MCL 12500", distance: "6f", surface: "Dirt", purse: 35000, condition: "Fast",
  trackBias: {
    surface: "Dirt", distanceLabel: "6.0f",
    speedBiasPct: 57, railBias: "+",
    eIV: 0.88, epIV: 1.03, pIV: 1.47, sIV: 0.83,
    post1to3IV: 0.00, post4to7IV: 0.80, post8plusIV: 1.76,
  },
  horses: [
    h("3",  "Calling On Heaven", 1.4, "E",  [72, 79, 74], 37, 124, { primePower: 120.2, currentClass: 108.8, avgClassLast3: 108.6, earlyPaceLast: 102, latePaceLast: 80 }),
    h("8",  "Blazing",          15.0, "E",  [72, 65, 52], 109, 124,{ primePower: 110.8, currentClass: 105.7, avgClassLast3: 107.8, earlyPaceLast: 89, latePaceLast: 74 }),
    h("10", "Grab the Spark",    6.0, "P",  [71, 64, 0],  17, 124, { primePower: 110.4, currentClass: 107.5, avgClassLast3: 107.7, earlyPaceLast: 80, latePaceLast: 65 }),
    h("7",  "Impavido",          7.0, "E",  [74, 71, 64], 51, 124, { primePower: 109.8, currentClass: 106.5, avgClassLast3: 107.5, earlyPaceLast: 87, latePaceLast: 78 }),
    h("2",  "Richeztoo",         8.0, "E",  [61, 72, 60], 29, 124, { primePower: 109.3, currentClass: 105.8, avgClassLast3: 106.5, earlyPaceLast: 86, latePaceLast: 63 }),
    h("4",  "Cause Ima Boss",   30.0, "EP", [54, 60, 7],  18, 124, { primePower: 102.9, currentClass: 105.5, avgClassLast3: 105.7, earlyPaceLast: 78, latePaceLast: 67 }),
    h("9",  "Next Time",         4.5, "P",  [58, 62, 0],  15, 124, { primePower: 103.8, currentClass: 105.2, avgClassLast3: 105.9, earlyPaceLast: 67, latePaceLast: 60 }),
    h("5",  "Big Nelson",       30.0, "E",  [48, 58, 0],  38, 124, { primePower: 99.2,  currentClass: 103.3, avgClassLast3: 103.9, earlyPaceLast: 71, latePaceLast: 62 }),
    h("6",  "Orville's Map",    20.0, "E",  [54, 61, 0],  51, 124, { primePower: 102.9, currentClass: 103.9, avgClassLast3: 103.0, earlyPaceLast: 86, latePaceLast: 60 }),
    h("1",  "Dress Good",       30.0, "P",  [0,  0,  0],   0, 124, { primePower: 0,     currentClass: 0,     avgClassLast3: 0,     earlyPaceLast: 0,  latePaceLast: 0 }),
  ],
};

// ── R6 — OC 100000n3x 5 1/2f Turf 3up $141K ──
// Post 3:20 PM. Turf 5.5f. WEEK N=1 → use MEET totals (N=7):
// Speed bias 14%, Rail +, E 0.00 / EP 1.71+ / P 2.41++ / S 0.54.
// Posts 1-3 IV 0.00, 4-7 IV 0.85, 8+ IV 0.52. (Apr 18 cortex: clamp weekly with N<5 to avoid overfit.)
const race6: StaticRace = {
  raceNumber: 6, postTime: "3:20 PM",
  raceType: "OC 100000n3x", distance: "5 1/2f", surface: "Turf", purse: 141000, condition: "Firm",
  trackBias: {
    surface: "Turf", distanceLabel: "5.5f",
    speedBiasPct: 14, railBias: "+",
    eIV: 0.00, epIV: 1.71, pIV: 2.41, sIV: 0.54,
    post1to3IV: 0.00, post4to7IV: 0.85, post8plusIV: 0.52,
  },
  horses: [
    h("8", "Step Forward",      7.0, "EP", [82, 81, 82],  129, 124, { primePower: 129.9, currentClass: 116.5, avgClassLast3: 116.5, earlyPaceLast: 93, latePaceLast: 80, mudPct: 11 }),
    h("7", "Sine Qua Non",      8.0, "S",  [96, 89, 84],  178, 124, { primePower: 146.5, currentClass: 116.8, avgClassLast3: 116.5, earlyPaceLast: 99, latePaceLast: 98, mudPct: 11 }),
    h("3", "Run Curtis Run",    3.0, "S",  [88, 96, 80],  126, 124, { primePower: 137.4, currentClass: 0,     avgClassLast3: 116.0, earlyPaceLast: 96, latePaceLast: 87 }),
    h("1", "Golden Afternoon",  4.5, "EP", [87, 87, 87],  183, 124, { primePower: 138.2, currentClass: 0,     avgClassLast3: 115.4, earlyPaceLast: 97, latePaceLast: 89, mudPct: 12 }),
    h("5", "Alder",            15.0, "EP", [82, 85, 96],   67, 124, { primePower: 114.7, currentClass: 0,     avgClassLast3: 113.5, earlyPaceLast: 81, latePaceLast: 76, mudPct: 16 }),
    h("4", "Amoudi Bay",        5.0, "S",  [89, 86, 89],   23, 124, { primePower: 133.4, currentClass: 116.0, avgClassLast3: 116.0, earlyPaceLast: 94, latePaceLast: 84, mudPct: 15 }),
    h("2", "Autodrive",         4.0, "EP", [89, 96, 89],   44, 124, { primePower: 132.2, currentClass: 116.3, avgClassLast3: 113.4, earlyPaceLast: 89, latePaceLast: 87, mudPct: 12 }),
    h("6", "T Kraft",          10.0, "EP", [84, 94, 90],  275, 124, { primePower: 127.4, currentClass: 0,     avgClassLast3: 114.5, earlyPaceLast: 96, latePaceLast: 72, mudPct: 12 }),
  ],
};

// ── R7 — CLM 16000n2L 6f Dirt F&M 3up $36K ──
// Post 3:51 PM. Dirt 6.0f. WEEK (N=13): Speed bias 57%, Rail +,
// E 0.88 / EP 1.03 / P 1.47+ / S 0.83. Posts 1-3 IV 0.00, 4-7 IV 0.80, 8+ IV 1.76.
const race7: StaticRace = {
  raceNumber: 7, postTime: "3:51 PM",
  raceType: "CLM 16000n2L", distance: "6f", surface: "Dirt", purse: 36000, condition: "Fast",
  trackBias: {
    surface: "Dirt", distanceLabel: "6.0f",
    speedBiasPct: 57, railBias: "+",
    eIV: 0.88, epIV: 1.03, pIV: 1.47, sIV: 0.83,
    post1to3IV: 0.00, post4to7IV: 0.80, post8plusIV: 1.76,
  },
  horses: [
    h("4",  "Sweet Bebsi",        1.6, "S",  [75, 81, 73],  39, 120, { primePower: 115.3, currentClass: 110.9, avgClassLast3: 110.5, earlyPaceLast: 90, latePaceLast: 87, mudPct: 16 }),
    h("2",  "I'm a Cookie Lover", 3.5, "EP", [73, 79, 71],  37, 120, { primePower: 110.8, currentClass: 110.6, avgClassLast3: 109.4, earlyPaceLast: 89, latePaceLast: 85 }),
    h("10", "Waffle House Gang",  6.0, "P",  [68, 71, 67], 325, 120, { primePower: 110.0, currentClass: 109.9, avgClassLast3: 108.9, earlyPaceLast: 76, latePaceLast: 84, mudPct: 20 }),
    h("3",  "Ride the Broom",     7.0, "EP", [71, 73, 70],  17, 120, { primePower: 108.8, currentClass: 110.6, avgClassLast3: 109.6, earlyPaceLast: 85, latePaceLast: 75 }),
    h("9",  "Loving Mischief",    4.5, "P",  [67, 65, 0],   12, 120, { primePower: 107.6, currentClass: 109.4, avgClassLast3: 108.2, earlyPaceLast: 81, latePaceLast: 69 }),
    h("1",  "Mamarsha",          15.0, "P",  [71, 77, 70],  46, 120, { primePower: 106.4, currentClass: 109.6, avgClassLast3: 107.6, earlyPaceLast: 82, latePaceLast: 72 }),
    h("5",  "Zafyre",            30.0, "P",  [65, 67, 0],   17, 120, { primePower: 103.9, currentClass: 108.2, avgClassLast3: 107.1, earlyPaceLast: 67, latePaceLast: 66 }),
    h("8",  "Mo Indian Lady",    12.0, "S",  [62, 65, 67],  37, 120, { primePower: 105.4, currentClass: 107.0, avgClassLast3: 106.4, earlyPaceLast: 65, latePaceLast: 59, mudPct: 28 }),
    h("6",  "B D's Angel",       20.0, "EP", [55, 56, 66],  57, 120, { primePower: 99.6,  currentClass: 105.8, avgClassLast3: 99.9,  earlyPaceLast: 64, latePaceLast: 67 }),
    h("7",  "Sound the Siren",   20.0, "E",  [57, 65, 0],  295, 120, { primePower: 96.6,  currentClass: 0,     avgClassLast3: 105.3, earlyPaceLast: 47, latePaceLast: 63 }),
  ],
};

// ── R8 — MSW 92K-120K 1 1/4m Dirt 3up $120K (Matchup race 1; 8 vs 2; 9) ──
// Post 4:24 PM. Dirt routes. WEEK (N=19): Speed bias 68%, Rail +,
// E 1.43++ / EP 1.34++ / P 0.41 / S 0.70. Posts 1-3 IV 1.27, 4-7 IV 0.34, 8+ IV 0.93.
const race8: StaticRace = {
  raceNumber: 8, postTime: "4:24 PM",
  raceType: "MSW 92k", distance: "1 1/4m", surface: "Dirt", purse: 120000, condition: "Fast",
  trackBias: {
    surface: "Dirt", distanceLabel: "10.0f",
    speedBiasPct: 68, railBias: "+",
    eIV: 1.43, epIV: 1.34, pIV: 0.41, sIV: 0.70,
    post1to3IV: 1.27, post4to7IV: 0.34, post8plusIV: 0.93,
  },
  horses: [
    h("9", "Silver Shot",      6.0, "S",  [69, 0,  0],  29, 124, { primePower: 127.7, currentClass: 0, avgClassLast3: 113.2, earlyPaceLast: 90, latePaceLast: 106, mudPct: 9 }),
    h("1", "King of Heat",     6.0, "S",  [83, 0,  0],  50, 124, { primePower: 122.9, currentClass: 0, avgClassLast3: 112.5, earlyPaceLast: 83, latePaceLast: 95 }),
    h("2", "Stompin Grapes",   1.8, "S",  [78, 0,  0],  37, 124, { primePower: 122.3, currentClass: 0, avgClassLast3: 112.4, earlyPaceLast: 78, latePaceLast: 89, mudPct: 8 }),
    h("3", "Tiernanogue",      3.5, "P",  [86, 0,  0],  36, 124, { primePower: 122.2, currentClass: 0, avgClassLast3: 111.4, earlyPaceLast: 79, latePaceLast: 94, mudPct: 13 }),
    h("4", "Still Sober",     20.0, "EP", [60, 0,  0],  15, 124, { primePower: 115.6, currentClass: 0, avgClassLast3: 110.7, earlyPaceLast: 78, latePaceLast: 89 }),
    h("5", "In America",      30.0, "P",  [74, 0,  0],  23, 124, { primePower: 110.9, currentClass: 0, avgClassLast3: 109.9, earlyPaceLast: 72, latePaceLast: 77 }),
    h("6", "Sartorial",        8.0, "P",  [71, 0,  0],  56, 124, { primePower: 115.2, currentClass: 0, avgClassLast3: 110.4, earlyPaceLast: 69, latePaceLast: 86 }),
    h("7", "Prayer",          20.0, "P",  [88, 0,  0],  32, 124, { primePower: 114.9, currentClass: 0, avgClassLast3: 109.1, earlyPaceLast: 67, latePaceLast: 59 }),
    h("8", "Direct Strike",    9.0, "P",  [77, 0,  0],  36, 124, { primePower: 110.9, currentClass: 0, avgClassLast3: 107.6, earlyPaceLast: 64, latePaceLast: 74 }),
  ],
};

// ── R9 — ALW 127000n1x 1 1/16m Turf F&M 3up $127K ──
// Post 4:56 PM. Turf 8.5f. WEEK N=1 → MEET totals (N=12): Speed bias 42%, Rail +,
// E 0.87 / EP 1.20+ / P 1.18++ / S 0.74. Posts 1-3 IV 0.80, 4-7 IV 1.66+, 8+ IV 0.87.
const race9: StaticRace = {
  raceNumber: 9, postTime: "4:56 PM",
  raceType: "ALW 127000n1x", distance: "1 1/16m", surface: "Turf", purse: 127000, condition: "Firm",
  trackBias: {
    surface: "Turf", distanceLabel: "8.5f",
    speedBiasPct: 42, railBias: "+",
    eIV: 0.87, epIV: 1.20, pIV: 1.18, sIV: 0.74,
    post1to3IV: 0.80, post4to7IV: 1.66, post8plusIV: 0.87,
  },
  horses: [
    h("10", "Totally Justified", 6.0, "EP", [86, 87, 87],  119, 120, { primePower: 138.0, currentClass: 114.8, avgClassLast3: 114.8, earlyPaceLast: 91,  latePaceLast: 81, mudPct: 10 }),
    h("2",  "Faithful Departed", 5.0, "P",  [88, 88, 84],   22, 120, { primePower: 132.8, currentClass: 114.0, avgClassLast3: 114.0, earlyPaceLast: 100, latePaceLast: 94 }),
    h("4",  "Olivia Valentina", 10.0, "P",  [85, 87, 80],   29, 120, { primePower: 128.6, currentClass: 113.6, avgClassLast3: 113.6, earlyPaceLast: 80,  latePaceLast: 83 }),
    h("3",  "Brilliantly",       3.0, "E",  [86, 89, 95],   92, 120, { primePower: 126.1, currentClass: 0,     avgClassLast3: 111.8, earlyPaceLast: 77,  latePaceLast: 56 }),
    h("1",  "Midway Memories",   4.0, "S",  [81, 79, 78],   29, 120, { primePower: 138.5, currentClass: 113.6, avgClassLast3: 113.6, earlyPaceLast: 88,  latePaceLast: 92 }),
    h("5",  "Snipsnippitysnip",  9.5, "EP", [83, 82, 80],   35, 120, { primePower: 123.3, currentClass: 112.2, avgClassLast3: 112.2, earlyPaceLast: 91,  latePaceLast: 79 }),
    h("9",  "Humbled",          12.0, "P",  [72, 78, 89],   36, 120, { primePower: 116.1, currentClass: 113.8, avgClassLast3: 113.0, earlyPaceLast: 92,  latePaceLast: 88 }),
    h("6",  "Red Beretta",      50.0, "EP", [87, 95, 97],   17, 120, { primePower: 114.5, currentClass: 0,     avgClassLast3: 110.0, earlyPaceLast: 74,  latePaceLast: 64 }),
    h("8",  "Salty Senorita",   20.0, "P",  [75, 74, 0],   113, 120, { primePower: 118.4, currentClass: 0,     avgClassLast3: 111.8, earlyPaceLast: 75,  latePaceLast: 75, mudPct: 11 }),
    h("11", "French Mistress",  30.0, "P",  [72, 72, 75],  113, 120, { primePower: 109.7, currentClass: 0,     avgClassLast3: 112.9, earlyPaceLast: 74,  latePaceLast: 72 }),
    h("7",  "Plaza Athenee",     8.0, "P",  [0,  0,  0],   256, 120, { primePower: 0,     currentClass: 0,     avgClassLast3: 0,     earlyPaceLast: 0,   latePaceLast: 0 }),
  ],
};

export const CD_APR26_2026: StaticRace[] = [
  race1, race2, race3, race4, race5,
  race6, race7, race8, race9,
];

export const CD_APR26_DATE = "2026-04-26";

// Mark class drop using currentClass vs avgClassLast3 heuristic
for (const r of CD_APR26_2026) {
  for (const h of r.horses) {
    if (h.currentClass && h.avgClassLast3 && h.currentClass < h.avgClassLast3) {
      h.isClassDrop = true;
    }
  }
}
