// Keeneland Saturday April 18, 2026 — full card, authoritative.
// AUTO-GENERATED — see scripts/build-from-sheets.mjs
//
// AUTHORITATIVE SOURCES (no hallucination):
//   • horse 2.gsheet — Race/Pgm/Name/ML/Style/PrimePower/Jockey/Trainer (Gemini via NotebookLM)
//   • horse 3.gsheet — Race metadata (distance, surface, purse, pars)
//   • Copy of Horse Racing Data Extraction.gsheet — scratch list
// FILL-IN (best-effort):
//   • Detailed stats (pace figs, class, speed figs, connections %) from reconciled Gemini API ingestion

export interface KeeneHorse {
  program: string;
  post: number;
  name: string;
  jockey: string;
  trainer: string;
  mlOdds: number;
  style: "E" | "EP" | "P" | "S" | "C" | "?";
  primePower: number;
  classRating?: number;
  classLast3?: number;
  paceE1?: number;
  paceE2?: number;
  paceLate?: number;
  earlyPaceLast?: number;
  latePaceLast?: number;
  speedLastRace?: number;
  backSpeed?: number;
  last3Speeds?: number[];
  wins?: number;
  starts?: number;
  places?: number;
  shows?: number;
  daysSinceLast?: number;
  lastFinishPosition?: number;
  jockeyWinPct?: number;
  trainerWinPct?: number;
  weight?: number;
  scratched?: boolean;
  notes?: string;
}

export interface KeeneRace {
  raceNumber: number;
  postTime: string;
  distance: string;
  surface: "Dirt" | "Turf";
  raceType: string;
  purse: number;
  conditions: string;
  par: { e1: number; e2: number; late: number; speed: number };
  speedBiasMeet?: number;
  wirePctMeet?: number;
  railImpact?: number;
  dataConfidence?: "HIGH" | "MED" | "LOW" | "UNKNOWN";
  horses: KeeneHorse[];
}

export const KEE_APRIL_18_2026: KeeneRace[] = [
  {
    raceNumber: 1,
    postTime: "1:00 PM",
    distance: "1 1/16 Mile",
    surface: "Dirt",
    raceType: "Mdn 110k",
    purse: 110000,
    conditions: "3&up F&M MSW",
    par: { e1: 84, e2: 84, late: 82, speed: 84 },
    speedBiasMeet: 0.9,
    wirePctMeet: 0.2,
    railImpact: 0.7,
    dataConfidence: "HIGH",
    horses: [
      { program: "1", post: 1, name: "Miss Milky Way", jockey: "Machado L", trainer: "Drury Jr T", mlOdds: 8, style: "E", primePower: 118.1, classRating: 110, classLast3: 110.4, paceE1: 83, paceE2: 87, paceLate: 83, earlyPaceLast: 77, latePaceLast: 69, speedLastRace: 58, backSpeed: 74, last3Speeds: [70, 70, 76], wins: 0, starts: 6, places: 2, shows: 0, daysSinceLast: 28, lastFinishPosition: 9, jockeyWinPct: 0.03, trainerWinPct: 0, weight: 118 },
      { program: "2", post: 2, name: "Song of Sarah", jockey: "Rosario J", trainer: "Gargan D", mlOdds: 2, style: "EP", primePower: 121.7, classRating: 113, classLast3: 112.4, paceE1: 90, paceE2: 87, paceLate: 86, earlyPaceLast: 83, latePaceLast: 86, speedLastRace: 76, backSpeed: 84, last3Speeds: [84, 76, 56], wins: 0, starts: 3, places: 1, shows: 1, daysSinceLast: 34, lastFinishPosition: 5, jockeyWinPct: 0.19, trainerWinPct: 0, weight: 118 },
      { program: "3", post: 3, name: "Reality Star", jockey: "Prat F", trainer: "McGaughey III C R", mlOdds: 6, style: "P", primePower: 117.5, classRating: 111, classLast3: 110.2, paceE1: 81, paceE2: 81, paceLate: 78, earlyPaceLast: 80, latePaceLast: 79, speedLastRace: 77, backSpeed: 80, last3Speeds: [80, 77, 77], wins: 0, starts: 4, places: 0, shows: 2, daysSinceLast: 98, lastFinishPosition: 4, jockeyWinPct: 0.12, trainerWinPct: 0, weight: 126 },
      { program: "4", post: 4, name: "Raghba", jockey: "Velazquez J R", trainer: "Pletcher T A", mlOdds: 3, style: "EP", primePower: 122, classRating: 114, classLast3: 112.9, paceE1: 91, paceE2: 94, paceLate: 85, earlyPaceLast: 71, latePaceLast: 75, speedLastRace: 89, backSpeed: 89, last3Speeds: [71, 89, 72], wins: 0, starts: 9, places: 5, shows: 1, daysSinceLast: 57, lastFinishPosition: 5, jockeyWinPct: 0.17, trainerWinPct: 0.4, weight: 126 },
      { program: "5", post: 5, name: "Babysitter", jockey: "Saez L", trainer: "Walsh B P", mlOdds: 4.5, style: "P", primePower: 113.7, classRating: 112, classLast3: 108, paceE1: 88, paceE2: 82, paceLate: 74, earlyPaceLast: 75, latePaceLast: 74, speedLastRace: 75, backSpeed: 55, last3Speeds: [75, 55, ], wins: 0, starts: 2, places: 0, shows: 1, daysSinceLast: 57, lastFinishPosition: 3, jockeyWinPct: 0.16, trainerWinPct: 0.1, weight: 126 },
      { program: "6", post: 6, name: "Sonhador", jockey: "Gaffalione T", trainer: "Murphy C", mlOdds: 4, style: "S", primePower: 118.1, classRating: 113, classLast3: 112.2, paceE1: 90, paceE2: 91, paceLate: 86, earlyPaceLast: 72, latePaceLast: 83, speedLastRace: 85, backSpeed: 86, last3Speeds: [72, 86, 85], wins: 0, starts: 8, places: 4, shows: 3, daysSinceLast: 119, lastFinishPosition: 7, jockeyWinPct: 0.15, trainerWinPct: 0, weight: 126 },
    ],
  },
  {
    raceNumber: 2,
    postTime: "1:32 PM",
    distance: "1 1/8 Mile",
    surface: "Dirt",
    raceType: "Clm 20000n2L",
    purse: 49000,
    conditions: "3&up Clm",
    par: { e1: 86, e2: 87, late: 84, speed: 87 },
    speedBiasMeet: 0.25,
    wirePctMeet: 0,
    railImpact: 1.68,
    dataConfidence: "HIGH",
    horses: [
      { program: "1", post: 1, name: "D Day Sky", jockey: "Gaffalione T", trainer: "Eurton P", mlOdds: 4.5, style: "EP", primePower: 114.6, classRating: 109, classLast3: 111.5, paceE1: 88, paceE2: 90, paceLate: 66, earlyPaceLast: 88, latePaceLast: 66, speedLastRace: 77, backSpeed: 80, last3Speeds: [77, 77, 73], wins: 1, starts: 18, places: 2, shows: 5, daysSinceLast: 29, lastFinishPosition: 4, jockeyWinPct: 0.15, trainerWinPct: 0.11, weight: 125 },
      { program: "2", post: 2, name: "Romantic Lead", jockey: "Morales E", trainer: "Foster E N", mlOdds: 10, style: "P", primePower: 108.9, classRating: 108, classLast3: 108.8, paceE1: 55, paceE2: 57, paceLate: 97, earlyPaceLast: 55, latePaceLast: 97, speedLastRace: 74, backSpeed: 60, last3Speeds: [74, 60, 78], wins: 1, starts: 17, places: 4, shows: 2, daysSinceLast: 22, lastFinishPosition: 2, jockeyWinPct: 0.19, trainerWinPct: 0.5, weight: 125 },
      { program: "3", post: 3, name: "Stonemont Reunion", jockey: "Saez G", trainer: "Rider D M", mlOdds: 8, style: "EP", primePower: 119, classRating: 112, classLast3: 111.3, paceE1: 86, paceE2: 86, paceLate: 78, earlyPaceLast: 86, latePaceLast: 78, speedLastRace: 80, backSpeed: 65, last3Speeds: [80, 65, 90], wins: 1, starts: 19, places: 5, shows: 2, daysSinceLast: 31, lastFinishPosition: 2, jockeyWinPct: 0.18, trainerWinPct: 0, weight: 125 },
      { program: "4", post: 4, name: "Bonafide", jockey: "Concepcion A", trainer: "Simpson D", mlOdds: 20, style: "P", primePower: 109.6, classRating: 111, classLast3: 112.9, paceE1: 88, paceE2: 90, paceLate: 66, earlyPaceLast: 88, latePaceLast: 66, speedLastRace: 77, backSpeed: 81, last3Speeds: [77, 81, 74], wins: 1, starts: 10, places: 2, shows: 0, daysSinceLast: 34, lastFinishPosition: 4, jockeyWinPct: 0.07, trainerWinPct: 0, weight: 125 },
      { program: "5", post: 5, name: "Consolidated", jockey: "Machado L", trainer: "Delacour A", mlOdds: 12, style: "EP", primePower: 115.2, classRating: 108, classLast3: 109.9, paceE1: 83, paceE2: 83, paceLate: 78, earlyPaceLast: 83, latePaceLast: 78, speedLastRace: 78, backSpeed: 76, last3Speeds: [78, 76, 62], wins: 0, starts: 9, places: 5, shows: 1, daysSinceLast: 65, lastFinishPosition: 5, jockeyWinPct: 0.03, trainerWinPct: 0, weight: 125 },
      { program: "6", post: 6, name: "Phraseologism", jockey: "Lagunes G", trainer: "McGhee Jr T", mlOdds: 20, style: "S", primePower: 103, classRating: 108, classLast3: 107.9, paceE1: 46, paceE2: 45, paceLate: 100, earlyPaceLast: 46, latePaceLast: 100, speedLastRace: 69, backSpeed: 68, last3Speeds: [69, 68, 53], wins: 0, starts: 21, places: 1, shows: 0, daysSinceLast: 22, lastFinishPosition: 4, jockeyWinPct: 0, trainerWinPct: 0, weight: 125 },
      { program: "7", post: 7, name: "Ryu Mo", jockey: "Roman C", trainer: "Torres M", mlOdds: 15, style: "E", primePower: 116.3, classRating: 110, classLast3: 110.1, paceE1: 88, paceE2: 90, paceLate: 70, earlyPaceLast: 88, latePaceLast: 70, speedLastRace: 72, backSpeed: 89, last3Speeds: [72, 89, 72], wins: 1, starts: 6, places: 0, shows: 1, daysSinceLast: 21, lastFinishPosition: 8, jockeyWinPct: 0, trainerWinPct: 0, weight: 125 },
      { program: "8", post: 8, name: "Whiskey Shot", jockey: "Prat F", trainer: "Brisset R", mlOdds: 1.8, style: "P", primePower: 114.5, classRating: 111, classLast3: 112.6, paceE1: 86, paceE2: 75, paceLate: 15, earlyPaceLast: 86, latePaceLast: 15, speedLastRace: 38, backSpeed: 84, last3Speeds: [38, 84, 81], wins: 1, starts: 4, places: 0, shows: 1, daysSinceLast: 205, lastFinishPosition: 9, jockeyWinPct: 0.12, trainerWinPct: 0, weight: 125 },
      { program: "9", post: 9, name: "Tiz Freedom", jockey: "Saez L", trainer: "Mott W I", mlOdds: 3, style: "P", primePower: 119.4, classRating: 112, classLast3: 113.1, paceE1: 76, paceE2: 83, paceLate: 83, earlyPaceLast: 76, latePaceLast: 83, speedLastRace: 89, backSpeed: 71, last3Speeds: [89, 71, 80], wins: 1, starts: 8, places: 1, shows: 1, daysSinceLast: 15, lastFinishPosition: 5, jockeyWinPct: 0.16, trainerWinPct: 0.25, weight: 125 },
    ],
  },
  {
    raceNumber: 3,
    postTime: "2:04 PM",
    distance: "5.5 Furlongs",
    surface: "Turf",
    raceType: "Alw 120000n1x",
    purse: 120000,
    conditions: "3&up F&M Alw",
    par: { e1: 94, e2: 97, late: 86, speed: 87 },
    speedBiasMeet: 0.57,
    wirePctMeet: 0.14,
    railImpact: 0,
    dataConfidence: "HIGH",
    horses: [
      { program: "1", post: 1, name: "Bolt Dior", jockey: "Concepcion A", trainer: "Girten T", mlOdds: 15, style: "P", primePower: 119.8, classRating: 111.3, classLast3: 111.9, paceE1: 89, paceE2: 90, paceLate: 84, earlyPaceLast: 89, latePaceLast: 84, speedLastRace: 84, backSpeed: 83, last3Speeds: [70, 83, 71], wins: 1, starts: 6, places: 2, shows: 0, daysSinceLast: 24, lastFinishPosition: 4, jockeyWinPct: 0.07, trainerWinPct: 0, weight: 118 },
      { program: "2", post: 2, name: "Viva Vienne", jockey: "Machado L", trainer: "Wilkes I R", mlOdds: 20, style: "P", primePower: 119.2, classRating: 112.5, classLast3: 112.1, paceE1: 78, paceE2: 86, paceLate: 97, earlyPaceLast: 78, latePaceLast: 97, speedLastRace: 82, backSpeed: 75, last3Speeds: [82, 75, 52], wins: 1, starts: 5, places: 1, shows: 0, daysSinceLast: 43, lastFinishPosition: 2, jockeyWinPct: 0.03, trainerWinPct: 0.14, weight: 118 },
      { program: "3", post: 3, name: "Glean", jockey: "Corrales G", trainer: "Ward W A", mlOdds: 15, style: "EP", primePower: 122.1, classRating: 111.3, classLast3: 113, paceE1: 98, paceE2: 99, paceLate: 69, earlyPaceLast: 98, latePaceLast: 69, speedLastRace: 77, backSpeed: 78, last3Speeds: [77, 78, 90], wins: 1, starts: 4, places: 0, shows: 1, daysSinceLast: 336, lastFinishPosition: 5, jockeyWinPct: 0, trainerWinPct: 0.26, weight: 124 },
      { program: "4", post: 4, name: "Betty's Dance", jockey: "Saez L", trainer: "Sharp J", mlOdds: 10, style: "P", primePower: 122.7, classRating: 112.4, classLast3: 113.6, paceE1: 99, paceE2: 100, paceLate: 72, earlyPaceLast: 99, latePaceLast: 72, speedLastRace: 79, backSpeed: 88, last3Speeds: [79, 88, 80], wins: 1, starts: 8, places: 3, shows: 2, daysSinceLast: 43, lastFinishPosition: 3, jockeyWinPct: 0.16, trainerWinPct: 0.07, weight: 124 },
      { program: "5", post: 5, name: "Miss Lonelle", jockey: "Curtis B", trainer: "Catalano W M", mlOdds: 20, style: "S", primePower: 111.4, classRating: 109.1, classLast3: 111, paceE1: 89, paceE2: 92, paceLate: 70, earlyPaceLast: 89, latePaceLast: 70, speedLastRace: 70, backSpeed: 78, last3Speeds: [70, 78, 58], wins: 1, starts: 9, places: 1, shows: 1, daysSinceLast: 70, lastFinishPosition: 7, jockeyWinPct: 0, trainerWinPct: 0, weight: 124 },
      { program: "6", post: 6, name: "Valala", jockey: "De La Cruz F", trainer: "Tomlinson M A", mlOdds: 20, style: "E", primePower: 121.9, classRating: 112.6, classLast3: 112.6, paceE1: 90, paceE2: 84, paceLate: 84, earlyPaceLast: 90, latePaceLast: 84, speedLastRace: 78, backSpeed: 81, last3Speeds: [78, 81, 78], wins: 2, starts: 7, places: 2, shows: 3, daysSinceLast: 24, lastFinishPosition: 5, jockeyWinPct: 0.2, trainerWinPct: 0, weight: 118 },
      { program: "7", post: 7, name: "Capturing", jockey: "Velazquez J R", trainer: "Pletcher T A", mlOdds: 8, style: "P", primePower: 131.1, classRating: 113.1, classLast3: 113.1, paceE1: 87, paceE2: 89, paceLate: 89, earlyPaceLast: 87, latePaceLast: 89, speedLastRace: 86, backSpeed: 86, last3Speeds: [86, 89, 77], wins: 1, starts: 5, places: 1, shows: 3, daysSinceLast: 57, lastFinishPosition: 3, jockeyWinPct: 0.17, trainerWinPct: 0.4, weight: 124 },
      { program: "8", post: 8, name: "Perfect Figure", jockey: "Prat F", trainer: "Ward W A", mlOdds: 5, style: "EP", primePower: 125.7, classRating: 91, classLast3: 80.7, paceE1: 94, paceE2: 94, paceLate: 83, earlyPaceLast: 100, latePaceLast: 66, speedLastRace: 82, backSpeed: 83, last3Speeds: [82, 83, 82], wins: 1, starts: 6, places: 2, shows: 2, daysSinceLast: 259, lastFinishPosition: 11, jockeyWinPct: 0.27, trainerWinPct: 0.28, weight: 124 },
      { program: "9", post: 9, name: "Bourbon Notes", jockey: "Hernandez Jr B J", trainer: "Wilkes I R", mlOdds: 6, style: "E", primePower: 129.2, classRating: 86, classLast3: 80.7, paceE1: 93, paceE2: 84, paceLate: 76, earlyPaceLast: 93, latePaceLast: 84, speedLastRace: 86, backSpeed: 80, last3Speeds: [86, 80, 76], wins: 1, starts: 5, places: 0, shows: 1, daysSinceLast: 35, lastFinishPosition: 7, jockeyWinPct: 0.15, trainerWinPct: 0.11, weight: 118 },
      { program: "10", post: 10, name: "Hot Mash", jockey: "Rosario J", trainer: "Servis J C", mlOdds: 3, style: "EP", primePower: 142.5, classRating: 113, classLast3: 115.6, paceE1: 103, paceE2: 105, paceLate: 90, speedLastRace: 86, backSpeed: 86, last3Speeds: [86, 86], wins: 2, starts: 2, places: 1, shows: 0, daysSinceLast: 155, jockeyWinPct: 0.21, trainerWinPct: 0.21, weight: 118 },
      { program: "11", post: 11, name: "Family", jockey: "Burgos A", trainer: "Elliott M L", mlOdds: 12, style: "E", primePower: 130.7 },
      { program: "12", post: 12, name: "Stepping Stones", jockey: "Gaffalione T", trainer: "Sharp J", mlOdds: 4.5, style: "EP", primePower: 131.1, classRating: 110, classLast3: 113.6, paceE1: 91, paceE2: 92, paceLate: 81, speedLastRace: 80, backSpeed: 80, last3Speeds: [80, 80], wins: 3, starts: 8, places: 1, shows: 0, daysSinceLast: 36, jockeyWinPct: 0.15, trainerWinPct: 0.21, weight: 118 },
      { program: "13", post: 13, name: "Something Stronger", jockey: "Saez L", trainer: "Stall Jr A M", mlOdds: 10, style: "EP", primePower: 119.1, classRating: 113, classLast3: 112.2, paceE1: 88, paceE2: 91, paceLate: 76, speedLastRace: 81, backSpeed: 81, last3Speeds: [81, 63, 72], wins: 1, starts: 7, places: 1, shows: 3, daysSinceLast: 70, jockeyWinPct: 0.16, trainerWinPct: 0.18, weight: 124 },
      { program: "14", post: 14, name: "J Z's Last Schance", jockey: "Roman E A", trainer: "Zawitz J", mlOdds: 20, style: "S", primePower: 118.2, classRating: 112, classLast3: 112.2, paceE1: 89, paceE2: 89, paceLate: 80, speedLastRace: 79, backSpeed: 79, last3Speeds: [79, 75, 70], wins: 2, starts: 16, places: 2, shows: 2, daysSinceLast: 35, jockeyWinPct: 0.14, trainerWinPct: 0, weight: 124 },
      { program: "15", post: 15, name: "Trust Fund Philly", jockey: "Rosario J", trainer: "Eurton P", mlOdds: 8, style: "EP", primePower: 124.9, classRating: 112, classLast3: 114.1, paceE1: 94, paceE2: 96, paceLate: 80, speedLastRace: 78, backSpeed: 83, last3Speeds: [78, 80, 83], wins: 1, starts: 8, places: 2, shows: 3, daysSinceLast: 49, jockeyWinPct: 0.21, trainerWinPct: 0.19, weight: 124 },
      { program: "16", post: 16, name: "Pillar of Beauty", jockey: "Prat F", trainer: "Mott W I", mlOdds: 6, style: "EP", primePower: 127.3, classRating: 112, classLast3: 110.3, paceE1: 93, paceE2: 83, paceLate: 84, speedLastRace: 83, backSpeed: 83, last3Speeds: [83, 73, 84], wins: 1, starts: 3, places: 1, shows: 1, daysSinceLast: 43, jockeyWinPct: 0.25, trainerWinPct: 0.25, weight: 118 },
    ],
  },
  {
    raceNumber: 4,
    postTime: "2:36 PM",
    distance: "1 1/16 Mile",
    surface: "Dirt",
    raceType: "Alw 30000s",
    purse: 55000,
    conditions: "3&up Alw",
    par: { e1: 88, e2: 91, late: 86, speed: 91 },
    speedBiasMeet: 0.9,
    wirePctMeet: 0.2,
    railImpact: 0.7,
    dataConfidence: "HIGH",
    horses: [
      { program: "1", post: 1, name: "Mountain Wolf", jockey: "Saez G", trainer: "Warpool M S", mlOdds: 30, style: "P", primePower: 118.1, classRating: 111, classLast3: 111.6, paceE1: 85, paceE2: 82, paceLate: 80, earlyPaceLast: 74, latePaceLast: 79, speedLastRace: 79, backSpeed: 73, last3Speeds: [79, 73, 79], wins: 1, starts: 7, places: 1, shows: 1, daysSinceLast: 22, lastFinishPosition: 4, jockeyWinPct: 0.18, trainerWinPct: 0, weight: 118 },
      { program: "2", post: 2, name: "Askari", jockey: "Curtis B", trainer: "Kenneally E", mlOdds: 6, style: "P", primePower: 123, classRating: 113, classLast3: 111.7, paceE1: 87, paceE2: 89, paceLate: 97, earlyPaceLast: 83, latePaceLast: 86, speedLastRace: 83, backSpeed: 83, last3Speeds: [83, 83, 83], wins: 2, starts: 17, places: 2, shows: 2, daysSinceLast: 35, lastFinishPosition: 5, jockeyWinPct: 0, trainerWinPct: 0.14, weight: 125 },
      { program: "3", post: 3, name: "Morunning", jockey: "Saez L", trainer: "Davis C", mlOdds: 2, style: "E", primePower: 125.8, classRating: 114.5, classLast3: 114.5, paceE1: 101, paceE2: 105, paceLate: 81, earlyPaceLast: 89, latePaceLast: 85, speedLastRace: 85, backSpeed: 96, last3Speeds: [85, 96, 94], wins: 2, starts: 17, places: 3, shows: 5, daysSinceLast: 43, lastFinishPosition: 3, jockeyWinPct: 0.16, trainerWinPct: 0, weight: 125 },
      { program: "4", post: 4, name: "Baytown Bruiser", jockey: "Gaffalione T", trainer: "King B L", mlOdds: 4, style: "EP", primePower: 122.3, classRating: 112.9, classLast3: 112.9, paceE1: 95, paceE2: 98, paceLate: 81, earlyPaceLast: 93, latePaceLast: 81, speedLastRace: 90, backSpeed: 85, last3Speeds: [90, 85, 79], wins: 3, starts: 9, places: 1, shows: 1, daysSinceLast: 42, lastFinishPosition: 4, jockeyWinPct: 0.17, trainerWinPct: 0, weight: 118 },
      { program: "5", post: 5, name: "Mary's Boy Bolt", jockey: "Machado L", trainer: "Hartman C A", mlOdds: 3, style: "EP", primePower: 121.2, classRating: 113, classLast3: 113, paceE1: 90, paceE2: 89, paceLate: 83, earlyPaceLast: 90, latePaceLast: 83, speedLastRace: 86, backSpeed: 78, last3Speeds: [86, 78, 83], wins: 2, starts: 12, places: 1, shows: 1, daysSinceLast: 37, lastFinishPosition: 6, jockeyWinPct: 0.14, trainerWinPct: 0, weight: 125 },
      { program: "6", post: 6, name: "Armed N Dangerous", jockey: "Hernandez Jr B J", trainer: "Sillaman R P", mlOdds: 10, style: "P", primePower: 118.8, classRating: 113, classLast3: 112.1, paceE1: 84, paceE2: 80, paceLate: 109, earlyPaceLast: 84, latePaceLast: 78, speedLastRace: 78, backSpeed: 85, last3Speeds: [78, 85, 86], wins: 2, starts: 10, places: 4, shows: 0, daysSinceLast: 34, lastFinishPosition: 2, jockeyWinPct: 0.08, trainerWinPct: 0, weight: 125 },
      { program: "7", post: 7, name: "Protective", jockey: "Bays B", trainer: "Howard M A", mlOdds: 12, style: "P", primePower: 122.8, classRating: 113.7, classLast3: 113.1, paceE1: 92, paceE2: 94, paceLate: 94, earlyPaceLast: 89, latePaceLast: 94, speedLastRace: 77, backSpeed: 89, last3Speeds: [77, 89, 83], wins: 2, starts: 16, places: 4, shows: 2, daysSinceLast: 15, lastFinishPosition: 9, jockeyWinPct: 0, trainerWinPct: 0, weight: 118 },
      { program: "8", post: 8, name: "Ice Shot", jockey: "Rosario J", trainer: "Kelly B", mlOdds: 8, style: "P", primePower: 112.4, classRating: 110.4, classLast3: 110.4, paceE1: 72, paceE2: 69, paceLate: 82, earlyPaceLast: 72, latePaceLast: 71, speedLastRace: 76, backSpeed: 71, last3Speeds: [76, 71, 79], wins: 1, starts: 5, places: 0, shows: 1, daysSinceLast: 57, lastFinishPosition: 4, jockeyWinPct: 0.19, trainerWinPct: 0, weight: 125 },
      { program: "9", post: 9, name: "Truly Legit", jockey: "Concepcion A", trainer: "Tomlinson M A", mlOdds: 15, style: "E", primePower: 114.6, classRating: 113.5, classLast3: 113.5, paceE1: 72, paceE2: 74, paceLate: 86, earlyPaceLast: 72, latePaceLast: 78, speedLastRace: 78, backSpeed: 65, last3Speeds: [78, 65, 77], wins: 2, starts: 13, places: 1, shows: 2, daysSinceLast: 30, lastFinishPosition: 2, jockeyWinPct: 0.07, trainerWinPct: 0, weight: 125 },
    ],
  },
  {
    raceNumber: 5,
    postTime: "3:08 PM",
    distance: "1 Mile",
    surface: "Dirt",
    raceType: "MC 50000",
    purse: 55000,
    conditions: "3&up MSW Claim",
    par: { e1: 86, e2: 87, late: 84, speed: 87 },
    speedBiasMeet: 0.9,
    wirePctMeet: 0.2,
    railImpact: 0.7,
    dataConfidence: "HIGH",
    horses: [
      { program: "1", post: 1, name: "Good Willie", jockey: "Rosario J", trainer: "Casse N W", mlOdds: 10, style: "S", primePower: 109.9, classRating: 108, classLast3: 107.9, paceE1: 76, paceE2: 85, paceLate: 72, earlyPaceLast: 71, latePaceLast: 64, speedLastRace: 71, backSpeed: 64, last3Speeds: [71, 64], wins: 0, starts: 2, places: 0, shows: 0, daysSinceLast: 60, lastFinishPosition: 7, jockeyWinPct: 0.15, trainerWinPct: 0.19, weight: 118 },
      { program: "2", post: 2, name: "Dare Defying", jockey: "Hernandez Jr B J", trainer: "McPeek K G", mlOdds: 12, style: "?", primePower: 110.8, classRating: 107, classLast3: 106.5, paceE1: 87, paceE2: 85, paceLate: 46, earlyPaceLast: 62, latePaceLast: 46, speedLastRace: 62, backSpeed: 62, last3Speeds: [62], wins: 0, starts: 1, places: 0, shows: 0, daysSinceLast: 15, lastFinishPosition: 8, jockeyWinPct: 0.16, trainerWinPct: 0.07, weight: 118 },
      { program: "3", post: 3, name: "Susan's Boy", jockey: "Gaffalione T", trainer: "DeVaux C", mlOdds: 4, style: "P", primePower: 123.8, classRating: 110, classLast3: 111.4, paceE1: 93, paceE2: 98, paceLate: 79, earlyPaceLast: 88, latePaceLast: 79, speedLastRace: 88, backSpeed: 83, last3Speeds: [83, 88, 75], wins: 0, starts: 5, places: 1, shows: 0, daysSinceLast: 59, lastFinishPosition: 2, jockeyWinPct: 0.17, trainerWinPct: 0.11, weight: 126 },
      { program: "4", post: 4, name: "Blue Mountains", jockey: "Prat F", trainer: "McCarthy M W", mlOdds: 8, style: "S", primePower: 115.9, classRating: 110, classLast3: 110.1, paceE1: 82, paceE2: 72, paceLate: 74, earlyPaceLast: 66, latePaceLast: 72, speedLastRace: 66, backSpeed: 69, last3Speeds: [66, 69, 72], wins: 0, starts: 4, places: 0, shows: 0, daysSinceLast: 38, lastFinishPosition: 7, jockeyWinPct: 0.25, trainerWinPct: 0.33, weight: 118 },
      { program: "5", post: 5, name: "Stop the Nonsense", jockey: "Saez G", trainer: "Leitch D", mlOdds: 20, style: "?", primePower: 110, classRating: 53, classLast3: 106.3, paceE1: 86, paceE2: 81, paceLate: 39, earlyPaceLast: 86, latePaceLast: 39, speedLastRace: 53, backSpeed: 53, last3Speeds: [53], wins: 0, starts: 1, places: 0, shows: 0, daysSinceLast: 38, lastFinishPosition: 10, jockeyWinPct: 0.16, trainerWinPct: 0.13, weight: 118 },
      { program: "6", post: 6, name: "Money Man", jockey: "Beschizza A", trainer: "Heath D G", mlOdds: 8, style: "S", primePower: 119, classRating: 76, classLast3: 110, paceE1: 91, paceE2: 89, paceLate: 69, earlyPaceLast: 91, latePaceLast: 69, speedLastRace: 76, backSpeed: 78, last3Speeds: [76, 78, 77], wins: 0, starts: 11, places: 0, shows: 3, daysSinceLast: 60, lastFinishPosition: 7, jockeyWinPct: 0.07, trainerWinPct: 0.2, weight: 126 },
      { program: "7", post: 7, name: "Discotheque", jockey: "Sheehy D", trainer: "Murphy C", mlOdds: 6, style: "EP", primePower: 118, classRating: 83, classLast3: 108.3, paceE1: 97, paceE2: 101, paceLate: 65, earlyPaceLast: 80, latePaceLast: 83, speedLastRace: 83, backSpeed: 76, last3Speeds: [83, 76, 74], wins: 0, starts: 13, places: 7, shows: 0, daysSinceLast: 44, lastFinishPosition: 2, jockeyWinPct: 0.11, trainerWinPct: 0.04, weight: 126 },
      { program: "8", post: 8, name: "Syntagma", jockey: "Machado L", trainer: "Desormeaux J K", mlOdds: 15, style: "?", primePower: 103.6, classRating: 68, classLast3: 108.5, paceE1: 60, paceE2: 64, paceLate: 81, earlyPaceLast: 60, latePaceLast: 81, speedLastRace: 68, backSpeed: 68, last3Speeds: [68], wins: 0, starts: 1, places: 0, shows: 0, daysSinceLast: 60, lastFinishPosition: 5, jockeyWinPct: 0.17, trainerWinPct: 0.1, weight: 118 },
      { program: "9", post: 9, name: "Road Trippin", jockey: "Concepcion A", trainer: "Calhoun W B", mlOdds: 12, style: "S", primePower: 116.8, classRating: 79, classLast3: 110, paceE1: 81, paceE2: 84, paceLate: 77, earlyPaceLast: 78, latePaceLast: 77, speedLastRace: 77, backSpeed: 77, last3Speeds: [77, 77, 79], wins: 0, starts: 6, places: 1, shows: 0, daysSinceLast: 37, lastFinishPosition: 2, jockeyWinPct: 0.14, trainerWinPct: 0.2, weight: 118 },
      { program: "10", post: 10, name: "Street Party", jockey: "Curtis B", trainer: "Kenneally E", mlOdds: 5, style: "E", primePower: 111.9, classRating: 81, classLast3: 111, paceE1: 93, paceE2: 90, paceLate: 72, earlyPaceLast: 93, latePaceLast: 72, speedLastRace: 81, backSpeed: 52, last3Speeds: [81, 52, 63], wins: 0, starts: 3, places: 1, shows: 0, daysSinceLast: 60, lastFinishPosition: 2, jockeyWinPct: 0.18, trainerWinPct: 0.19, weight: 118 },
      { program: "11", post: 11, name: "Tremendously", jockey: "Saez L", trainer: "Lynch B A", mlOdds: 8, style: "?", primePower: 106.4, classRating: 71, classLast3: 107.9, paceE1: 75, paceE2: 70, paceLate: 21, earlyPaceLast: 75, latePaceLast: 21, speedLastRace: 39, backSpeed: 71, last3Speeds: [39, 71], wins: 0, starts: 2, places: 0, shows: 0, daysSinceLast: 155, lastFinishPosition: 10, jockeyWinPct: 0.16, trainerWinPct: 0.24, weight: 126 },
      { program: "12", post: 12, name: "Pelican Bay", jockey: "Morales E", trainer: "Drury Jr T", mlOdds: 20, style: "S", primePower: 115.2, classRating: 77, classLast3: 109.4, paceE1: 79, paceE2: 78, paceLate: 91, earlyPaceLast: 69, latePaceLast: 78, speedLastRace: 77, backSpeed: 72, last3Speeds: [77, 72], wins: 0, starts: 2, places: 1, shows: 0, daysSinceLast: 60, lastFinishPosition: 2, jockeyWinPct: 0.05, trainerWinPct: 0.11, weight: 118 },
    ],
  },
  {
    raceNumber: 6,
    postTime: "3:40 PM",
    distance: "1 Mile",
    surface: "Turf",
    raceType: "Alw 120000n2L",
    purse: 120000,
    conditions: "3yo Fillies Alw",
    par: { e1: 0, e2: 0, late: 0, speed: 0 },
    speedBiasMeet: 0.43,
    wirePctMeet: 0.05,
    railImpact: 1.32,
    dataConfidence: "HIGH",
    horses: [
      { program: "1", post: 1, name: "Bright Star", jockey: "Cannon D", trainer: "Corrigan J", mlOdds: 30, style: "P", primePower: 109.3, classRating: 107.8, classLast3: 77, paceE1: 77, paceE2: 77, paceLate: 82, earlyPaceLast: 77, latePaceLast: 82, speedLastRace: 77, backSpeed: 77, last3Speeds: [77], wins: 1, starts: 1, places: 0, shows: 0, daysSinceLast: 72, lastFinishPosition: 1, jockeyWinPct: 0.02, trainerWinPct: 0, weight: 118 },
      { program: "2", post: 2, name: "Classic Glide", jockey: "Saez G", trainer: "Medina R", mlOdds: 15, style: "P", primePower: 125.2, classRating: 112.3, classLast3: 113.9, paceE1: 84, paceE2: 71, paceLate: 91, earlyPaceLast: 74, latePaceLast: 80, speedLastRace: 74, backSpeed: 76, last3Speeds: [74, 76, 80], wins: 1, starts: 6, places: 2, shows: 1, daysSinceLast: 48, lastFinishPosition: 9, jockeyWinPct: 0.18, trainerWinPct: 0, weight: 118 },
      { program: "3", post: 3, name: "Bless Her", jockey: "Velazquez J R", trainer: "Motion H G", mlOdds: 6, style: "P", primePower: 136.1, classRating: 109.5, classLast3: 113, paceE1: 64, paceE2: 60, paceLate: 92, earlyPaceLast: 59, latePaceLast: 86, speedLastRace: 84, backSpeed: 89, last3Speeds: [84, 89, 65], wins: 1, starts: 4, places: 0, shows: 1, daysSinceLast: 28, lastFinishPosition: 5, jockeyWinPct: 0.17, trainerWinPct: 0.29, weight: 118 },
      { program: "4", post: 4, name: "Dagmara", jockey: "Machado L", trainer: "Cox B H", mlOdds: 8, style: "EP", primePower: 129.2, classRating: 110.5, classLast3: 113.9, paceE1: 89, paceE2: 93, paceLate: 91, earlyPaceLast: 87, latePaceLast: 94, speedLastRace: 88, backSpeed: 76, last3Speeds: [88, 76, 80], wins: 1, starts: 4, places: 2, shows: 0, daysSinceLast: 49, lastFinishPosition: 1, jockeyWinPct: 0.14, trainerWinPct: 0.35, weight: 120 },
      { program: "5", post: 5, name: "Ring Rights", jockey: "Rosario J", trainer: "Walden W", mlOdds: 12, style: "S", primePower: 118.5, classRating: 111.8, classLast3: 113.3, paceE1: 73, paceE2: 73, paceLate: 77, earlyPaceLast: 71, latePaceLast: 77, speedLastRace: 71, backSpeed: 87, last3Speeds: [71, 87, 93], wins: 1, starts: 2, places: 0, shows: 0, daysSinceLast: 42, lastFinishPosition: 10, jockeyWinPct: 0.19, trainerWinPct: 0.17, weight: 118 },
      { program: "6", post: 6, name: "Unlimited Gold", jockey: "Beschizza A", trainer: "O'Dwyer J", mlOdds: 30, style: "EP", primePower: 104.7, classRating: 107.7, classLast3: 109.6, paceE1: 92, paceE2: 90, paceLate: 86, earlyPaceLast: 72, latePaceLast: 46, speedLastRace: 72, backSpeed: 67, last3Speeds: [72, 67, 46], wins: 1, starts: 5, places: 2, shows: 0, daysSinceLast: 129, lastFinishPosition: 7, jockeyWinPct: 0.12, trainerWinPct: 0, weight: 118 },
      { program: "7", post: 7, name: "Surprise Ending", jockey: "Gaffalione T", trainer: "Walsh B P", mlOdds: 3.5, style: "P", primePower: 126.6, classRating: 111.8, classLast3: 112.7, paceE1: 87, paceE2: 96, paceLate: 78, earlyPaceLast: 86, latePaceLast: 78, speedLastRace: 86, backSpeed: 79, last3Speeds: [86, 79, 79], wins: 1, starts: 2, places: 0, shows: 0, daysSinceLast: 77, lastFinishPosition: 1, jockeyWinPct: 0.15, trainerWinPct: 0.1, weight: 118 },
      { program: "8", post: 8, name: "Candy Rockette", jockey: "Saez L", trainer: "Mott W I", mlOdds: 4.5, style: "S", primePower: 132.2, classRating: 111.3, classLast3: 112.5, paceE1: 83, paceE2: 72, paceLate: 88, earlyPaceLast: 81, latePaceLast: 88, speedLastRace: 81, backSpeed: 98, last3Speeds: [81, 98, 94], wins: 1, starts: 2, places: 0, shows: 0, daysSinceLast: 48, lastFinishPosition: 1, jockeyWinPct: 0.16, trainerWinPct: 0.25, weight: 120 },
      { program: "9", post: 9, name: "Kentucky Belle", jockey: "Prat F", trainer: "Cox B H", mlOdds: 1.6, style: "S", primePower: 139.4, classRating: 112.4, classLast3: 113.2, paceE1: 83, paceE2: 87, paceLate: 73, earlyPaceLast: 79, latePaceLast: 82, speedLastRace: 79, backSpeed: 78, last3Speeds: [79, 78, 79], wins: 1, starts: 4, places: 1, shows: 2, daysSinceLast: 42, lastFinishPosition: 2, jockeyWinPct: 0.25, trainerWinPct: 0.35, weight: 118 },
      { program: "10", post: 10, name: "Temple Goddess", jockey: "Sheehy D", trainer: "Corrigan J", mlOdds: 30, style: "P", primePower: 120.3, classRating: 110.2, classLast3: 111.7, paceE1: 90, paceE2: 90, paceLate: 68, earlyPaceLast: 76, latePaceLast: 40, speedLastRace: 76, backSpeed: 84, last3Speeds: [76, 84, 73], wins: 1, starts: 10, places: 2, shows: 2, daysSinceLast: 28, lastFinishPosition: 1, jockeyWinPct: 0.1, trainerWinPct: 0, weight: 118 },
    ],
  },
  {
    raceNumber: 7,
    postTime: "4:12 PM",
    distance: "6 Furlongs",
    surface: "Dirt",
    raceType: "OC 80000n2x",
    purse: 130000,
    conditions: "4&up OC",
    par: { e1: 96, e2: 103, late: 93, speed: 96 },
    speedBiasMeet: 1,
    wirePctMeet: 0.33,
    railImpact: 1.11,
    dataConfidence: "HIGH",
    horses: [
      { program: "1", post: 1, name: "Floodlites", jockey: "Velazquez J R", trainer: "Ward W A", mlOdds: 3, style: "EP", primePower: 133.2, classRating: 114.3, classLast3: 115.1, paceE1: 95, paceE2: 101, paceLate: 96, earlyPaceLast: 91, latePaceLast: 88, speedLastRace: 98, backSpeed: 95, last3Speeds: [98, 95, 93], wins: 3, starts: 9, places: 1, shows: 1, daysSinceLast: 126, lastFinishPosition: 3, jockeyWinPct: 0.17, trainerWinPct: 0.26, weight: 118 },
      { program: "2", post: 2, name: "Can Do Andrew", jockey: "Saez G", trainer: "Anderson D L", mlOdds: 12, style: "E", primePower: 128.7, classRating: 113.7, classLast3: 115.3, paceE1: 95, paceE2: 101, paceLate: 97, earlyPaceLast: 94, latePaceLast: 87, speedLastRace: 76, backSpeed: 95, last3Speeds: [76, 95, 87], wins: 3, starts: 9, places: 2, shows: 1, daysSinceLast: 239, lastFinishPosition: 6, jockeyWinPct: 0.18, trainerWinPct: 0, weight: 118 },
      { program: "3", post: 3, name: "Kalahari Dreams", jockey: "Saez L", trainer: "Bauer P A", mlOdds: 3.5, style: "P", primePower: 133, classRating: 114.9, classLast3: 116.3, paceE1: 94, paceE2: 103, paceLate: 98, earlyPaceLast: 87, latePaceLast: 94, speedLastRace: 92, backSpeed: 94, last3Speeds: [92, 94, 86], wins: 2, starts: 13, places: 6, shows: 1, daysSinceLast: 120, lastFinishPosition: 9, jockeyWinPct: 0.16, trainerWinPct: 0, weight: 118 },
      { program: "4", post: 4, name: "Keep It Easy", jockey: "Lanerie C J", trainer: "Romans D L", mlOdds: 6, style: "EP", primePower: 130, classRating: 113.5, classLast3: 113.4, paceE1: 92, paceE2: 97, paceLate: 93, earlyPaceLast: 89, latePaceLast: 88, speedLastRace: 78, backSpeed: 89, last3Speeds: [78, 89, 93], wins: 2, starts: 9, places: 1, shows: 0, daysSinceLast: 45, lastFinishPosition: 6, jockeyWinPct: 0.11, trainerWinPct: 0, weight: 118 },
      { program: "5", post: 5, name: "Politicallycorrect", jockey: "Gaffalione T", trainer: "Davis C", mlOdds: 15, style: "EP", primePower: 126.7, classRating: 113.8, classLast3: 113.8, paceE1: 98, paceE2: 106, paceLate: 89, earlyPaceLast: 85, latePaceLast: 86, speedLastRace: 86, backSpeed: 86, last3Speeds: [86, 86, 81], wins: 2, starts: 8, places: 1, shows: 1, daysSinceLast: 64, lastFinishPosition: 3, jockeyWinPct: 0.17, trainerWinPct: 0, weight: 118 },
      { program: "6", post: 6, name: "Modus Bestia", jockey: "Prat F", trainer: "Baltas R", mlOdds: 6, style: "E", primePower: 128.6, classRating: 114.5, classLast3: 114.5, paceE1: 101, paceE2: 111, paceLate: 98, earlyPaceLast: 95, latePaceLast: 38, speedLastRace: 85, backSpeed: 96, last3Speeds: [85, 96, 103], wins: 2, starts: 9, places: 1, shows: 1, daysSinceLast: 62, lastFinishPosition: 5, jockeyWinPct: 0.25, trainerWinPct: 0, weight: 118 },
      { program: "7", post: 7, name: "Whatchatalkinabout", jockey: "Rosario J", trainer: "Ward W A", mlOdds: 1.6, style: "EP", primePower: 142.3, classRating: 117.5, classLast3: 118.3, paceE1: 98, paceE2: 105, paceLate: 93, earlyPaceLast: 94, latePaceLast: 85, speedLastRace: 89, backSpeed: 95, last3Speeds: [89, 95, 107], wins: 4, starts: 11, places: 3, shows: 2, daysSinceLast: 168, lastFinishPosition: 9, jockeyWinPct: 0.15, trainerWinPct: 0.26, weight: 118 },
    ],
  },
  {
    raceNumber: 8,
    postTime: "4:44 PM",
    distance: "5.5 Furlongs",
    surface: "Turf",
    raceType: "Alw 140000b",
    purse: 140000,
    conditions: "4&up Alw",
    par: { e1: 0, e2: 0, late: 0, speed: 0 },
    speedBiasMeet: 0.57,
    wirePctMeet: 0.14,
    railImpact: 0,
    dataConfidence: "HIGH",
    horses: [
      { program: "1", post: 1, name: "Troubleshooting", jockey: "Gaffalione T", trainer: "Foley G D", mlOdds: 6, style: "P", primePower: 140.7, classRating: 115.8, classLast3: 116, paceE1: 96, paceE2: 109, paceLate: 90, earlyPaceLast: 91, latePaceLast: 73, speedLastRace: 78, backSpeed: 90, last3Speeds: [78, 90, 98], wins: 4, starts: 11, places: 3, shows: 0, daysSinceLast: 147, lastFinishPosition: 9, jockeyWinPct: 0.15, trainerWinPct: 0.4, weight: 118, scratched: true, notes: "MTO — runs only if off turf" },
      { program: "2", post: 2, name: "Full Disclosure", jockey: "Beschizza A", trainer: "Jehaludi A", mlOdds: 12, style: "EP", primePower: 127.7, classRating: 115.4, classLast3: 116.3, paceE1: 93, paceE2: 91, paceLate: 91, earlyPaceLast: 93, latePaceLast: 91, speedLastRace: 94, backSpeed: 86, last3Speeds: [94, 86, 91], wins: 8, starts: 31, places: 6, shows: 3, daysSinceLast: 84, lastFinishPosition: 5, jockeyWinPct: 0.12, trainerWinPct: 0, weight: 118, scratched: true, notes: "Also-Eligible" },
      { program: "3", post: 3, name: "Dhabab", jockey: "Lanerie C J", trainer: "Vaughan E", mlOdds: 8, style: "S", primePower: 139.1, classRating: 116.1, classLast3: 117.4, paceE1: 92, paceE2: 99, paceLate: 93, earlyPaceLast: 90, latePaceLast: 90, speedLastRace: 92, backSpeed: 94, last3Speeds: [92, 94, 92], wins: 5, starts: 25, places: 5, shows: 2, daysSinceLast: 142, lastFinishPosition: 10, jockeyWinPct: 0.11, trainerWinPct: 0, weight: 118 },
      { program: "4", post: 4, name: "Run Carson", jockey: "Velazquez J R", trainer: "Danner K", mlOdds: 10, style: "EP", primePower: 145.8, classRating: 115.4, classLast3: 115.7, paceE1: 93, paceE2: 101, paceLate: 86, earlyPaceLast: 93, latePaceLast: 84, speedLastRace: 86, backSpeed: 89, last3Speeds: [86, 89, 92], wins: 4, starts: 15, places: 3, shows: 3, daysSinceLast: 59, lastFinishPosition: 7, jockeyWinPct: 0.17, trainerWinPct: 0, weight: 118 },
      { program: "5", post: 5, name: "Coming in Hot", jockey: "Concepcion A", trainer: "Salas M", mlOdds: 30, style: "P", primePower: 117.7, classRating: 114, classLast3: 112.1, paceE1: 87, paceE2: 90, paceLate: 89, earlyPaceLast: 87, latePaceLast: 81, speedLastRace: 61, backSpeed: 81, last3Speeds: [61, 81, 92], wins: 3, starts: 14, places: 0, shows: 0, daysSinceLast: 59, lastFinishPosition: 10, jockeyWinPct: 0.13, trainerWinPct: 0, weight: 118 },
      { program: "6", post: 6, name: "Works for Me", jockey: "Prat F", trainer: "Lee J R", mlOdds: 4, style: "P", primePower: 146, classRating: 101, classLast3: 99, paceE1: 94, paceE2: 96, paceLate: 89, earlyPaceLast: 94, latePaceLast: 89, speedLastRace: 89, backSpeed: 95, last3Speeds: [89, 95, 99], wins: 5, starts: 17, places: 4, shows: 3, daysSinceLast: 64, lastFinishPosition: 5, jockeyWinPct: 0.27, trainerWinPct: 0, weight: 118, scratched: true, notes: "Also-Eligible" },
      { program: "7", post: 7, name: "Silent Heart", jockey: "Saez L", trainer: "Lynch B A", mlOdds: 10, style: "EP", primePower: 139.2, classRating: 117, classLast3: 116.3, paceE1: 96, paceE2: 97, paceLate: 83, earlyPaceLast: 96, latePaceLast: 81, speedLastRace: 82, backSpeed: 86, last3Speeds: [82, 86, 92], wins: 4, starts: 14, places: 3, shows: 4, daysSinceLast: 322, lastFinishPosition: 7, jockeyWinPct: 0.16, trainerWinPct: 0.33, weight: 118 },
      { program: "8", post: 8, name: "My Own", jockey: "De La Cruz F", trainer: "Foster E N", mlOdds: 4.5, style: "E", primePower: 145.7, classRating: 117.1, classLast3: 117.1, paceE1: 90, paceE2: 96, paceLate: 90, earlyPaceLast: 91, latePaceLast: 94, speedLastRace: 91, backSpeed: 98, last3Speeds: [91, 98, 94], wins: 4, starts: 10, places: 2, shows: 0, daysSinceLast: 37, lastFinishPosition: 5, jockeyWinPct: 0.2, trainerWinPct: 0.5, weight: 118 },
      { program: "9", post: 9, name: "Seminole Chief", jockey: "Curtis B", trainer: "Sisterson J", mlOdds: 15, style: "EP", primePower: 136.6, classRating: 115.3, classLast3: 114.6, paceE1: 90, paceE2: 95, paceLate: 89, earlyPaceLast: 85, latePaceLast: 81, speedLastRace: 78, backSpeed: 87, last3Speeds: [78, 87, 97], wins: 3, starts: 13, places: 2, shows: 1, daysSinceLast: 49, lastFinishPosition: 9, jockeyWinPct: 0.16, trainerWinPct: 0.33, weight: 118 },
      { program: "10", post: 10, name: "Runnin' Rocket", jockey: "Saez G", trainer: "Sharp J", mlOdds: 20, style: "EP", primePower: 126.8, classRating: 113, classLast3: 115, paceE1: 96, paceE2: 99, paceLate: 77, earlyPaceLast: 96, latePaceLast: 65, speedLastRace: 68, backSpeed: 73, last3Speeds: [68, 73, 92], wins: 2, starts: 13, places: 2, shows: 2, daysSinceLast: 42, lastFinishPosition: 10, jockeyWinPct: 0.08, trainerWinPct: 0, weight: 118 },
    ],
  },
  {
    raceNumber: 9,
    postTime: "5:16 PM",
    distance: "1 3/16 Mile",
    surface: "Dirt",
    raceType: "Ben Ali S. (G3)",
    purse: 350000,
    conditions: "4&up Grade 3",
    par: { e1: 92, e2: 99, late: 90, speed: 99 },
    speedBiasMeet: 0.71,
    wirePctMeet: 0.14,
    railImpact: 0.99,
    dataConfidence: "HIGH",
    horses: [
      { program: "1", post: 1, name: "Stars and Stripes", jockey: "Saez L", trainer: "Mott W I", mlOdds: 4, style: "P", primePower: 139, classRating: 116.8, classLast3: 118, paceE1: 90, paceE2: 89, paceLate: 109, earlyPaceLast: 86, latePaceLast: 95, speedLastRace: 100, backSpeed: 95, last3Speeds: [100, 95, 73], wins: 3, starts: 6, places: 1, shows: 1, daysSinceLast: 41, lastFinishPosition: 1, jockeyWinPct: 0.16, trainerWinPct: 0.25, weight: 118 },
      { program: "2", post: 2, name: "Awesome Aaron", jockey: "Rosario J", trainer: "Casse N W", mlOdds: 15, style: "EP", primePower: 138.8, classRating: 118.2, classLast3: 118, paceE1: 98, paceE2: 103, paceLate: 92, earlyPaceLast: 94, latePaceLast: 98, speedLastRace: 97, backSpeed: 97, last3Speeds: [97, 94, 93], wins: 4, starts: 38, places: 6, shows: 4, daysSinceLast: 21, lastFinishPosition: 7, jockeyWinPct: 0.19, trainerWinPct: 0.19, weight: 118 },
      { program: "3", post: 3, name: "Tennessee Lamb", jockey: "Concepcion A", trainer: "Arnold II G R", mlOdds: 12, style: "EP", primePower: 127.1, classRating: 115.8, classLast3: 115.8, paceE1: 85, paceE2: 81, paceLate: 94, earlyPaceLast: 85, latePaceLast: 88, speedLastRace: 89, backSpeed: 91, last3Speeds: [89, 91, 97], wins: 3, starts: 13, places: 2, shows: 1, daysSinceLast: 48, lastFinishPosition: 3, jockeyWinPct: 0.07, trainerWinPct: 0.33, weight: 118 },
      { program: "4", post: 4, name: "British Isles", jockey: "Velazquez J R", trainer: "Baltas R", mlOdds: 6, style: "EP", primePower: 139.5, classRating: 119.4, classLast3: 119.4, paceE1: 93, paceE2: 101, paceLate: 74, earlyPaceLast: 93, latePaceLast: 90, speedLastRace: 92, backSpeed: 89, last3Speeds: [92, 90, 76], wins: 4, starts: 24, places: 6, shows: 4, daysSinceLast: 42, lastFinishPosition: 4, jockeyWinPct: 0.17, trainerWinPct: 0, weight: 123 },
      { program: "5", post: 5, name: "San Siro", jockey: "Gaffalione T", trainer: "Walsh B P", mlOdds: 8, style: "P", primePower: 134.7, classRating: 117.7, classLast3: 117.7, paceE1: 84, paceE2: 89, paceLate: 97, earlyPaceLast: 84, latePaceLast: 95, speedLastRace: 91, backSpeed: 95, last3Speeds: [91, 95, 90], wins: 4, starts: 18, places: 1, shows: 3, daysSinceLast: 28, lastFinishPosition: 7, jockeyWinPct: 0.16, trainerWinPct: 0.1, weight: 118 },
      { program: "6", post: 6, name: "Batten Down", jockey: "Prat F", trainer: "Mott W I", mlOdds: 2, style: "E", primePower: 138.5, classRating: 117.6, classLast3: 117.6, paceE1: 96, paceE2: 95, paceLate: 97, earlyPaceLast: 96, latePaceLast: 95, speedLastRace: 98, backSpeed: 91, last3Speeds: [98, 91, 97], wins: 4, starts: 13, places: 1, shows: 3, daysSinceLast: 48, lastFinishPosition: 6, jockeyWinPct: 0.25, trainerWinPct: 0.25, weight: 118 },
      { program: "7", post: 7, name: "Guns and Glory", jockey: "Sheehy D", trainer: "Meah A M", mlOdds: 50, style: "?", primePower: 122.2, classRating: 82.3, classLast3: 82.3, paceE1: 41, paceE2: 51, paceLate: 95, earlyPaceLast: 82, latePaceLast: 95, speedLastRace: 82, backSpeed: 82, last3Speeds: [82], wins: 2, starts: 11, places: 0, shows: 2, daysSinceLast: 51, lastFinishPosition: 8, jockeyWinPct: 0.25, trainerWinPct: 0.15, weight: 118 },
      { program: "8", post: 8, name: "Rattle N Roll", jockey: "Hernandez Jr B J", trainer: "McPeek K G", mlOdds: 3, style: "S", primePower: 141.5, classRating: 120.2, classLast3: 120.2, paceE1: 99, paceE2: 99, paceLate: 87, earlyPaceLast: 99, latePaceLast: 87, speedLastRace: 98, backSpeed: 95, last3Speeds: [98, 95, 93], wins: 5, starts: 18, places: 6, shows: 1, daysSinceLast: 168, lastFinishPosition: 14, jockeyWinPct: 0.19, trainerWinPct: 0, weight: 118 },
      { program: "9", post: 9, name: "Honor Marie", jockey: "Ramos J D", trainer: "Beckman D", mlOdds: 10, style: "S", primePower: 141.2, classRating: 100.3, classLast3: 100.3, paceE1: 83, paceE2: 93, paceLate: 87, earlyPaceLast: 91, latePaceLast: 96, speedLastRace: 92, backSpeed: 98, last3Speeds: [92, 98, 97], wins: 4, starts: 16, places: 2, shows: 2, daysSinceLast: 51, lastFinishPosition: 1, jockeyWinPct: 0.1, trainerWinPct: 0.16, weight: 118 },
    ],
  },
  {
    raceNumber: 10,
    postTime: "5:48 PM",
    distance: "1 1/2 Mile",
    surface: "Turf",
    raceType: "Elkhorn S. (G2)",
    purse: 400000,
    conditions: "4&up Grade 2",
    par: { e1: 91, e2: 97, late: 89, speed: 97 },
    speedBiasMeet: 0.43,
    wirePctMeet: 0.05,
    railImpact: 1.32,
    dataConfidence: "HIGH",
    horses: [
      { program: "1", post: 1, name: "Padiddle", jockey: "Morelos J E", trainer: "Dobles E L", mlOdds: 15, style: "S", primePower: 147.1, classRating: 116, classLast3: 116.6, paceE1: 100, paceE2: 110, paceLate: 93, earlyPaceLast: 94, latePaceLast: 91, speedLastRace: 94, backSpeed: 93, last3Speeds: [94, 93, 76], wins: 1, starts: 18, places: 5, shows: 6, daysSinceLast: 49, lastFinishPosition: 5, jockeyWinPct: 0.1, trainerWinPct: 0, weight: 118, scratched: true, notes: "PV-Illness" },
      { program: "2", post: 2, name: "Desvio", jockey: "Velazquez J R", trainer: "Meyers M F", mlOdds: 8, style: "S", primePower: 146.2, classRating: 118.4, classLast3: 118.5, paceE1: 103, paceE2: 107, paceLate: 109, earlyPaceLast: 60, latePaceLast: 87, speedLastRace: 84, backSpeed: 92, last3Speeds: [84, 92, 102], wins: 4, starts: 17, places: 1, shows: 3, daysSinceLast: 167, lastFinishPosition: 7, jockeyWinPct: 0.16, trainerWinPct: 0, weight: 118 },
      { program: "3", post: 3, name: "Utah Beach", jockey: "Curtis B", trainer: "Walsh B P", mlOdds: 8, style: "P", primePower: 147.9, classRating: 117.9, classLast3: 118.4, paceE1: 98, paceE2: 109, paceLate: 98, earlyPaceLast: 87, latePaceLast: 93, speedLastRace: 73, backSpeed: 91, last3Speeds: [73, 92, 105], wins: 5, starts: 20, places: 5, shows: 2, daysSinceLast: 28, lastFinishPosition: 3, jockeyWinPct: 0, trainerWinPct: 0.1, weight: 118 },
      { program: "4", post: 4, name: "Grand Sonata", jockey: "Gaffalione T", trainer: "Pletcher T A", mlOdds: 6, style: "P", primePower: 151.6, classRating: 117.5, classLast3: 118.6, paceE1: 89, paceE2: 97, paceLate: 101, earlyPaceLast: 87, latePaceLast: 97, speedLastRace: 96, backSpeed: 95, last3Speeds: [96, 95, 92], wins: 6, starts: 34, places: 9, shows: 2, daysSinceLast: 49, lastFinishPosition: 1, jockeyWinPct: 0.15, trainerWinPct: 0.4, weight: 120 },
      { program: "5", post: 5, name: "Fleetfoot", jockey: "Sheehy D", trainer: "Foley B", mlOdds: 12, style: "P", primePower: 151, classRating: 116.6, classLast3: 119.5, paceE1: 90, paceE2: 90, paceLate: 106, earlyPaceLast: 74, latePaceLast: 96, speedLastRace: 82, backSpeed: 96, last3Speeds: [82, 96, 90], wins: 5, starts: 18, places: 6, shows: 1, daysSinceLast: 167, lastFinishPosition: 4, jockeyWinPct: 0.1, trainerWinPct: 0, weight: 118 },
      { program: "6", post: 6, name: "Burnham Square", jockey: "Hernandez Jr B J", trainer: "Wilkes I R", mlOdds: 4, style: "S", primePower: 154.8, classRating: 116.6, classLast3: 118.4, paceE1: 84, paceE2: 92, paceLate: 98, earlyPaceLast: 73, latePaceLast: 96, speedLastRace: 90, backSpeed: 96, last3Speeds: [90, 96, 101], wins: 3, starts: 11, places: 4, shows: 1, daysSinceLast: 49, lastFinishPosition: 2, jockeyWinPct: 0.08, trainerWinPct: 0.14, weight: 118 },
      { program: "7", post: 7, name: "Truly Quality", jockey: "Machado L", trainer: "Thomas J", mlOdds: 5, style: "S", primePower: 159.4, classRating: 115.6, classLast3: 116.9, paceE1: 84, paceE2: 91, paceLate: 99, earlyPaceLast: 79, latePaceLast: 90, speedLastRace: 94, backSpeed: 93, last3Speeds: [94, 93, 88], wins: 6, starts: 19, places: 4, shows: 5, daysSinceLast: 28, lastFinishPosition: 4, jockeyWinPct: 0.14, trainerWinPct: 0, weight: 120 },
      { program: "8", post: 8, name: "Tawny Port", jockey: "Rosario J", trainer: "Clement M", mlOdds: 4.5, style: "S", primePower: 160.3, classRating: 120.2, classLast3: 120.2, paceE1: 110, paceE2: 99, paceLate: 109, earlyPaceLast: 99, latePaceLast: 87, speedLastRace: 98, backSpeed: 95, last3Speeds: [98, 95, 93], wins: 5, starts: 30, places: 6, shows: 5, daysSinceLast: 168, lastFinishPosition: 14, jockeyWinPct: 0.15, trainerWinPct: 0, weight: 118 },
      { program: "9", post: 9, name: "Navy Seal", jockey: "Corrales G", trainer: "Ward W A", mlOdds: 15, style: "EP", primePower: 144.3, classRating: 115.3, classLast3: 117.9, paceE1: 94, paceE2: 108, paceLate: 92, earlyPaceLast: 94, latePaceLast: 97, speedLastRace: 97, backSpeed: 95, last3Speeds: [97, 95, 92], wins: 3, starts: 16, places: 2, shows: 2, daysSinceLast: 49, lastFinishPosition: 5, jockeyWinPct: 0.12, trainerWinPct: 0.26, weight: 118 },
      { program: "10", post: 10, name: "Presider", jockey: "Concepcion A", trainer: "Sharp J", mlOdds: 20, style: "EP", primePower: 142.9, classRating: 114.9, classLast3: 117.3, paceE1: 99, paceE2: 94, paceLate: 88, earlyPaceLast: 80, latePaceLast: 88, speedLastRace: 91, backSpeed: 90, last3Speeds: [91, 90, 88], wins: 4, starts: 28, places: 9, shows: 5, daysSinceLast: 56, lastFinishPosition: 5, jockeyWinPct: 0.13, trainerWinPct: 0.07, weight: 118 },
      { program: "11", post: 11, name: "Freedom's Way", jockey: "Saez L", trainer: "Kenneally E", mlOdds: 20, style: "EP", primePower: 143.2, classRating: 115.3, classLast3: 117.4, paceE1: 72, paceE2: 83, paceLate: 94, earlyPaceLast: 75, latePaceLast: 87, speedLastRace: 92, backSpeed: 106, last3Speeds: [92, 106, 87], wins: 3, starts: 21, places: 4, shows: 4, daysSinceLast: 269, lastFinishPosition: 1, jockeyWinPct: 0.16, trainerWinPct: 0.14, weight: 118 },
      { program: "12", post: 12, name: "Anegada", jockey: "Prat F", trainer: "Maker M J", mlOdds: 15, style: "S", primePower: 146.2, classRating: 115.6, classLast3: 117.9, paceE1: 100, paceE2: 108, paceLate: 98, earlyPaceLast: 95, latePaceLast: 91, speedLastRace: 95, backSpeed: 91, last3Speeds: [95, 91, 90], wins: 4, starts: 16, places: 2, shows: 4, daysSinceLast: 49, lastFinishPosition: 3, jockeyWinPct: 0.25, trainerWinPct: 0, weight: 118 },
      { program: "13", post: 13, name: "Dancin in Da'nile", jockey: "Gutierrez M", trainer: "Cox G", mlOdds: 10, style: "P", primePower: 146.3, classRating: 115.9, classLast3: 117.5, paceE1: 115, paceE2: 104, paceLate: 109, earlyPaceLast: 89, latePaceLast: 82, speedLastRace: 97, backSpeed: 93, last3Speeds: [97, 93, 90], wins: 4, starts: 31, places: 3, shows: 4, daysSinceLast: 167, lastFinishPosition: 5, jockeyWinPct: 0.1, trainerWinPct: 0, weight: 118, scratched: true, notes: "PV-Illness" },
    ],
  },
  {
    raceNumber: 11,
    postTime: "6:20 PM",
    distance: "7 Furlongs",
    surface: "Dirt",
    raceType: "Mdn 110k",
    purse: 110000,
    conditions: "3yo Fillies MSW",
    par: { e1: 94, e2: 98, late: 88, speed: 89 },
    speedBiasMeet: 1,
    wirePctMeet: 0.5,
    railImpact: 0,
    dataConfidence: "HIGH",
    horses: [
      { program: "1", post: 1, name: "Thesewallshaveears", jockey: "Hernandez Jr B J", trainer: "McGee P J", mlOdds: 20, style: "S", primePower: 112.1, classRating: 109.8, classLast3: 109.5, paceE1: 92, paceE2: 90, paceLate: 61, earlyPaceLast: 90, latePaceLast: 71, speedLastRace: 63, backSpeed: 76, last3Speeds: [63, 76], wins: 0, starts: 2, places: 0, shows: 0, daysSinceLast: 63, lastFinishPosition: 6, jockeyWinPct: 0.16, trainerWinPct: 0, weight: 120 },
      { program: "2", post: 2, name: "River Rise", jockey: "Antongeorgi III W", trainer: "Wismer T S", mlOdds: 30, style: "E", primePower: 112.7, classRating: 109.9, classLast3: 112.7, paceE1: 85, paceE2: 83, paceLate: 79, earlyPaceLast: 85, latePaceLast: 79, speedLastRace: 72, backSpeed: 54, last3Speeds: [72, 54, 71], wins: 0, starts: 4, places: 0, shows: 1, daysSinceLast: 100, lastFinishPosition: 6, jockeyWinPct: 0.11, trainerWinPct: 0.2, weight: 120 },
      { program: "3", post: 3, name: "Fast Gun", jockey: "Gaffalione T", trainer: "Asmussen S M", mlOdds: 6, style: "?", primePower: 118.2, classRating: 111.7, classLast3: 111.7, paceE1: 91, paceE2: 93, paceLate: 79, earlyPaceLast: 91, latePaceLast: 79, speedLastRace: 80, backSpeed: 80, last3Speeds: [80], wins: 0, starts: 1, places: 0, shows: 0, daysSinceLast: 36, lastFinishPosition: 4, jockeyWinPct: 0.17, trainerWinPct: 0, weight: 120 },
      { program: "4", post: 4, name: "Full Dolly", jockey: "Moncada I", trainer: "Drury Jr T", mlOdds: 15, style: "S", primePower: 107.9, classRating: 108.9, classLast3: 108.9, paceE1: 85, paceE2: 77, paceLate: 80, earlyPaceLast: 85, latePaceLast: 80, speedLastRace: 67, backSpeed: 67, last3Speeds: [67], wins: 0, starts: 1, places: 0, shows: 0, daysSinceLast: 100, lastFinishPosition: 2, jockeyWinPct: 0.11, trainerWinPct: 0, weight: 120, scratched: true, notes: "PV-Illness" },
      { program: "5", post: 5, name: "West of Lex", jockey: "Rosario J", trainer: "Servis J C", mlOdds: 12, style: "E", primePower: 118.3, classRating: 109.4, classLast3: 110.6, paceE1: 90, paceE2: 86, paceLate: 76, earlyPaceLast: 90, latePaceLast: 76, speedLastRace: 74, backSpeed: 72, last3Speeds: [74, 72, 72], wins: 0, starts: 3, places: 0, shows: 1, daysSinceLast: 28, lastFinishPosition: 3, jockeyWinPct: 0.15, trainerWinPct: 0, weight: 120 },
      { program: "6", post: 6, name: "Army's Marauder", jockey: "Beschizza A", trainer: "Davis C", mlOdds: 10, style: "P", primePower: 118.6, classRating: 111.3, classLast3: 111.3, paceE1: 89, paceE2: 89, paceLate: 79, earlyPaceLast: 89, latePaceLast: 79, speedLastRace: 77, backSpeed: 75, last3Speeds: [77, 75, 77], wins: 0, starts: 3, places: 1, shows: 2, daysSinceLast: 23, lastFinishPosition: 5, jockeyWinPct: 0.12, trainerWinPct: 0, weight: 120 },
      { program: "7", post: 7, name: "She's Our Girl", jockey: "Curtis B", trainer: "Eurton P", mlOdds: 10, style: "?", primePower: 0, classRating: 0, classLast3: 0, paceE1: 0, paceE2: 0, paceLate: 0, wins: 0, starts: 0, places: 0, shows: 0, daysSinceLast: 0, lastFinishPosition: 0, jockeyWinPct: 0.09, trainerWinPct: 0.11, weight: 120, notes: "First start" },
      { program: "8", post: 8, name: "Island Flower", jockey: "Prat F", trainer: "DeVaux C", mlOdds: 4, style: "?", primePower: 114.9, classRating: 109.3, classLast3: 109.3, paceE1: 80, paceE2: 84, paceLate: 79, earlyPaceLast: 80, latePaceLast: 79, speedLastRace: 73, backSpeed: 73, last3Speeds: [73], wins: 0, starts: 1, places: 0, shows: 0, daysSinceLast: 63, lastFinishPosition: 9, jockeyWinPct: 0.25, trainerWinPct: 0.11, weight: 120 },
      { program: "9", post: 9, name: "Govern", jockey: "Velazquez J R", trainer: "McCarthy M W", mlOdds: 10, style: "S", primePower: 119.9, classRating: 112.7, classLast3: 112.9, paceE1: 89, paceE2: 89, paceLate: 84, earlyPaceLast: 89, latePaceLast: 84, speedLastRace: 79, backSpeed: 79, last3Speeds: [79], wins: 0, starts: 1, places: 0, shows: 1, daysSinceLast: 29, lastFinishPosition: 3, jockeyWinPct: 0.16, trainerWinPct: 0.33, weight: 120 },
      { program: "10", post: 10, name: "Be the Light", jockey: "Saez L", trainer: "Cox B H", mlOdds: 3, style: "S", primePower: 121.2, classRating: 112.3, classLast3: 112.3, paceE1: 90, paceE2: 97, paceLate: 77, earlyPaceLast: 90, latePaceLast: 77, speedLastRace: 81, backSpeed: 81, last3Speeds: [81], wins: 0, starts: 1, places: 0, shows: 1, daysSinceLast: 36, lastFinishPosition: 6, jockeyWinPct: 0.16, trainerWinPct: 0.35, weight: 120 },
      { program: "11", post: 11, name: "Rhapsody in Blue", jockey: "Villarreal O", trainer: "Roggenkamp III E K", mlOdds: 30, style: "S", primePower: 102.7, classRating: 109.1, classLast3: 109.1, paceE1: 63, paceE2: 65, paceLate: 85, earlyPaceLast: 63, latePaceLast: 85, speedLastRace: 53, backSpeed: 67, last3Speeds: [53, 67, 91], wins: 0, starts: 4, places: 0, shows: 1, daysSinceLast: 87, lastFinishPosition: 9, jockeyWinPct: 0.11, trainerWinPct: 0, weight: 120 },
      { program: "12", post: 12, name: "Miss Complicated", jockey: "Machado L", trainer: "Wilkes I R", mlOdds: 5, style: "P", primePower: 121.4, classRating: 84, classLast3: 113.5, paceE1: 89, paceE2: 93, paceLate: 82, earlyPaceLast: 93, latePaceLast: 82, speedLastRace: 84, backSpeed: 61, last3Speeds: [84, 61, 83], wins: 0, starts: 5, places: 3, shows: 1, daysSinceLast: 34, lastFinishPosition: 2, jockeyWinPct: 0.17, trainerWinPct: 0.11, weight: 120 },
    ],
  },
];
