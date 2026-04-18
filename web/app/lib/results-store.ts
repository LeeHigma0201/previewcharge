// Race-day results ingest — localStorage-backed, keyed by date.
// Pre-populates any results confirmed from the track.

export type RaceFinish = string[]; // program numbers in finishing order: ["3","4","5","2"]
export type ResultsMap = Record<number, RaceFinish>;

export const RESULTS_STORAGE_KEY = "horsegpt_results_2026-04-18";

// Confirmed results from the track (append new ones here for cross-device sync)
export const CONFIRMED_RESULTS: ResultsMap = {
  1: ["3", "4", "5", "2", "6", "1"], // R1: Reality Star, Raghba, Babysitter, Song of Sarah, Sonhador, Miss Milky Way
  2: ["5", "3", "9", "4"],            // R2: Consolidated, Stonemont Reunion, Tiz Freedom, Bonafide
  3: ["7", "3", "12", "8"],           // R3: Capturing, Perfect Figure, #12, #8
  4: ["3", "6", "2", "8"],            // R4: Morunning, Armed N Dangerous, Askari, Ice Shot (#4 + #9 scratched)
  5: ["10", "7", "4", "12"],          // R5: Syntagma, Discotheque, Street Party, Pelican Bay
  6: ["9", "3", "4", "7"],            // R6: Kentucky Belle, Bless Her, Dagmara, Surprise Ending (official Brisnet chart)
  7: ["1", "7", "3", "2"],            // R7: Floodlites, Whatchatalkinabout, Kalahari Dreams, Can Do Andrew — #4 Keep It Easy DNF (rider dislodged); #5/#6 scratched; $0.50 tri box 1-7-3 paid $5.91 — WON
  8: ["6", "1", "7", "3"], // R8 OFFICIAL: Works for Me, Troubleshooting, Silent Heart, Dhabab. $1 EX 6/1 $20.06; $0.50 TRI 6/1/7 $47.90; $0.50 SUPER 6/1/7/3 $160.11. #4 Run Carson + #10 Runnin' Rocket scratched. Model top pick #11 Arrest Me Red did NOT hit top 4.
  9: ["1", "6", "5", "2"], // R9 OFFICIAL (Ben Ali G3): Stars and Stripes, Batten Down, San Siro, Awesome Aaron. TOP PICK HIT — sharp money (bet from 4 ML to 9/5) called correctly. $1 EX 1-6 cashed (~$20-40). #9 Honor Marie scratched. Pick 3 LIVE.
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
