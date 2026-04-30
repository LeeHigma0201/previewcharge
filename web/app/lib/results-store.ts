// Race-day results ingest — localStorage-backed, keyed by date.
// Pre-populates any results confirmed from the track.

export type RaceFinish = string[]; // program numbers in finishing order: ["3","4","5","2"]
export type ResultsMap = Record<number, RaceFinish>;

// Storage key is date-scoped so flipping cards (e.g., CD Wed → CD Thu) doesn't
// inherit yesterday's finishes. Update RESULTS_DATE when the active card changes.
export const RESULTS_DATE = "2026-04-30";
export const RESULTS_STORAGE_KEY = `horsegpt_results_${RESULTS_DATE}`;

// Confirmed results from the track for TODAY'S card only.
// Populate with official finishes as races go off (or let auto-fetch fill via /api/live-results).
// IMPORTANT: never put a different date's results here — that's what RESULTS_STORAGE_KEY guards.
// Churchill Downs Thursday April 30, 2026 — populated as races go off.
// R1 OFFICIAL (4-5-1-2-6): Star's Image won at 9/2; algo had #4 at 9.7%.
//   Patched: lone-Beyer protection + 12 CD trainers added.
// R2 OFFICIAL (2-3-5): She'z the Law won; she went ML 15/1 -> live 1.6 (9.4x bet-down).
//   Algo had her 21.5%; market priced her 38%. We updated mlOdds but kept fighting
//   with stale bias/ability multipliers. Patched: sharp-money detector — when ML/live
//   ratio is high, pull bias and ability factors toward 1.0 (trust the market).
// R3 OFFICIAL (2-4-3-1-9): Fresh Out won photo over Silvertown. Algo top pick #5 Spotted
// finished out of top 5 — exactly what the pool-disparity flag predicted (W%-P% gap of -8%).
// Pool-disparity signal is now 3-for-3 today on chalk-trap detection (R1, R2, R3).
// Algo's residual stack is structurally underperforming chalk; rebuild discussed.
// R4 OFFICIAL (12-11-3, photo 4th): Breaking Hearts won at 5/1. Algo had her 4th at 12.2%.
// CHALK-DOUBT FLAG NOW 4-FOR-4 — #8 Theoretical (-6% gap, public chalk) was 4th in photo, not in top 3.
// New lesson: in chaos races, the BALANCED contender (no flags either way, top trainer+jockey) is often the winner.
// Our algo over-weights signal extremes and under-rates "boring." #12 had Cherie DeVaux + Jose Ortiz.
// R5 OFFICIAL (3-12-6-5): Jinxzi won, Tregetour 2nd — first clean exacta hit of the day.
// Algo's top-2 called the order EXACTLY (3 → 12). Win pool: $12.78 → +$10.78. Exacta box
// alternate (3-12-1 BOX, $6) returned $93.48 → +$87.48. Validates the "exacta-strong"
// pattern — when top-2 model_prob clusters ≥35% with a flat tail, the exacta box should
// promote from alternate to primary.
// R6 OFFICIAL (4-6-5-8): UAE President Cup Arabian S. — algo skipped (Arabian flag working).
// Diamond Gem AA was 5/2 chalk and won by daylight; nothing to learn here.
// R7 OFFICIAL (1-7-5-4): Honfleur won at 4/5 (chalk). Algo top-1, model_prob 30.6%. Top-1 hit.
// Through R7 (excl Arabian R6): top-1 2/6 (33%), top-3 4/6 (67%). Win-pool ROI +$4.90 on $12 cost (+41%).
export const CONFIRMED_RESULTS: ResultsMap = {
  1: ["4", "5", "1", "2", "6"],
  2: ["2", "3", "5"],
  3: ["2", "4", "3", "1", "9"],
  4: ["12", "11", "3", "10", "8"],
  5: ["3", "12", "6", "5", "13"],
  6: ["4", "6", "5", "8"],
  7: ["1", "7", "5", "4"],
};

export function loadResults(): ResultsMap {
  if (typeof window === "undefined") return { ...CONFIRMED_RESULTS };
  try {
    const raw = localStorage.getItem(RESULTS_STORAGE_KEY);
    const stored: ResultsMap = raw ? JSON.parse(raw) : {};
    // Confirmed track results override stale local entries
    return { ...stored, ...CONFIRMED_RESULTS };
  } catch {
    return { ...CONFIRMED_RESULTS };
  }
}

export function saveResults(map: ResultsMap): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(map));
}

export function setRaceFinish(raceNumber: number, finish: RaceFinish): ResultsMap {
  const current = loadResults();
  const updated: ResultsMap = { ...current, [raceNumber]: finish };
  saveResults(updated);
  return updated;
}

export function clearRaceFinish(raceNumber: number): ResultsMap {
  const current = loadResults();
  const updated = { ...current };
  delete updated[raceNumber];
  saveResults(updated);
  return updated;
}
