"""Web scrapers for free public horse racing data."""

from src.data.scrapers.equibase import ScrapedCard, ScrapedHorse, ScrapedRace
from src.data.scrapers.horseracingnation import scrape_entries as scrape_hrn_entries

__all__ = [
    "ScrapedCard",
    "ScrapedHorse",
    "ScrapedRace",
    "scrape_hrn_entries",
]
