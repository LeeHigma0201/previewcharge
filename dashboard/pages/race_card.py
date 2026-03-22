"""Race Card page — view entries, past performances, and race conditions."""

from __future__ import annotations

import sys
from pathlib import Path

import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))


def render() -> None:
    st.header("Race Card")

    col1, col2, col3 = st.columns(3)
    with col1:
        track = st.text_input("Track Code", value="SAR", max_chars=5)
    with col2:
        race_date = st.date_input("Race Date")
    with col3:
        race_num = st.number_input("Race Number", min_value=1, max_value=15, value=1)

    if st.button("Load Race"):
        try:
            from config.settings import Settings
            from src.data.database import get_engine, get_session
            from src.data.models import Entry, Race

            settings = Settings.load()
            engine = get_engine(settings)
            session = get_session(engine)

            race = (
                session.query(Race)
                .filter_by(track_code=track, race_date=race_date, race_number=race_num)
                .first()
            )

            if race is None:
                st.warning("Race not found in database.")
                return

            st.subheader(f"Race {race.race_number} — {race.track_code} {race.race_date}")
            st.markdown(
                f"**{race.race_type}** | {race.distance_yards} yards | "
                f"{race.surface} | Purse: ${race.purse:,} | "
                f"Condition: {race.track_condition or 'N/A'}"
            )

            # Display entries
            entries = sorted(race.entries, key=lambda e: e.post_position)
            rows = []
            for e in entries:
                rows.append({
                    "PP": e.post_position,
                    "#": e.program_number,
                    "Horse": e.horse.name if e.horse else "?",
                    "Jockey": e.jockey or "",
                    "Trainer": e.trainer or "",
                    "ML": e.morning_line_odds or 0,
                    "Style": e.running_style or "",
                    "Speed": e.bris_speed or "",
                    "E1": e.bris_pace_e1 or "",
                    "LP": e.bris_late_pace or "",
                })

            import pandas as pd
            st.dataframe(pd.DataFrame(rows), use_container_width=True)

            session.close()

        except Exception as ex:
            st.error(f"Error loading race: {ex}")
