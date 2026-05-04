// Shared StaticHorse + StaticRace + TrackBias types used by every card file.
// Extracted from the original static-types.ts so card data can be deleted
// without breaking type imports.

export interface StaticHorse {
  program: string;
  name: string;
  mlOdds: number;
  style: string;
  last3Beyer: number[];
  daysSinceLast: number;
  weight: number;
  primePower?: number;
  currentClass?: number;
  avgClassLast3?: number;
  earlyPaceLast?: number;
  latePaceLast?: number;
  mudPct?: number;
  isClassDrop?: boolean;
}

export interface TrackBias {
  surface: "Dirt" | "Turf";
  distanceLabel: string;
  speedBiasPct: number;
  railBias: string;
  eIV: number;
  epIV: number;
  pIV: number;
  sIV: number;
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
  name?: string;
  trackBias: TrackBias;
  horses: StaticHorse[];
  scratches?: string[];
}
