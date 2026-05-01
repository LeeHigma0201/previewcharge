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
// R6 SKIPPED (UAE President Cup G1 — Arabian-only race, model is Thoroughbred-only).
// R7 OFFICIAL (1-7-5): #1 Honfleur (Prat/Chad Brown) WON. Algo had him #1 at 30.6% — TOP-1 HIT.
//   2nd #7 Vow to Resiliency (algo had #4) — algo's R7 trifecta box 1-4-5 lost (came in 1-7-5).
//   #5 Heavenly Melody hit 3rd as algo's #3 pick.
//   Lesson: algo's top-1 is reliable on cleaner races; the under spread is still noisy.
// R8 OFFICIAL (6-2-...): #6 Jensco (Irad/Hess) WON. Algo had him #1 at 32.2% — TOP-1 HIT + EXACTA IN ORDER.
//   2nd #2 Our Shenanigan was algo's #2 at 23.6%. Cleanest forward exacta of the day after R5.
//   3rd not yet posted at scrape time.
// R9 OFFICIAL (8-5-4): #8 Lagynos (Asmussen/J.Ortiz) WON at 6/5. ALGO TOP-1 HIT (had #8 at 38.1%).
//   POOL-DISPARITY FLAG FAILED for first time today — the flag predicted #8 wouldn't win
//   (W-P +12pt gap), and #8 won. Flag now 4-for-5 (80%). HYPOTHESIS: flag doesn't generalize
//   to stakes races with top connections; morning fires were maiden/claiming chalks. Don't ship.
//   But the flag's secondary signals were 2-for-2: #5 P-pool over (predicted board) finished 2nd,
//   #4 SHOW-pool 4× spike (predicted board) finished 3rd. The smart-money board call is robust;
//   the chalk-doesn't-win primary call may need segmenting.
// R10 OFFICIAL (9-8-2-1 super): #9 Maximum Bourbon (Prat/D'Amato) WON at $3.92. Algo had #9 at #2 (19.7%).
//   POOL-DISPARITY FLAG FAILED AGAIN (2nd consecutive stakes miss). Flag 4-for-6 (67%).
//   2nd #8 Bourbon Bash (Asmussen/Rosario, 13/1) was algo's #5 at 9.6%. 3rd #2 Built was algo's #1.
//   Algo's 4-horse super box `2-9-6-1` MISSED — needed #8 in 4th. Algo's 5-horse super box would
//   have hit. Lesson: in stakes races with deep fields, expand super box to top-5 (chaos coverage).
// R11 OFFICIAL (5-8-6-3 super): #5 Cy Fair (Irad/Weaver) WON at $3.98. ALGO TOP-4 IN EXACT FORWARD ORDER.
//   #5 → #8 → #6 → #3 — matches algo's pre-race ranking 1→2→3→4 perfectly. Super 5-8-6-3 paid $2.41/$0.10.
//   POOL-DISPARITY FLAG FAILED FOR 3RD CONSECUTIVE STAKES TEST. Flag fired hardest of day on #5 (+14.9
//   W-P at 22 MTP, +15.8 at 11 MTP) — and #5 won. Stakes-segmentation hypothesis now N=3 same direction.
//   Smart-money board on #7 Midnight Martini (-5.0 W-P) MISSED — #7 not in top 4.
//   Algo top-1 today now: 5/9 = 55.6%. Top-2 forward exacta: 3 (R5, R8, R11). Top-4 in order: 1 (R11).
export const CONFIRMED_RESULTS: ResultsMap = {
  1: ["4", "5", "1", "2", "6"],
  2: ["2", "3", "5"],
  3: ["2", "4", "3", "1", "9"],
  4: ["12", "11", "3", "10", "8"],
  5: ["3", "12", "6", "5", "13"],
  7: ["1", "7", "5"],
  8: ["6", "2"],
  9: ["8", "5", "4"],
  10: ["9", "8", "2", "1"],
  11: ["5", "8", "6", "3"],
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
