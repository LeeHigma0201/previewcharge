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
  lastFinishPosition?: number;
  weight?: number;
}

export interface RaceTrackBias {
  // Week-level Brisnet track bias stats for this surface+distance
  speedBiasPct: number;     // % of recent races where speed held
  railBias: string;         // "+", "0", "-"
  eIV: number;              // runstyle impact values
  epIV: number;
  pIV: number;
  sIV: number;
  post1to3IV: number;       // post position impact values
  post4to7IV: number;
  post8plusIV: number;
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
  trackBias?: RaceTrackBias;   // optional — present for KEE Apr 18 2026
  postTime?: string;           // display only
  name?: string;               // stakes name if applicable
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

// EV-driven bet strategy — model picks the structure (straight/box/key)
// whose expected value is highest given the per-combo probabilities.
export interface BetStrategy {
  betType: "Exacta" | "Trifecta" | "Superfecta";
  name: string;                 // "4-horse box", "Top 5 straight", "Key favorite over top 3"
  description: string;          // short rationale
  tickets: ExoticCombo[];       // combos this strategy covers (sorted by prob)
  ticketCount: number;
  unitCost: number;             // per-ticket stake
  totalCost: number;            // ticketCount × unitCost
  hitProbability: number;       // P(strategy wins) = sum of covered combo probs
  expectedPayout: number;       // E[$ | hit] × hitProb
  expectedValue: number;        // expectedPayout − totalCost
  expectedRoi: number;          // EV / totalCost (dimensionless)
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

export interface OverlayInfo {
  modelProb: number;
  marketProb: number;
  overlay: number;
  isOverlay: boolean;
  overlayPct: number;
}

export interface SimulationResult {
  predictions: PredictionRow[];
  exactas: RankedExoticList;
  trifectas: RankedExoticList;
  superfectas: RankedExoticList;
  paceScenario: PaceScenario;
  overlays: OverlayInfo[];
  strategies: BetStrategy[];   // best-EV recommendation per bet type
  simInfo: {
    totalSims: number;
    batchesRun: number;
    converged: boolean;
  };
}
