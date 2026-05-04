/**
 * Churchill Downs Spring Meet Context
 * Added: 2026-04-25
 *
 * Mirrors static-types.ts pattern but for CD Spring meet (late Apr - Derby Day May 3).
 * Track-specific adjustments for the algo's Stage 1 ability scoring and Stage 2 MC sims.
 *
 * KEY CD SPRING FACTS:
 *  - Main track (dirt): speed/inside favored in sprints when rail at 0-3 ft
 *    When rail moves to 5+ ft, posts 4-6 gain and outside becomes viable
 *  - Turf: CD uses a rotating inner/outer course. Inner course = shorter circumference,
 *    outside posts (#7+) are badly disadvantaged in 1-turn races.
 *    Outer course = more room, outside posts manageable.
 *  - Derby week: track plays fast, speed bias elevated on main track
 *  - Mud bias: CD main track historically favors late-pace horses in slop/mud
 */

export const CD_CONTEXT = `
Churchill Downs Spring Meet 2026
Track: CD | Dates: Late April - May 3 (Derby Day)
Location: Louisville, KY

DIRT TRACK:
- Rail at 0-3 ft: Inside posts 1-3 strongly favored in sprints (6f, 7f)
  Post 1-3 IV: ~1.5-1.8 in dry/fast conditions
  Post 8+ IV: ~0.6-0.7
- Rail at 5 ft: Outside posts 4-6 competitive, inside disadvantaged (water)
  Post 4-7 IV flips to ~1.1-1.2, inside drops to ~0.9
- Routes (1m+): Post position less decisive. Front-runners tested by long run to first turn.
  Post 1 historically strong in 1-turn dirt routes.
- Speed bias in dry: E/EP style IV ~1.4-1.7 in sprints; ~1.1 in routes
- Mud/slop: Stalkers/closers get huge boost (+0.6 to +0.8); E/EP fades (-0.5)

TURF:
- Inner course: Posts 7+ severely penalized (-0.5 to -0.7). Prefer 1-5 rail.
  Inside post IV: ~1.4+. Outside post IV: ~0.4
- Outer course: More forgiving. Posts 1-3 slight edge but not extreme.
- EP/P styles favor turf routes; E-speed rarely wins off grass at CD
- Late-running S/C horses can fire big on firm turf in routes

KEY TRAINERS (Spring meet):
- Todd Pletcher: ~30% win rate, strong with 2yo debuts and turf routes
- Brad Cox (local advantage): ~28% win rate, excellent dirt routes
- Steve Asmussen: ~22% win rate, value in claiming/allowance races
- Chad Brown: ~35% on turf, lighter presence but dominant when entered

JOCKEY NOTES (Spring meet):
- Brian Hernandez Jr (local rider): Excellent CD knowledge, ~24% strike rate
- Joel Rosario: Premier jockey when available, ~28% at CD spring
- Irad Ortiz Jr: High percentage, comes for big races

SURFACE SWITCH PENALTY:
- First-time turf runners: Apply -0.3 to pace adj unless confirmed "turf breeding"
- Dirt→Turf for a second attempt: No penalty if ran within 5% of career best on turf
- Turf→Dirt switch: Minimal penalty if dam is dirt-bred; -0.2 if pure turf pedigree

POST-POSITION IV (default, rail at 0-3 ft):
Sprints (≤7f):
  post1to3IV: 1.55, post4to7IV: 1.0, post8plusIV: 0.62
Routes (>7f):
  post1to3IV: 1.25, post4to7IV: 1.0, post8plusIV: 0.78

RUNNING STYLE IV (dirt sprints, dry):
  eIV: 1.45, epIV: 1.60, pIV: 0.65, sIV: 0.35

RUNNING STYLE IV (dirt routes, dry):
  eIV: 1.10, epIV: 1.20, pIV: 0.90, sIV: 0.80

RUNNING STYLE IV (turf routes, firm):
  eIV: 0.55, epIV: 1.35, pIV: 1.25, sIV: 0.85
`;

/**
 * Churchill Downs default trackBias objects by distance/surface
 * Use these when no daily bias data is available.
 * Update daily from track superintendent rail position report.
 */
export type TrackBias = {
  surface: string;
  distanceLabel: string;
  speedBiasPct: number;
  railBias: string; // "+", "0", "-" or "5" (5ft out)
  eIV: number;
  epIV: number;
  pIV: number;
  sIV: number;
  post1to3IV: number;
  post4to7IV: number;
  post8plusIV: number;
};

export const CD_DEFAULT_BIASES: Record<string, TrackBias> = {
  "dirt-sprint": {
    surface: "Dirt",
    distanceLabel: "6.0f",
    speedBiasPct: 85,
    railBias: "+",
    eIV: 1.45,
    epIV: 1.60,
    pIV: 0.65,
    sIV: 0.35,
    post1to3IV: 1.55,
    post4to7IV: 1.0,
    post8plusIV: 0.62,
  },
  "dirt-route": {
    surface: "Dirt",
    distanceLabel: "8.5f",
    speedBiasPct: 62,
    railBias: "+",
    eIV: 1.10,
    epIV: 1.20,
    pIV: 0.90,
    sIV: 0.80,
    post1to3IV: 1.25,
    post4to7IV: 1.0,
    post8plusIV: 0.78,
  },
  "turf-inner-sprint": {
    surface: "Turf",
    distanceLabel: "5.5f",
    speedBiasPct: 55,
    railBias: "+",
    eIV: 0.55,
    epIV: 1.60,
    pIV: 1.20,
    sIV: 0.65,
    post1to3IV: 1.55,
    post4to7IV: 0.90,
    post8plusIV: 0.40,
  },
  "turf-inner-route": {
    surface: "Turf",
    distanceLabel: "routes",
    speedBiasPct: 45,
    railBias: "+",
    eIV: 0.55,
    epIV: 1.35,
    pIV: 1.25,
    sIV: 0.85,
    post1to3IV: 1.40,
    post4to7IV: 0.95,
    post8plusIV: 0.42,
  },
};

/**
 * CD-specific condition adjustment — mirrors keenelandConditionAdj pattern.
 * Called in Stage 1 scoring when track === 'CD'.
 *
 * @param entries - Filtered (non-scratched) horse entries
 * @param raceInfo - Race metadata including surface, distance, condition
 * @returns Per-horse adjustment multipliers to add to ability scores
 */
export function churchillConditionAdj(
  entries: Array<{ style?: string; pp?: number; isClassDrop?: boolean; daysSinceLast?: number; last3Beyer?: number[] }>,
  raceInfo: { surface?: string; distance?: string; condition?: string; trackBias?: TrackBias }
): number[] {
  const tb = raceInfo.trackBias;
  if (!tb) return entries.map(() => 0);

  const surface = (raceInfo.surface ?? "").toLowerCase();
  const isDirt = surface.includes("dirt");
  const condition = (raceInfo.condition ?? "").toLowerCase();
  const isWetTrack = ["muddy", "sloppy", "good", "yielding", "soft"].some((c) =>
    condition.includes(c)
  );

  return entries.map((e) => {
    let adj = 0;
    const style = (e.style ?? "P").toUpperCase();
    const pp = Number(e.pp ?? 0);

    // Style vs track bias
    const styleIV =
      style === "E"
        ? tb.eIV
        : style === "EP"
        ? tb.epIV
        : style === "P"
        ? tb.pIV
        : tb.sIV;
    adj += Math.max(-0.5, Math.min(0.6, (styleIV - 1) * 0.35));

    // Post position bias (using provided IVs)
    const postIV =
      pp <= 3 ? tb.post1to3IV : pp <= 7 ? tb.post4to7IV : tb.post8plusIV;
    adj += 0.5 * Math.max(-0.5, Math.min(0.6, (postIV - 1) * 0.3));

    // Wet-track bonus for closers / penalty for speed on dirt
    if (isDirt && isWetTrack) {
      if (["S", "C"].includes(style)) adj += 0.55;
      else if (["E", "EP"].includes(style)) adj -= 0.45;
    }

    return adj;
  });
}

/**
 * Returns appropriate CD default bias for a given race.
 * Falls back to generic dirt-route if no match.
 */
export function getCDTrackBias(
  surface: string,
  distance: string
): TrackBias {
  const isDirt = surface.toLowerCase().includes("dirt");
  const furlongs = parseFurlongs(distance);
  const isSprint = furlongs <= 7;

  if (isDirt && isSprint) return CD_DEFAULT_BIASES["dirt-sprint"];
  if (isDirt && !isSprint) return CD_DEFAULT_BIASES["dirt-route"];
  if (!isDirt && isSprint) return CD_DEFAULT_BIASES["turf-inner-sprint"];
  return CD_DEFAULT_BIASES["turf-inner-route"];
}

function parseFurlongs(distance: string): number {
  const d = distance.toLowerCase();
  const fMatch = d.match(/([\d.]+)\s*furlong/);
  if (fMatch) return parseFloat(fMatch[1]);
  const frMatch = d.match(/(\d+)\s+(\d+)\/(\d+)\s*mile/);
  if (frMatch)
    return (parseInt(frMatch[1]) + parseInt(frMatch[2]) / parseInt(frMatch[3])) * 8;
  const mMatch = d.match(/([\d.]+)\s*mile/);
  if (mMatch) return parseFloat(mMatch[1]) * 8;
  return 8; // default
}
