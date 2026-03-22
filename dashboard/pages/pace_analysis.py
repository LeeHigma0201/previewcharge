"""Pace Analysis page — visualize pace scenarios and their impact."""

from __future__ import annotations

import sys
from pathlib import Path

import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))


def render() -> None:
    st.header("Pace Scenario Analysis")

    col1, col2, col3 = st.columns(3)
    with col1:
        track = st.text_input("Track Code", value="SAR", max_chars=5, key="pace_track")
    with col2:
        race_date = st.date_input("Race Date", key="pace_date")
    with col3:
        race_num = st.number_input("Race Number", min_value=1, max_value=15, value=1, key="pace_race")

    if st.button("Analyze Pace", key="pace_analyze"):
        try:
            from config.settings import Settings
            from src.data.database import get_engine, get_session
            from src.data.models import Race
            from src.longshot.pace_scenarios import classify_pace_scenario, estimate_pace_impact

            settings = Settings.load()
            engine = get_engine(settings)
            session = get_session(engine)

            race = (
                session.query(Race)
                .filter_by(track_code=track, race_date=race_date, race_number=race_num)
                .first()
            )

            if race is None:
                st.warning("Race not found.")
                return

            entries = sorted(race.entries, key=lambda e: e.post_position)
            scenario = classify_pace_scenario(entries)

            # Scenario summary
            st.subheader("Pace Scenario")
            scenario_colors = {
                "speed_duel": "red",
                "contested_pace": "orange",
                "lone_speed": "green",
                "no_speed": "blue",
            }
            color = scenario_colors.get(scenario["scenario"], "gray")
            st.markdown(f"**Scenario:** :{color}[{scenario['scenario'].replace('_', ' ').title()}]")
            st.markdown(f"**Pace Pressure:** {scenario['pace_pressure'].title()}")

            col_a, col_b, col_c = st.columns(3)
            col_a.metric("Early Speed", scenario["early_count"])
            col_b.metric("Pressers", scenario["presser_count"])
            col_c.metric("Closers", scenario["closer_count"])

            # Pace impact per horse
            st.subheader("Pace Impact by Horse")
            impacts = estimate_pace_impact(entries)

            import pandas as pd
            impact_rows = []
            for entry in entries:
                impact_rows.append({
                    "PP": entry.post_position,
                    "Horse": entry.horse.name if entry.horse else "?",
                    "Style": entry.running_style or "?",
                    "E1 Pace": entry.bris_pace_e1 or "",
                    "Late Pace": entry.bris_late_pace or "",
                    "Pace Adj": f"{impacts.get(entry.id, 1.0):.2f}",
                    "Benefit": "+" if impacts.get(entry.id, 1.0) > 1.0 else "-" if impacts.get(entry.id, 1.0) < 1.0 else "=",
                })
            st.dataframe(pd.DataFrame(impact_rows), use_container_width=True)

            session.close()

        except Exception as ex:
            st.error(f"Error: {ex}")
