export interface HorseEntry {
  pp: number;
  program: string;
  name: string;
  jockey: string;
  trainer: string;
  mlOdds: number;
  style: string;
  speed: number;
  e1Pace: number;
  latePace: number;
  wins?: number;
  starts?: number;
  last3Beyer?: number[];
  jockeyWinPct?: number;
  trainerWinPct?: number;
  distanceWins?: number;
  distanceStarts?: number;
  surfaceWins?: number;
  surfaceStarts?: number;
  isClassDrop?: boolean;
  isClassRaise?: boolean;
  daysSinceLast?: number;
  equipmentChange?: boolean;
}

export interface RaceInfo {
  track: string;
  trackName?: string;
  date: string;
  raceNumber: number;
  distance: string;
  surface: string;
  raceType: string;
  purse: number;
  condition: string;
  entries: HorseEntry[];
}

export interface PredictionRow {
  name: string;
  program: string;
  mlOdds: number;
  winPct: number;
  placePct: number;
  showPct: number;
  style: string;
  adjustedProb: number;
}

export interface ExoticCombo {
  rank: number;
  programs: string[];
  names: string[];
  probability: number;
  estimatedPayoff: number;
  unitCost: number;
  aboveCutoff: boolean;
}

export interface RankedExoticList {
  betType: string;
  unitCost: number;
  combos: ExoticCombo[];
  totalAboveCutoff: number;
  costAboveCutoff: number;
}

export interface ExactaRow {
  first: string;
  second: string;
  prob: number;
}

export interface TrifectaRow {
  first: string;
  second: string;
  third: string;
  prob: number;
}

export interface PaceScenario {
  scenario: string;
  earlyCount: number;
  presserCount: number;
  closerCount: number;
  description: string;
}

export interface SimulationResult {
  predictions: PredictionRow[];
  exactas: RankedExoticList;
  trifectas: RankedExoticList;
  superfectas: RankedExoticList;
  paceScenario: PaceScenario;
}
