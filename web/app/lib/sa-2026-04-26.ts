// Santa Anita Park — Sunday, April 26, 2026
// First post 4:00 PT (7:00 PM ET). Static card from Brisnet Ultimate PPs PDF.
//
// LESSONS FROM CD APR 26 (applied here):
//  - Program numbers cross-validated against the "Index of Horses" page of the
//    Brisnet PDF AND the per-horse PP block left-margin headers (e.g. "1 ▍Humidity").
//    The Race Summary "#" column was the source of the R3/R5/R7 mismaps at CD.
//  - Track bias blended 50/50 MEET+WEEK when WEEK sample size < 15 races
//    (most SA races have N=1-7 week samples → WEEK alone over-fits).
//  - False-favorite penalty applied at scoring time (bet-sheet.ts), not here.

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

// ── R1 — Mdn 65k 1 Mile (T) 3yo Fillies ──
// Post 4:00 PT. Turf 8.0f. WEEK N=3 → 50/50 blend MEET+WEEK.
// MEET: SB 57%, E 1.01 / EP 1.33+ / P 0.86 / S 0.76, posts 1.15 / 0.83 / 1.13
// WEEK: SB 33%, E 0.00 / EP 1.57 / P 1.72++ / S 0.99, posts 0.00 / 1.83 / 0.00
const race1: StaticRace = {
  raceNumber: 1, postTime: "4:00 PT",
  raceType: "Mdn 65k", distance: "1m", surface: "Turf", purse: 65000, condition: "Firm",
  trackBias: {
    surface: "Turf", distanceLabel: "8.0f",
    speedBiasPct: 45, railBias: "+",
    eIV: 0.51, epIV: 1.45, pIV: 1.29, sIV: 0.88,
    post1to3IV: 0.58, post4to7IV: 1.33, post8plusIV: 0.57,
  },
  horses: [
    h("2", "Maggies McGee",      1.6, "P",  [76, 80, 83],  35, 122, { primePower: 134.1, currentClass: 114.0, avgClassLast3: 113.8, earlyPaceLast: 87, latePaceLast: 78 }),
    h("4", "Taking a Joy Ride",  2.0, "E",  [82, 0, 0],    21, 122, { primePower: 122.1, currentClass: 109.1, avgClassLast3: 114.9, earlyPaceLast: 81, latePaceLast: 95 }),
    h("5", "Tate Batz",          3.5, "E",  [65, 70, 66],  21, 122, { primePower: 116.1, currentClass: 110.7, avgClassLast3: 111.5, earlyPaceLast: 77, latePaceLast: 79 }),
    h("1", "Humidity",           5.0, "E",  [70, 65, 70],  35, 122, { primePower: 113.4, currentClass: 111.5, avgClassLast3: 111.1, earlyPaceLast: 83, latePaceLast: 0 }),
    h("3", "Kool Mariah",       10.0, "E",  [75, 70, 73],  21, 122, { primePower: 114.0, currentClass: 110.9, avgClassLast3: 111.7, earlyPaceLast: 78, latePaceLast: 89 }),
    h("6", "Little Gator",      30.0, "P",  [67, 0, 0],    8,  122, { primePower: 107.5, currentClass: 0,     avgClassLast3: 109.1, earlyPaceLast: 72, latePaceLast: 77 }),
    h("7", "Big Miss",          20.0, "S",  [64, 60, 42],  42, 122, { primePower: 93.1,  currentClass: 0,     avgClassLast3: 107.9, earlyPaceLast: 0,  latePaceLast: 83 }),
  ],
};

// ── R2 — Clm 10000n3L 5 1/2f Dirt 3up ──
// Post 4:30 PT. Dirt 5.5f. WEEK N=1 → use MEET totals (N=35).
// MEET: SB 83%, E 1.71++ / EP 0.86 / P 0.67 / S 0.26, posts 1.27 / 0.81 / 0.76
const race2: StaticRace = {
  raceNumber: 2, postTime: "4:30 PT",
  raceType: "Clm 10000n3L", distance: "5 1/2f", surface: "Dirt", purse: 20000, condition: "Fast",
  trackBias: {
    surface: "Dirt", distanceLabel: "5.5f",
    speedBiasPct: 83, railBias: "+",
    eIV: 1.71, epIV: 0.86, pIV: 0.67, sIV: 0.26,
    post1to3IV: 1.27, post4to7IV: 0.81, post8plusIV: 0.76,
  },
  horses: [
    h("2", "Y'all Come",          1.2, "P",  [85, 84, 80],  30, 126, { primePower: 117.6, currentClass: 110.9, avgClassLast3: 110.9, earlyPaceLast: 89, latePaceLast: 90 }),
    h("3", "No More Ding Dongs",  1.4, "E",  [77, 80, 67],  30, 121, { primePower: 116.4, currentClass: 111.1, avgClassLast3: 110.9, earlyPaceLast: 88, latePaceLast: 80 }),
    h("4", "Shady Appeal",       10.0, "E",  [69, 80, 67],  218, 126,{ primePower: 109.8, currentClass: 110.2, avgClassLast3: 109.8, earlyPaceLast: 80, latePaceLast: 83 }),
    h("5", "Three Georges",       4.0, "EP", [71, 76, 73],  21, 126, { primePower: 112.1, currentClass: 109.8, avgClassLast3: 110.3, earlyPaceLast: 78, latePaceLast: 67 }),
    h("1", "Bid On the Prize",    8.0, "S",  [84, 0, 0],    14, 126, { primePower: 107.4, currentClass: 109.0, avgClassLast3: 109.2, earlyPaceLast: 84, latePaceLast: 0 }),
  ],
};

// ── R3 — Alw 50000s 1 Mile (T) 3up ──
// Post 5:02 PT. Turf 8.0f. WEEK N=3 → 50/50 blend.
const race3: StaticRace = {
  raceNumber: 3, postTime: "5:02 PT",
  raceType: "Alw 50000s", distance: "1m", surface: "Turf", purse: 36000, condition: "Firm",
  trackBias: {
    surface: "Turf", distanceLabel: "8.0f",
    speedBiasPct: 45, railBias: "+",
    eIV: 0.51, epIV: 1.45, pIV: 1.29, sIV: 0.88,
    post1to3IV: 0.58, post4to7IV: 1.33, post8plusIV: 0.57,
  },
  horses: [
    h("9", "Living Life",        5.0, "S",  [97, 92, 91],  36, 126, { primePower: 137.6, currentClass: 0,     avgClassLast3: 114.8, earlyPaceLast: 100, latePaceLast: 95 }),
    h("2", "Burning Rubber",     3.0, "EP", [86, 89, 87],  64, 126, { primePower: 135.7, currentClass: 114.9, avgClassLast3: 114.7, earlyPaceLast: 91, latePaceLast: 87 }),
    h("5", "Mysterious Husband", 4.0, "P",  [86, 88, 88],  56, 126, { primePower: 134.3, currentClass: 113.3, avgClassLast3: 113.2, earlyPaceLast: 84, latePaceLast: 78 }),
    h("3", "Empire's Classic",  10.0, "S",  [89, 89, 86],  30, 126, { primePower: 122.0, currentClass: 113.7, avgClassLast3: 114.2, earlyPaceLast: 79, latePaceLast: 82 }),
    h("8", "I'm Otter Here",     6.0, "EP", [86, 80, 75],  30, 126, { primePower: 129.6, currentClass: 113.3, avgClassLast3: 113.5, earlyPaceLast: 83, latePaceLast: 85 }),
    h("1", "Poor Connection",   10.0, "EP", [85, 80, 76],  28, 126, { primePower: 125.5, currentClass: 112.6, avgClassLast3: 113.1, earlyPaceLast: 85, latePaceLast: 80 }),
    h("6", "Prince Dolce",       8.0, "S",  [72, 75, 91],  28, 126, { primePower: 128.2, currentClass: 113.2, avgClassLast3: 112.7, earlyPaceLast: 88, latePaceLast: 79 }),
    h("7", "American Glory",     8.0, "EP", [79, 92, 78],  21, 126, { primePower: 112.3, currentClass: 0,     avgClassLast3: 112.5, earlyPaceLast: 79, latePaceLast: 83 }),
    h("4", "Santa Barbarian",    8.0, "EP", [69, 74, 75],  315, 126,{ primePower: 120.9, currentClass: 0,     avgClassLast3: 113.3, earlyPaceLast: 78, latePaceLast: 24 }),
  ],
};

// ── R4 — MC 20000 1 Mile Dirt 3yo+ ──
// Post 5:33 PT. Dirt 8.0f. WEEK N=7 → blend.
// MEET: SB 94%, E 1.73++ / EP 1.20 / P 0.45 / S 0.18, posts 1.08 / 0.91 / 0.92
// WEEK: SB 86%, E 1.21 / EP 0.83 / P 1.59 / S 0.00, posts 1.18 / 0.59 / 4.00
const race4: StaticRace = {
  raceNumber: 4, postTime: "5:33 PT",
  raceType: "MC 20000", distance: "1m", surface: "Dirt", purse: 21000, condition: "Fast",
  trackBias: {
    surface: "Dirt", distanceLabel: "8.0f",
    speedBiasPct: 90, railBias: "+",
    eIV: 1.47, epIV: 1.02, pIV: 1.02, sIV: 0.09,
    post1to3IV: 1.13, post4to7IV: 0.75, post8plusIV: 2.46,
  },
  horses: [
    h("6", "Imagineer",      2.5, "EP", [80, 75, 76],  37, 126, { primePower: 116.7, currentClass: 0,     avgClassLast3: 110.4, earlyPaceLast: 91, latePaceLast: 87 }),
    h("3", "Saturday",       4.0, "E",  [76, 72, 68],  23, 126, { primePower: 115.8, currentClass: 110.6, avgClassLast3: 110.3, earlyPaceLast: 91, latePaceLast: 76 }),
    h("7", "Desert Hawk",    6.0, "S",  [72, 64, 87],  35, 119, { primePower: 112.6, currentClass: 0,     avgClassLast3: 109.4, earlyPaceLast: 75, latePaceLast: 74 }),
    h("1", "Silver Ice",    20.0, "E",  [67, 64, 0],   23, 126, { primePower: 103.9, currentClass: 0,     avgClassLast3: 106.9, earlyPaceLast: 81, latePaceLast: 72 }),
    h("4", "I'malwaysthirsty",15.0,"S", [71, 70, 0],   37, 119, { primePower: 108.1, currentClass: 0,     avgClassLast3: 109.4, earlyPaceLast: 80, latePaceLast: 0 }),
    h("2", "Knowhere",       3.0, "E",  [65, 0, 0],    24, 119, { primePower: 115.8, currentClass: 110.3, avgClassLast3: 109.8, earlyPaceLast: 0,  latePaceLast: 0 }),
    h("5", "Fight Back",     2.5, "S",  [74, 81, 79],  23, 126, { primePower: 116.7, currentClass: 0,     avgClassLast3: 110.4, earlyPaceLast: 91, latePaceLast: 87 }),
  ],
};

// ── R5 — Mdn 65k 6f (T) 3up ──
// Post 6:03 PT. Turf 6.0f. WEEK N=4 → 50/50 blend.
// MEET: SB 56%, E 0.79 / EP 1.24+ / P 1.39 / S 0.75, posts 1.14 / 0.92 / 0.87
// WEEK: SB 25%, E 0.00 / EP 0.95 / P 3.19++ / S 0.59, posts 1.83 / 0.00 / 1.76
const race5: StaticRace = {
  raceNumber: 5, postTime: "6:03 PT",
  raceType: "Mdn 65k", distance: "6f", surface: "Turf", purse: 65000, condition: "Firm",
  trackBias: {
    surface: "Turf", distanceLabel: "6.0f",
    speedBiasPct: 40, railBias: "+",
    eIV: 0.40, epIV: 1.10, pIV: 2.29, sIV: 0.67,
    post1to3IV: 1.49, post4to7IV: 0.46, post8plusIV: 1.32,
  },
  horses: [
    h("6", "Little Raymond",      5.0, "S",  [84, 84, 56],  57, 120, { primePower: 119.7, currentClass: 110.5, avgClassLast3: 109.9, earlyPaceLast: 96, latePaceLast: 81 }),
    h("1", "Sagunto",             3.5, "E",  [80, 74, 0],   210,120, { primePower: 112.1, currentClass: 111.3, avgClassLast3: 111.7, earlyPaceLast: 89, latePaceLast: 80 }),
    h("2", "Jimmy Winkfield",     2.0, "S",  [76, 0, 0],    29, 126, { primePower: 123.9, currentClass: 0,     avgClassLast3: 0,     earlyPaceLast: 0,  latePaceLast: 81 }),
    h("5", "Debbies Gettinghot", 15.0, "EP", [75, 73, 70],  37, 120, { primePower: 102.4, currentClass: 110.5, avgClassLast3: 109.1, earlyPaceLast: 89, latePaceLast: 78 }),
    h("11","Throwin Heat",       30.0, "S",  [67, 67, 0],   35, 126, { primePower: 105.3, currentClass: 0,     avgClassLast3: 108.4, earlyPaceLast: 73, latePaceLast: 73 }),
    h("7", "Royal Rumor",         8.0, "S",  [66, 0, 0],    0,  126, { primePower: 113.8, currentClass: 0,     avgClassLast3: 0,     earlyPaceLast: 72, latePaceLast: 66 }),
    h("3", "Van Gogh Style",      8.0, "S",  [0, 0, 0],     0,  120, { primePower: 0, currentClass: 0, avgClassLast3: 0 }),
    h("4", "Bello Rosso",        10.0, "S",  [0, 0, 0],     0,  120, { primePower: 0, currentClass: 0, avgClassLast3: 0 }),
    h("8", "Johnlino",           30.0, "S",  [0, 0, 0],     0,  120, { primePower: 0, currentClass: 0, avgClassLast3: 0 }),
    h("9", "Francesconi",        30.0, "S",  [0, 0, 0],     0,  115, { primePower: 0, currentClass: 0, avgClassLast3: 0 }),
    h("10","Sunset Ride",        12.0, "E",  [70, 0, 0],    24, 120, { primePower: 111.5, currentClass: 0,     avgClassLast3: 102.4, earlyPaceLast: 80, latePaceLast: 70 }),
  ],
};

// ── R6 — Clm 32000 6f Dirt 3yo Fillies ──
// Post 6:33 PT. Dirt 6.0f. WEEK N=2 → use MEET (N=73).
// MEET: SB 85%, E 1.52++ / EP 1.02 / P 0.60 / S 0.62, posts 0.81 / 1.05 / 2.12
const race6: StaticRace = {
  raceNumber: 6, postTime: "6:33 PT",
  raceType: "Clm 32000", distance: "6f", surface: "Dirt", purse: 37000, condition: "Fast",
  trackBias: {
    surface: "Dirt", distanceLabel: "6.0f",
    speedBiasPct: 85, railBias: "+",
    eIV: 1.52, epIV: 1.02, pIV: 0.60, sIV: 0.62,
    post1to3IV: 0.81, post4to7IV: 1.05, post8plusIV: 2.12,
  },
  horses: [
    h("4", "Flamingo Star",       2.5, "E",  [87, 80, 76],  29, 122, { primePower: 120.0, currentClass: 112.8, avgClassLast3: 113.7, earlyPaceLast: 102, latePaceLast: 80 }),
    h("6", "My Kat",              1.5, "E",  [69, 73, 74],  29, 120, { primePower: 120.7, currentClass: 111.7, avgClassLast3: 112.9, earlyPaceLast: 94, latePaceLast: 79 }),
    h("3", "Donde Esta Jefe",     8.0, "S",  [77, 77, 67],  30, 120, { primePower: 115.3, currentClass: 110.4, avgClassLast3: 112.0, earlyPaceLast: 87, latePaceLast: 77 }),
    h("8", "Stardialed",          6.0, "E",  [82, 70, 71],  7,  120, { primePower: 116.6, currentClass: 110.7, avgClassLast3: 110.3, earlyPaceLast: 92, latePaceLast: 72 }),
    h("2", "Bobs Honey",          3.0, "EP", [73, 67, 65],  29, 120, { primePower: 112.1, currentClass: 112.0, avgClassLast3: 111.0, earlyPaceLast: 88, latePaceLast: 70 }),
    h("1", "Love Lock",          30.0, "E",  [70, 67, 65],  42, 120, { primePower: 105.8, currentClass: 109.3, avgClassLast3: 110.7, earlyPaceLast: 84, latePaceLast: 72 }),
    h("7", "Little Tinker Elle", 20.0, "E",  [67, 67, 0],   46, 120, { primePower: 110.0, currentClass: 110.5, avgClassLast3: 110.4, earlyPaceLast: 88, latePaceLast: 0 }),
    h("5", "Bear's Board",        4.0, "E",  [65, 0, 0],    22, 120, { primePower: 122.3, currentClass: 113.0, avgClassLast3: 113.3, earlyPaceLast: 84, latePaceLast: 75 }),
  ],
};

// ── R7 — OC 20000n1x 6f (T) 3up F&M ──
// Post 7:03 PT. Turf 6.0f. WEEK N=4 → 50/50 blend (same as R5).
const race7: StaticRace = {
  raceNumber: 7, postTime: "7:03 PT",
  raceType: "OC 20000n1x", distance: "6f", surface: "Turf", purse: 67000, condition: "Firm",
  trackBias: {
    surface: "Turf", distanceLabel: "6.0f",
    speedBiasPct: 40, railBias: "+",
    eIV: 0.40, epIV: 1.10, pIV: 2.29, sIV: 0.67,
    post1to3IV: 1.49, post4to7IV: 0.46, post8plusIV: 1.32,
  },
  horses: [
    h("2", "Goodnight Nellie",   5.0, "EP", [89, 86, 86],  35, 126, { primePower: 129.7, currentClass: 116.0, avgClassLast3: 115.4, earlyPaceLast: 101, latePaceLast: 94 }),
    h("11","Christel Clean",     3.0, "EP", [86, 87, 86],  63, 126, { primePower: 135.1, currentClass: 115.7, avgClassLast3: 115.3, earlyPaceLast: 99, latePaceLast: 89 }),
    h("4", "Petite Treat",      30.0, "P",  [82, 73, 76],  44, 124, { primePower: 119.4, currentClass: 115.2, avgClassLast3: 114.8, earlyPaceLast: 98, latePaceLast: 89 }),
    h("12","Troisieme Etoile",   4.0, "S",  [89, 88, 86],  30, 119, { primePower: 136.9, currentClass: 0,     avgClassLast3: 114.8, earlyPaceLast: 92, latePaceLast: 81 }),
    h("1", "Tiger of the Sea",   8.0, "EP", [82, 81, 81],  28, 124, { primePower: 130.8, currentClass: 115.0, avgClassLast3: 114.5, earlyPaceLast: 84, latePaceLast: 82 }),
    h("5", "Clubhouse Cutie",   12.0, "EP", [82, 81, 73],  28, 126, { primePower: 125.3, currentClass: 113.0, avgClassLast3: 114.0, earlyPaceLast: 90, latePaceLast: 84 }),
    h("7", "Idessia",            9.5, "P",  [82, 84, 80],  51, 126, { primePower: 131.0, currentClass: 113.0, avgClassLast3: 114.2, earlyPaceLast: 78, latePaceLast: 78 }),
    h("8", "Kikuride",           4.0, "S",  [83, 81, 76],  238,126, { primePower: 134.3, currentClass: 0,     avgClassLast3: 114.0, earlyPaceLast: 0,  latePaceLast: 81 }),
    h("3", "Ridegold",          15.0, "EP", [89, 89, 78],  196,124, { primePower: 122.7, currentClass: 113.0, avgClassLast3: 113.1, earlyPaceLast: 88, latePaceLast: 66 }),
    h("9", "Pavel Is Appealing",15.0, "P",  [75, 0, 0],    463,126, { primePower: 115.0, currentClass: 0,     avgClassLast3: 0,     earlyPaceLast: 0,  latePaceLast: 0 }),
    h("6", "Sexy Blue",         30.0, "EP", [60, 0, 0],    28, 124, { primePower: 103.2, currentClass: 0,     avgClassLast3: 0,     earlyPaceLast: 79, latePaceLast: 65 }),
    h("10","Gold Currency",     10.0, "E",  [73, 81, 77],  56, 124, { primePower: 122.5, currentClass: 0,     avgClassLast3: 0,     earlyPaceLast: 73, latePaceLast: 0 }),
  ],
};

// ── R8 — MC 20000 5 1/2f Dirt 3,4,5yo F&M ──
// Post 7:33 PT. Dirt 5.5f. WEEK N=1 → use MEET (N=35).
// (Same surface/distance as R2 — same biases)
const race8: StaticRace = {
  raceNumber: 8, postTime: "7:33 PT",
  raceType: "MC 20000", distance: "5 1/2f", surface: "Dirt", purse: 21000, condition: "Fast",
  scratches: ["13", "14"], // AEs that didn't draw in
  trackBias: {
    surface: "Dirt", distanceLabel: "5.5f",
    speedBiasPct: 83, railBias: "+",
    eIV: 1.71, epIV: 0.86, pIV: 0.67, sIV: 0.26,
    post1to3IV: 1.27, post4to7IV: 0.81, post8plusIV: 0.76,
  },
  horses: [
    h("7", "Manhattan Beauty",   5.0, "P",  [62, 67, 65],  72, 120, { primePower: 104.7, currentClass: 110.4, avgClassLast3: 110.4, earlyPaceLast: 0,  latePaceLast: 0 }),
    h("11","Dad's Bad Bunny",    6.0, "E",  [67, 60, 40],  29, 121, { primePower: 113.3, currentClass: 109.6, avgClassLast3: 113.3, earlyPaceLast: 90, latePaceLast: 0 }),
    h("12","Miss Hot and Cold",  3.5, "S",  [69, 0, 0],    29, 120, { primePower: 112.6, currentClass: 109.3, avgClassLast3: 109.2, earlyPaceLast: 92, latePaceLast: 67 }),
    h("4", "Can You Dream",     30.0, "E",  [71, 70, 49],  23, 120, { primePower: 106.8, currentClass: 108.3, avgClassLast3: 109.5, earlyPaceLast: 90, latePaceLast: 77 }),
    h("9", "Annie Oak Lee",     30.0, "S",  [76, 60, 52],  15, 120, { primePower: 106.0, currentClass: 0,     avgClassLast3: 109.0, earlyPaceLast: 0,  latePaceLast: 0 }),
    h("1", "Alix",               8.0, "E",  [67, 70, 0],   35, 120, { primePower: 112.8, currentClass: 0,     avgClassLast3: 0,     earlyPaceLast: 69, latePaceLast: 67 }),
    h("8", "Pantages",           8.0, "P",  [60, 71, 0],   44, 120, { primePower: 104.6, currentClass: 110.0, avgClassLast3: 109.1, earlyPaceLast: 83, latePaceLast: 60 }),
    h("3", "Maguite",           30.0, "S",  [0, 0, 0],     0,  120, { primePower: 0, currentClass: 0, avgClassLast3: 0 }),
    h("5", "Conquest Sue",       8.0, "E",  [75, 63, 0],   43, 120, { primePower: 114.8, currentClass: 0,     avgClassLast3: 0,     earlyPaceLast: 0,  latePaceLast: 75 }),
    h("6", "Kitty Marren",       4.5, "P",  [70, 70, 67],  24, 120, { primePower: 115.1, currentClass: 109.6, avgClassLast3: 110.5, earlyPaceLast: 83, latePaceLast: 67 }),
    h("2", "Omfortheholidays",  12.0, "S",  [0, 0, 0],     0,  120, { primePower: 0, currentClass: 0, avgClassLast3: 0 }),
    h("10","Anya",              20.0, "S",  [0, 0, 0],     0,  120, { primePower: 0, currentClass: 0, avgClassLast3: 0 }),
  ],
};

// ── R9 — OC 50000n1x 1 Mile (T) 3up F&M ──
// Post 8:03 PT. Turf 8.0f. Same blend as R1/R3.
const race9: StaticRace = {
  raceNumber: 9, postTime: "8:03 PT",
  raceType: "OC 50000n1x", distance: "1m", surface: "Turf", purse: 67000, condition: "Firm",
  trackBias: {
    surface: "Turf", distanceLabel: "8.0f",
    speedBiasPct: 45, railBias: "+",
    eIV: 0.51, epIV: 1.45, pIV: 1.29, sIV: 0.88,
    post1to3IV: 0.58, post4to7IV: 1.33, post8plusIV: 0.57,
  },
  horses: [
    h("2", "Take Another Card",   3.0, "S",  [89, 87, 81],  36, 126, { primePower: 146.7, currentClass: 116.0, avgClassLast3: 115.5, earlyPaceLast: 99, latePaceLast: 96 }),
    h("11","Resolve",             3.5, "S",  [90, 86, 87],  42, 124, { primePower: 142.5, currentClass: 114.3, avgClassLast3: 114.4, earlyPaceLast: 98, latePaceLast: 93 }),
    h("6", "Miss Meagher",        6.0, "EP", [85, 85, 83],  29, 124, { primePower: 128.1, currentClass: 114.2, avgClassLast3: 114.7, earlyPaceLast: 93, latePaceLast: 82 }),
    h("3", "The Mizen Queen",    10.0, "P",  [83, 87, 79],  28, 124, { primePower: 132.2, currentClass: 115.4, avgClassLast3: 114.0, earlyPaceLast: 81, latePaceLast: 83 }),
    h("8", "Lubie's Music",       8.0, "EP", [84, 78, 83],  21, 124, { primePower: 134.5, currentClass: 113.0, avgClassLast3: 114.6, earlyPaceLast: 84, latePaceLast: 80 }),
    h("1", "Ketonia",            15.0, "P",  [83, 88, 84],  70, 124, { primePower: 125.4, currentClass: 115.5, avgClassLast3: 114.0, earlyPaceLast: 88, latePaceLast: 75 }),
    h("4", "Cailin Dana",        15.0, "S",  [82, 82, 81],  28, 124, { primePower: 129.1, currentClass: 113.2, avgClassLast3: 114.0, earlyPaceLast: 82, latePaceLast: 81 }),
    h("10","Lavender Love",      10.0, "E",  [92, 89, 79],  44, 126, { primePower: 125.3, currentClass: 113.6, avgClassLast3: 112.8, earlyPaceLast: 84, latePaceLast: 82 }),
    h("5", "Chilly Philly",      12.0, "P",  [77, 78, 74],  343,126, { primePower: 119.7, currentClass: 0,     avgClassLast3: 113.3, earlyPaceLast: 71, latePaceLast: 80 }),
    h("9", "Mi Confesion",       15.0, "S",  [79, 0, 0],    28, 124, { primePower: 131.0, currentClass: 0,     avgClassLast3: 116.0, earlyPaceLast: 68, latePaceLast: 78 }),
    h("7", "Our Moonlight",       8.0, "EP", [85, 80, 67],  43, 124, { primePower: 129.3, currentClass: 0,     avgClassLast3: 114.0, earlyPaceLast: 82, latePaceLast: 64 }),
  ],
};

export const SA_APR26_2026: StaticRace[] = [
  race1, race2, race3, race4, race5,
  race6, race7, race8, race9,
];

export const SA_APR26_DATE = "2026-04-26 (Santa Anita)";

// Mark class drop using currentClass vs avgClassLast3 heuristic
for (const r of SA_APR26_2026) {
  for (const h of r.horses) {
    if (h.currentClass && h.avgClassLast3 && h.currentClass < h.avgClassLast3) {
      h.isClassDrop = true;
    }
  }
}
