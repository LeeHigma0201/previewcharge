// Race-day results ingest — localStorage-backed, keyed by date.
// Pre-populates any results confirmed from the track.

export type RaceFinish = string[]; // program numbers in finishing order: ["3","4","5","2"]
export type ResultsMap = Record<number, RaceFinish>;

export const RESULTS_STORAGE_KEY = "horsegpt_results_2026-04-26";

// Confirmed CD Apr 26 results (append as races finalize).
export const CONFIRMED_RESULTS: ResultsMap = {
  1: ["3", "2", "5", "4", "6"],       // R1 ALW 50000s 1 1/16m: Different Gravy, Bourbon Flight, Nogradi, Midway Munny, Cant Stop Munnings. Time 1:43.42.
  2: ["6", "7", "5", "2", "1"],       // R2 MSW 92k 4.5f 2yo F: Valkyrie, Cardio Cat, Go New York Go, Storm Diva, Respected Mind. Time 51.53. SCRs: 3, 4, 8, 9.
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
