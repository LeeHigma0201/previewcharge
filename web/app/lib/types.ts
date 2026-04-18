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
  // Odds-overlay layer (computed AFTER ability)
  marketProb: number;        // implied from mlOdds
  evEdge: number;            // (winProb / marketProb) * (1 - takeout) — >1.0 is +EV
  tier: "A" | "B" | "C" | "exclude";
  tierReason: string;
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
  pps: number; // Pace Pressure Score 0-100 (Exotic Bet Algo §3.1)
}

export interface OverlayInfo {
  modelProb: number;
  marketProb: number;
  overlay: number;
  isOverlay: boolean;
  overlayPct: number;
}

// Proper handicapping ticket structure.
// Each ticket has an explicit bet type (STRAIGHT / KEY / BOX / WHEEL / PART-WHEEL)
// and shows the exact combos being played.
export type BetStructure =
  | "straight"       // single exact combo
  | "key"            // one horse keyed in one position, others fill
  | "box"            // horses can finish in any order among themselves
  | "wheel"          // one horse keyed over ALL others
  | "part-wheel"     // one horse keyed over selected subset
  | "key-box";       // one horse keyed, others boxed in remaining positions

export interface TicketSpec {
  label: string;               // human-readable name e.g. "Trifecta KEY #3 over #1,5,7"
  pool: "exacta" | "trifecta" | "superfecta";
  structure: BetStructure;
  keyPositions?: {             // for key bets
    slot: number;              // 1=1st, 2=2nd, etc
    programs: string[];
  }[];
  wheelPrograms?: string[];    // horses used in wheel/box
  legs?: string[][];           // for fully-structured tickets: each position's allowed programs
  combinations: number;
  unitCost: number;            // cost per combination (e.g. 1.00 tri, 0.10 super)
  totalCost: number;           // combinations × unitCost
  hitProbability: number;      // 0-1, model's estimated probability of winning
  estimatedPayoff: number;     // expected dollar payout per $1 ticket
  expectedValue: number;       // (hitProbability × estimatedPayoff × totalCost) - totalCost
  breakevenOdds: number;       // what the payout needs to exceed for +EV
  rationale: string;
  risk: "conservative" | "balanced" | "aggressive" | "variance";
}

export interface SimulationResult {
  predictions: PredictionRow[];
  exactas: RankedExoticList;
  trifectas: RankedExoticList;
  superfectas: RankedExoticList;
  paceScenario: PaceScenario;
  overlays: OverlayInfo[];
  tickets: TicketSpec[];  // Recommended A/B/C exotic tickets
  simInfo: {
    totalSims: number;
    batchesRun: number;
    converged: boolean;
  };
}
