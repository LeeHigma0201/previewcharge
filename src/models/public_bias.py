"""Public-Money Bias Model — scores how much each horse will be over- or under-bet
by casual money relative to its true win probability.

Why this matters:
    The Kentucky Derby is the largest-pool race of the year and the highest
    dumb-money percentage. Casual bettors don't read past performances; they
    bet on:
      - Color (gray > everything else)
      - Name fluency (rhyming, pop-culture, aspirational)
      - Trainer/jockey star power (Baffert, Velazquez, Ortiz)
      - Sire name recognition (Tapit, Curlin, Into Mischief)
      - Story narratives ("oldest jockey," "first female trainer," "Cinderella")
      - Post superstition (post 5 = magic, post 1 = death)
      - AI consensus (ChatGPT/TwinSpires AI all picking same horse compresses the price)

    Each of those creates pool inflation that shows up as the horse's tote odds
    being LOWER than its true win probability would warrant. That's the trap.
    Conversely, horses with no story / boring name / unfamiliar trainer get
    UNDER-bet — that's the overlay.

How v3+ uses this:
    public_bias_score: 0-20 scale
    PUBLIC_TRAP if score >= 12 AND ml_odds < 10.0
    PUBLIC_OVERLAY if score <= 4 AND ml_odds >= 15.0
    CONSENSUS_TRAP if horse is on 3+ AI/expert "consensus pick" lists

Honesty contract:
    All inputs are explicit (color, name, trainer, jockey, sire, post). No
    inference of stats. The output is a public-tilt prediction, not a
    win-probability adjustment — it's a separate signal that gets layered
    on top of the algo's win prob.

References:
    - Renascence: fluency heuristic in judgment under cognitive ease
    - PubMed: cognitive biases in gambling (favorite-longshot bias)
    - Daily Gazette: "Want to bet the gray in the 2026 Kentucky Derby?"
    - Yahoo: AI Derby simulation — public follows AI consensus
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


# -- Star-power lookup tables (curated; based on 2026 Derby research brief) --

# Trainer star-power (0-3): NBC/ESPN-name recognition that drives casual money
TRAINER_STAR = {
    "Bob Baffert": 3,
    "Todd A. Pletcher": 3,
    "Todd Pletcher": 3,
    "Brad H. Cox": 2,
    "Brad Cox": 2,
    "Bill Mott": 2,
    "William Mott": 2,
    "Chad C. Brown": 2,
    "Chad Brown": 2,
    "Steven M. Asmussen": 2,
    "Steve Asmussen": 2,
    "Doug F. O'Neill": 1,
    "Doug O'Neill": 1,
    "D. Wayne Lukas": 2,
    "Cherie DeVaux": 2,    # first female trainer narrative
    "Cherie Devaux": 2,
    "Larry Glatt": 1,      # tragedy story stack
    "Mark E. Casse": 1,
    "Saffie A. Joseph Jr.": 1,
}

# Jockey star-power (0-3): household names + this year's narrative-stacked riders
JOCKEY_STAR = {
    "John R. Velazquez": 3,
    "John Velazquez": 3,
    "Irad Ortiz Jr.": 3,
    "Luis Saez": 3,
    "Mike Smith": 3,        # 2026: oldest-winning chase narrative
    "Jose L. Ortiz": 2,
    "Jose Ortiz": 2,
    "Javier Castellano": 2,
    "Flavien Prat": 2,
    "Tyler Gaffalione": 1,
    "Joel Rosario": 2,
    "Brian J. Hernandez Jr.": 1,
    "Junior Alvarado": 1,
    "Manuel Franco": 1,
    "Florent Geroux": 1,
}

# Sire star-power (0-3): bloodstock-aware casual money chases these
SIRE_STAR = {
    "Into Mischief": 3,    # NA #1, 3 Derby wins
    "Tapit": 3,
    "Curlin": 2,
    "American Pharoah": 2,
    "Justify": 2,
    "Authentic": 2,
    "Quality Road": 2,
    "Medaglia d'Oro": 2,
    "Street Sense": 1,
    "Maxfield": 1,         # legitimate but lower recognition
    "Munnings": 1,
    "Bernardini": 1,
    "Speightstown": 1,
    "War Front": 1,
    "Distorted Humor": 1,
    "Uncle Mo": 2,
}

# Names of horses currently appearing in 3+ AI/expert "consensus pick" lists today.
# Source: research brief (FanDuel Research, SBR, ESPN, NBC, Yahoo Sports — 2026 Derby).
CONSENSUS_TRAP_HORSES = {
    "Commandment",        # ChatGPT + Claude sim + CBS + FanDuel + NBC
    "Renegade",           # Most expert columns; post-1 narrative being USED to shorten price
    "Further Ado",        # Velazquez consensus exotics piece
}

# Story-angle modifiers: research brief enumerates this year's narratives
STORY_ANGLES: dict[str, tuple[int, str]] = {
    # name -> (story_score, label)
    "So Happy": (5, "Mike Smith oldest-winning-jockey chase + trainer Glatt tragedy stack"),
    "Golden Tempo": (4, "Cherie DeVaux first-female-Derby-winner narrative — NBC pre-race feature"),
    "Great White": (4, "Gray + late-add scratchee like Rich Strike 2022 + name fluency stack"),
    "Danon Bourbon": (3, "Japan undefeated 3-for-3 / 'homecoming' international story"),
    "Wonder Dean": (2, "Japan secondary international hype"),
    "Renegade": (2, "ML chalk + Pletcher/Ortiz star stack — consensus trap dynamics"),
    "Commandment": (2, "AI consensus #1 — pool compressor"),
    "Pavlovian": (1, "Gray (secondary; Great White soaks the gray narrative)"),
    "Litmus Test": (1, "Baffert name on a longshot"),
}

# Coat colors per Derby horse (best-known from research; absent → assumed bay/dark)
DERBY_COAT_COLORS = {
    "Great White": "GR",       # Gray
    "Pavlovian": "GR",         # Gray
    # Everyone else assumed bay/dark unless explicitly known
}


# -- Public bias scoring --


@dataclass
class PublicBiasScore:
    horse_name: str
    program: str
    color_score: int = 0
    name_fluency_score: int = 0
    trainer_star_score: int = 0
    jockey_star_score: int = 0
    sire_star_score: int = 0
    story_score: int = 0
    post_superstition_score: int = 0
    consensus_trap: bool = False
    total: int = 0
    flag: str = ""           # "PUBLIC_TRAP" / "PUBLIC_OVERLAY" / "CONSENSUS_TRAP" / ""
    rationale: list[str] = field(default_factory=list)


# -- Name fluency: cognitive-ease scoring --


COMMON_GOOD_WORDS = {
    "great", "good", "happy", "win", "winner", "golden", "silver",
    "renegade", "rebel", "commandment", "pharoah", "justice", "victory",
    "thunder", "lightning", "rocket", "ace", "king", "prince", "queen",
    "white", "wonder", "magic", "dream", "fast", "speed", "smart",
    "brave", "bold", "lucky", "champion", "hero", "legend", "true",
    "chief", "captain", "noble", "spirit", "fire", "storm", "lion",
}


def _syllable_count(word: str) -> int:
    """Crude syllable counter using vowel-group heuristic."""
    word = re.sub(r"[^a-z]", "", word.lower())
    if not word:
        return 0
    return max(1, len(re.findall(r"[aeiouy]+", word)))


def name_fluency_score(name: str) -> tuple[int, list[str]]:
    """Score 0-3 for cognitive ease of name + reasons."""
    name_lower = name.lower()
    words = name_lower.split()
    score = 0
    reasons: list[str] = []

    total_syll = sum(_syllable_count(w) for w in words)
    if total_syll <= 4:
        score += 1
        reasons.append(f"easy phonology ({total_syll} syllables)")

    if any(w in COMMON_GOOD_WORDS for w in words):
        score += 1
        matched = [w for w in words if w in COMMON_GOOD_WORDS]
        reasons.append(f"positive-connotation word(s): {','.join(matched)}")

    # Alliteration / repetition
    if len(words) >= 2 and words[0][0] == words[1][0]:
        score += 1
        reasons.append("alliteration")

    return min(score, 3), reasons


# -- Color from PP coat-color text --


def color_score(coat_color_raw: str | None, horse_name: str | None = None) -> tuple[int, str]:
    """Return color_score + label. coat_color_raw is BRIS text like 'Dkbbr', 'Gr/Ro', etc."""
    # Override from research-curated DERBY_COAT_COLORS if available
    if horse_name in DERBY_COAT_COLORS:
        c = DERBY_COAT_COLORS[horse_name]
        if c == "GR":
            return 2, "Gray (high public over-bet — visual salience)"
        if c == "WH":
            return 1, "White / very light"
        return 0, "Bay/dark (no color bias)"

    if not coat_color_raw:
        return 0, "Color unknown"
    s = coat_color_raw.lower()
    if "gr" in s or "ro" in s:
        return 2, "Gray/Roan (high public over-bet)"
    if "wh" in s:
        return 1, "White / palomino"
    return 0, "Bay/dark"


# -- Post superstition --


def post_superstition_score(post: int | None) -> tuple[int, str]:
    if post is None:
        return 0, ""
    if post == 5:
        return 2, "Post 5 is the most-winning Derby post — public over-bets the superstition"
    if post == 8:
        return 1, "Post 8 historically strong — modest public premium"
    if post == 1:
        return -1, "Post 1 carries 'rail curse' narrative — public UNDER-bets (creates overlay)"
    if post == 17:
        return -1, "Post 17 is feared as 'death post' but recent winners came from there — slight overlay"
    if 14 <= post <= 16:
        return -1, "Outside posts mildly feared by casual public"
    return 0, ""


# -- Master scoring --


def score_horse(
    program: str,
    name: str,
    trainer: str | None = None,
    jockey: str | None = None,
    sire: str | None = None,
    coat_color: str | None = None,
    post: int | None = None,
    ml_odds: float | None = None,
) -> PublicBiasScore:
    s = PublicBiasScore(horse_name=name, program=program)

    cs, c_label = color_score(coat_color, horse_name=name)
    s.color_score = cs
    if cs > 0:
        s.rationale.append(c_label)

    nf, nf_reasons = name_fluency_score(name)
    s.name_fluency_score = nf
    if nf > 0:
        s.rationale.append("name fluency: " + "; ".join(nf_reasons))

    if trainer and trainer in TRAINER_STAR:
        s.trainer_star_score = TRAINER_STAR[trainer]
        s.rationale.append(f"trainer star: {trainer} ({s.trainer_star_score})")

    if jockey and jockey in JOCKEY_STAR:
        s.jockey_star_score = JOCKEY_STAR[jockey]
        s.rationale.append(f"jockey star: {jockey} ({s.jockey_star_score})")

    if sire:
        for known_sire, val in SIRE_STAR.items():
            if known_sire.lower() in sire.lower():
                s.sire_star_score = val
                s.rationale.append(f"sire star: {known_sire} ({val})")
                break

    if name in STORY_ANGLES:
        story_pts, story_label = STORY_ANGLES[name]
        s.story_score = story_pts
        s.rationale.append(f"story: {story_label}")

    pps, pps_label = post_superstition_score(post)
    s.post_superstition_score = pps
    if pps_label:
        s.rationale.append(pps_label)

    if name in CONSENSUS_TRAP_HORSES:
        s.consensus_trap = True
        s.rationale.append("AI/expert CONSENSUS pick — pool compressed; overlay gone")

    s.total = (
        s.color_score
        + s.name_fluency_score
        + s.trainer_star_score
        + s.jockey_star_score
        + s.sire_star_score
        + s.story_score
        + s.post_superstition_score
    )

    # Flag classification
    if s.consensus_trap:
        s.flag = "CONSENSUS_TRAP"
    if ml_odds is not None:
        if s.total >= 8 and ml_odds < 10.0:
            # Trap: high public score with low odds means inflated price
            s.flag = "PUBLIC_TRAP"
        elif s.total <= 3 and ml_odds >= 12.0:
            # Overlay: low public score with longer odds means market hasn't found them
            s.flag = "PUBLIC_OVERLAY"

    return s


def adjusted_win_prob(
    raw_win_prob: float, bias_score: PublicBiasScore, gray_haircut: float = 0.18
) -> float:
    """Apply public-bias adjustments to true win probability for tote-context EV."""
    p = raw_win_prob
    # Gray-horse discount (research: 11% ITM rate over 45 starters since 2005)
    if bias_score.color_score >= 2:
        p = p * (1.0 - gray_haircut)
    # Consensus trap: -10% probability adjustment to reflect price compression
    if bias_score.consensus_trap:
        p = p * 0.90
    # Story trap: heavy stack narratives lose ~15% in EV terms because tote
    # is already pricing the narrative
    if bias_score.story_score >= 4 and bias_score.flag == "PUBLIC_TRAP":
        p = p * 0.85
    return max(p, 1e-6)
