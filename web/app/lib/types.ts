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
}

export interface RaceInfo {
  track: string;
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
  mlOdds: number;
  winPct: number;
  placePct: number;
  showPct: number;
  style: string;
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
