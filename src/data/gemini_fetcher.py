"""Fetch race card data using Gemini API.

Sends a natural language race query to Gemini, which researches the race
and returns structured JSON with horse names, odds, running styles, and
past performance data. This data feeds directly into the Monte Carlo
probability engine.

Requires: GEMINI_API_KEY in .env file or environment variable.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

GEMINI_MODEL = "gemini-2.5-flash"

RACE_DATA_PROMPT = """You are a horse racing data researcher. Given a race query, research and return ONLY factual race card data in JSON format.

QUERY: {query}

Return a JSON object with this exact structure:
{{
  "track_code": "3-letter code (e.g. SAR, CD, GP, BEL, AQU, KEE, DMR)",
  "track_name": "Full track name",
  "race_number": integer,
  "race_date": "YYYY-MM-DD",
  "distance": "e.g. 6f, 1m, 1 1/16m",
  "surface": "Dirt or Turf or Synthetic",
  "race_type": "e.g. ALW, CLM, STK, MSW, MCL, GRD",
  "purse": integer in dollars,
  "horses": [
    {{
      "name": "Horse Name",
      "program_number": "1",
      "post_position": 1,
      "morning_line_odds": 5.0,
      "jockey": "Jockey Name",
      "trainer": "Trainer Name",
      "running_style": "E or EP or P or S or C",
      "weight": 122,
      "last_3_beyer": [85, 82, 88],
      "wins": 3,
      "starts": 10,
      "earnings": 150000
    }}
  ]
}}

IMPORTANT RULES:
- Return ONLY the JSON object, no other text
- Use real, factual data only — do not fabricate horse names or statistics
- morning_line_odds should be decimal (e.g. 5.0 for 5/1, 2.0 for 2/1)
- running_style: E=early speed, EP=early presser, P=presser/stalker, S=sustained closer, C=deep closer
- If you cannot find the exact race, return {{"error": "Race not found: [reason]"}}
- last_3_beyer should be the 3 most recent Beyer Speed Figures (estimate from class level if exact figures unavailable)
"""


@dataclass
class FetchedHorse:
    """Horse data fetched from Gemini."""

    name: str
    program_number: str
    post_position: int
    morning_line_odds: float
    jockey: str = ""
    trainer: str = ""
    running_style: str = "P"
    weight: int = 122
    last_3_beyer: list[int] = field(default_factory=list)
    wins: int = 0
    starts: int = 0
    earnings: int = 0


@dataclass
class FetchedRace:
    """Race card data fetched from Gemini."""

    track_code: str
    track_name: str
    race_number: int
    race_date: str
    distance: str
    surface: str
    race_type: str
    purse: int
    horses: list[FetchedHorse]
    raw_response: str = ""


def fetch_race_data(query: str) -> FetchedRace:
    """Fetch race card data from Gemini API.

    Args:
        query: Natural language race query, e.g. "Saratoga Race 5 today"

    Returns:
        FetchedRace with all horse data.

    Raises:
        ValueError: If Gemini returns an error or invalid data.
        RuntimeError: If GEMINI_API_KEY is not set.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY not found. Add it to .env file:\n"
            "  GEMINI_API_KEY=your_key_here"
        )

    from google import genai

    client = genai.Client(api_key=api_key)

    prompt = RACE_DATA_PROMPT.format(query=query)
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
    )

    raw = response.text.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        lines = raw.split("\n")
        # Remove first and last lines (```json and ```)
        lines = [l for l in lines if not l.strip().startswith("```")]
        raw = "\n".join(lines)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Gemini returned invalid JSON: {e}\nRaw response: {raw[:500]}")

    if "error" in data:
        raise ValueError(f"Gemini could not find the race: {data['error']}")

    horses = []
    for h in data.get("horses", []):
        horses.append(FetchedHorse(
            name=h.get("name", "Unknown"),
            program_number=str(h.get("program_number", "")),
            post_position=int(h.get("post_position", 0)),
            morning_line_odds=float(h.get("morning_line_odds", 5.0)),
            jockey=h.get("jockey", ""),
            trainer=h.get("trainer", ""),
            running_style=h.get("running_style", "P"),
            weight=int(h.get("weight", 122)),
            last_3_beyer=h.get("last_3_beyer", []),
            wins=int(h.get("wins", 0)),
            starts=int(h.get("starts", 0)),
            earnings=int(h.get("earnings", 0)),
        ))

    if not horses:
        raise ValueError("Gemini returned no horses for this race.")

    return FetchedRace(
        track_code=data.get("track_code", "UNK"),
        track_name=data.get("track_name", ""),
        race_number=int(data.get("race_number", 0)),
        race_date=data.get("race_date", ""),
        distance=data.get("distance", ""),
        surface=data.get("surface", ""),
        race_type=data.get("race_type", ""),
        purse=int(data.get("purse", 0)),
        horses=horses,
        raw_response=raw,
    )


def fetched_to_win_probs(race: FetchedRace) -> tuple[list[str], list[str], list[float]]:
    """Convert fetched race data to model inputs.

    Returns:
        (horse_names, program_numbers, morning_line_implied_probs)
    """
    import numpy as np

    names = [h.name for h in race.horses]
    programs = [h.program_number for h in race.horses]
    odds = np.array([h.morning_line_odds for h in race.horses])
    probs = 1.0 / (odds + 1.0)
    probs = probs / probs.sum()  # normalize to sum to 1
    return names, programs, probs.tolist()
