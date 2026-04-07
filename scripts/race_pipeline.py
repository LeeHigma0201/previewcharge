"""Big Race Pipeline — end-to-end analysis for major stakes races.

Scrapes (or loads) field data, ingests into DB, computes features,
runs models, and generates exotic bet recommendations.

Usage:
    python scripts/race_pipeline.py --race kentucky-derby-2026
    python scripts/race_pipeline.py --next
    python scripts/race_pipeline.py --upcoming 30
    python scripts/race_pipeline.py --list
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

import numpy as np

# Ensure project root is in path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.settings import Settings
from src.races.calendar import BigRace, BigRaceCalendar


def list_upcoming(calendar: BigRaceCalendar, days: int = 90) -> None:
    """Print upcoming big races."""
    races = calendar.upcoming(days_ahead=days)
    if not races:
        print(f"No upcoming races in the next {days} days.")
        return

    print(f"\n{'='*80}")
    print(f"  UPCOMING BIG RACES (next {days} days)")
    print(f"{'='*80}")
    print(f"{'Date':<14} {'Grade':<5} {'Race':<35} {'Track':<6} {'Status':<15}")
    print(f"{'-'*80}")

    for race in races:
        days_until = race.days_until
        status = race.status
        if days_until <= 3:
            status = f"{status} ({days_until}d)"
        print(f"{race.date.isoformat():<14} {race.grade:<5} {race.name:<35} {race.track_code:<6} {status:<15}")

    print(f"\nTotal: {len(races)} races")
    triple = calendar.triple_crown()
    if triple:
        print(f"Triple Crown: {', '.join(f'{r.name} ({r.date.isoformat()})' for r in triple)}")
    print()


def analyze_race(race: BigRace, settings: Settings, bankroll: float = 1000.0) -> None:
    """Run the full prediction pipeline for a single big race."""
    from src.data.database import create_tables, get_engine, get_session
    from src.data.models import Entry, Race
    from src.features.core import compute_race_features
    from src.models.exotic_engine import ExoticEngine
    from src.models.monte_carlo import henery_simulate

    print(f"\n{'='*70}")
    print(f"  {race.name} — {race.grade} | {race.track_code} | {race.date.isoformat()}")
    print(f"  {race.distance_yards}y ({race.distance_furlongs:.1f}f) | {race.surface} | ${race.purse:,}")
    print(f"  {race.conditions} | Exotics: {', '.join(race.exotic_pools)}")
    if race.notes:
        print(f"  Notes: {race.notes}")
    print(f"{'='*70}\n")

    engine = get_engine(settings)
    create_tables(engine)
    session = get_session(engine)

    try:
        # Look up race in DB
        db_race = (
            session.query(Race)
            .filter_by(
                track_code=race.track_code,
                race_date=race.date,
            )
            .first()
        )

        if db_race is None:
            # Try to load from scraped JSON
            scraped_path = Path(f"data/scraped/{race.slug}.json")
            if scraped_path.exists():
                print(f"Loading field from {scraped_path}...")
                _ingest_scraped_race(session, scraped_path, race)
                session.commit()
                db_race = (
                    session.query(Race)
                    .filter_by(track_code=race.track_code, race_date=race.date)
                    .first()
                )

        if db_race is None:
            print("ERROR: No field data available for this race.")
            print(f"  To add field data, create: data/scraped/{race.slug}.json")
            print("  Or run: make scrape TRACK={} DATE={}".format(race.track_code, race.date))
            print()
            print("  JSON format:")
            print('  {"track_code": "CD", "race_date": "2026-05-02", "races": [{"race_number": 11, ...}]}')
            return

        if not db_race.entries:
            print("ERROR: Race found but no entries. Check ingestion.")
            return

        entries = sorted(db_race.entries, key=lambda e: e.post_position)
        horse_names = [e.horse.name if e.horse else f"#{e.program_number}" for e in entries]
        n_horses = len(entries)

        print(f"Field: {n_horses} horses")
        for e in entries:
            name = e.horse.name if e.horse else f"#{e.program_number}"
            ml = e.morning_line_odds or 5.0
            jockey = e.jockey or "TBD"
            trainer = e.trainer or "TBD"
            print(f"  #{e.program_number:<3} {name:<25} ML: {ml:>5.1f}  J: {jockey:<20} T: {trainer}")
        print()

        # Compute features
        feature_df = compute_race_features(db_race, session)

        # Win probabilities from morning line (baseline) or model if trained
        ml_odds = np.array([e.morning_line_odds or 5.0 for e in entries])
        ml_probs = 1.0 / (ml_odds + 1.0)
        ml_probs = ml_probs / ml_probs.sum()

        # Try to load trained model, fall back to morning line
        win_probs = ml_probs
        model_source = "morning line"

        model_path = Path("artifacts/logistic.pkl")
        if model_path.exists() and not feature_df.empty:
            try:
                from src.features.pipeline import get_feature_columns
                from src.models.logistic import BenterLogisticModel

                model = BenterLogisticModel.load(model_path)
                feat_cols = get_feature_columns(feature_df)
                X = feature_df[feat_cols]
                win_probs = model.predict_proba(X, ml_odds)
                model_source = "Benter logistic"
            except Exception as e:
                print(f"  Model loading failed ({e}), using morning line baseline.")

        print(f"Probabilities source: {model_source}")

        # Monte Carlo simulation (big race = more sims + superfecta)
        mc_iters = settings.exotic.big_race_mc_iterations
        print(f"Running Monte Carlo simulation ({mc_iters:,} iterations)...")

        sim = henery_simulate(
            win_probs,
            n_simulations=mc_iters,
            seed=42,
            superfecta=True,
            superfecta_threshold=settings.exotic.superfecta_prob_threshold,
        )

        # Generate exotic recommendations
        exotic = ExoticEngine(
            sim=sim,
            horse_names=horse_names,
            morning_line_odds=ml_odds.tolist(),
            bankroll=bankroll,
            takeout=settings.model.exotic_pool_takeout,
            kelly_fraction=settings.model.kelly_fraction,
            min_ev=settings.model.min_overlay_ev,
        )

        # Print full report
        print()
        print(exotic.print_report())

        # Generate and print recommendation
        rec = exotic.full_recommendation(race_slug=race.slug, race_name=race.name)
        print(rec.summary)

        # Save recommendation to JSON
        rec_dir = Path("data/recommendations")
        rec_dir.mkdir(parents=True, exist_ok=True)
        rec_file = rec_dir / f"{race.slug}.json"
        _save_recommendation(rec, rec_file)
        print(f"Recommendation saved to {rec_file}")

    finally:
        session.close()


def _ingest_scraped_race(session, scraped_path: Path, race: BigRace) -> None:
    """Ingest a scraped JSON file for a specific race."""
    from src.data.ingest import ingest_entry
    from src.data.scrapers.ingest_scraped import _dict_to_card, scraped_to_parsed

    data = json.loads(scraped_path.read_text())
    card = _dict_to_card(data)

    for parsed in scraped_to_parsed(card):
        if parsed.horse_name:
            ingest_entry(session, parsed)


def _save_recommendation(rec, path: Path) -> None:
    """Save recommendation as JSON."""
    data = {
        "race_slug": rec.race_slug,
        "race_name": rec.race_name,
        "bankroll": rec.bankroll,
        "win_probs": rec.win_probs,
        "market_probs": rec.market_probs,
        "total_cost": rec.total_cost,
        "bets": [
            {
                "bet_type": b.bet_type,
                "combinations": [list(c) for c in b.combinations],
                "cost": b.cost,
                "probability": b.probability,
                "expected_value": b.expected_value,
                "kelly_stake": b.kelly_stake,
                "horses_used": {str(k): v for k, v in b.horses_used.items()},
                "ticket_structure": b.ticket_structure,
            }
            for b in rec.bets
        ],
        "summary": rec.summary,
    }
    path.write_text(json.dumps(data, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Big Race Exotic Betting Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/race_pipeline.py --list
  python scripts/race_pipeline.py --upcoming 30
  python scripts/race_pipeline.py --next
  python scripts/race_pipeline.py --race kentucky-derby-2026
  python scripts/race_pipeline.py --race kentucky-derby-2026 --bankroll 500
        """,
    )
    parser.add_argument("--race", type=str, help="Race slug to analyze (e.g. kentucky-derby-2026)")
    parser.add_argument("--next", action="store_true", help="Analyze the next upcoming race")
    parser.add_argument("--upcoming", type=int, nargs="?", const=30, help="List upcoming races (default 30 days)")
    parser.add_argument("--list", action="store_true", help="List all races in calendar")
    parser.add_argument("--bankroll", type=float, default=1000.0, help="Bankroll for bet sizing (default $1000)")
    parser.add_argument("--category", type=str, help="Filter by category (triple_crown, derby_prep, championship)")

    args = parser.parse_args()
    settings = Settings.load()
    calendar = BigRaceCalendar()

    if args.list:
        list_upcoming(calendar, days=365)
        return

    if args.upcoming is not None:
        list_upcoming(calendar, days=args.upcoming)
        return

    if args.next:
        race = calendar.next_race()
        if race is None:
            print("No upcoming races found.")
            return
        analyze_race(race, settings, bankroll=args.bankroll)
        return

    if args.race:
        race = calendar.get_by_slug(args.race)
        if race is None:
            # Try fuzzy match
            race = calendar.resolve_named_race(args.race)
        if race is None:
            print(f"Race '{args.race}' not found in calendar.")
            print("Available races:")
            for r in calendar.races:
                print(f"  {r.slug}")
            return
        analyze_race(race, settings, bankroll=args.bankroll)
        return

    # Default: list upcoming
    list_upcoming(calendar, days=30)


if __name__ == "__main__":
    main()
