"""Live odds scraper and polling pipeline.

Polls odds from a free source every 5 minutes in the 30 minutes
before post time. Stores snapshots in the OddsSnapshot table.

The latest snapshot feeds the PDS (Probability Displacement Score)
calculation at post time, allowing the model to react to late
money moves that signal insider information.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.data.models import OddsSnapshot

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore[assignment]


class LiveOddsSource(ABC):
    """Abstract base for live odds data sources."""

    @abstractmethod
    def fetch_odds(
        self, track_code: str, race_number: int
    ) -> list[dict]:
        """Fetch current odds for a race.

        Returns:
            List of dicts with keys:
                program_number: str
                win_odds: float
                exacta_probable: dict | None
                trifecta_probable: dict | None
        """


class EquibaseLiveOdds(LiveOddsSource):
    """Scrape live odds from Equibase.

    Follows the same httpx + retry pattern as the other Equibase scrapers.
    """

    REQUEST_DELAY = 1.5
    MAX_RETRIES = 3

    def fetch_odds(
        self, track_code: str, race_number: int
    ) -> list[dict]:
        """Fetch live odds from Equibase odds page.

        Returns list of per-horse odds dicts.
        """
        if httpx is None:
            raise ImportError("httpx is required for live odds scraping")

        url = (
            f"https://www.equibase.com/static/chart/odds/"
            f"{track_code}-{race_number}.html"
        )

        for attempt in range(self.MAX_RETRIES):
            try:
                with httpx.Client(
                    timeout=10.0,
                    follow_redirects=True,
                    headers={"User-Agent": "HorseGPT/3.14"},
                ) as client:
                    resp = client.get(url)
                    resp.raise_for_status()
                    return self._parse_odds_html(resp.text)
            except (httpx.HTTPError, httpx.TimeoutException):
                if attempt == self.MAX_RETRIES - 1:
                    raise
                import time
                time.sleep(2 ** (attempt + 1))

        return []

    def _parse_odds_html(self, html: str) -> list[dict]:
        """Parse odds from HTML response.

        This is a basic parser — real implementation would use selectolax
        to extract structured odds data from the Equibase page.
        """
        # Placeholder: production implementation would parse actual HTML
        return []


def poll_odds(
    session: Session,
    race_id: int,
    track_code: str,
    race_number: int,
    source: LiveOddsSource | None = None,
) -> list[OddsSnapshot]:
    """Poll live odds and store snapshots.

    Args:
        session: Database session.
        race_id: Race ID in the database.
        track_code: Track code (e.g., "SAR").
        race_number: Race number.
        source: Odds data source. Defaults to EquibaseLiveOdds.

    Returns:
        List of OddsSnapshot objects created.
    """
    if source is None:
        source = EquibaseLiveOdds()

    odds_data = source.fetch_odds(track_code, race_number)
    now = datetime.utcnow()
    snapshots = []

    for entry in odds_data:
        snapshot = OddsSnapshot(
            race_id=race_id,
            timestamp=now,
            program_number=entry["program_number"],
            win_odds=entry.get("win_odds"),
            exacta_probable=entry.get("exacta_probable"),
            trifecta_probable=entry.get("trifecta_probable"),
        )
        session.add(snapshot)
        snapshots.append(snapshot)

    session.flush()
    return snapshots


def get_latest_odds(
    session: Session,
    race_id: int,
) -> list[OddsSnapshot]:
    """Get the most recent odds snapshot for a race.

    Returns all OddsSnapshot rows sharing the most recent timestamp
    for the given race_id.
    """
    # Find the max timestamp for this race
    max_ts = (
        session.query(func.max(OddsSnapshot.timestamp))
        .filter(OddsSnapshot.race_id == race_id)
        .scalar()
    )

    if max_ts is None:
        return []

    return (
        session.query(OddsSnapshot)
        .filter(
            OddsSnapshot.race_id == race_id,
            OddsSnapshot.timestamp == max_ts,
        )
        .all()
    )
