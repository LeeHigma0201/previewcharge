"""Predictions page — model probabilities and exotic bet recommendations."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))


def render() -> None:
    st.header("Model Predictions & Exotic Bets")

    col1, col2, col3 = st.columns(3)
    with col1:
        track = st.text_input("Track Code", value="SAR", max_chars=5, key="pred_track")
    with col2:
        race_date = st.date_input("Race Date", key="pred_date")
    with col3:
        race_num = st.number_input("Race Number", min_value=1, max_value=15, value=1, key="pred_race")

    mc_sims = st.sidebar.slider("Monte Carlo Simulations", 10000, 500000, 100000, step=10000)

    if st.button("Analyze Race", key="analyze"):
        try:
            from config.settings import Settings
            from src.data.database import get_engine, get_session
            from src.data.models import Entry, Race
            from src.features.core import compute_race_features
            from src.models.monte_carlo import henery_simulate

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

            # Compute features
            feature_df = compute_race_features(race, session)
            if feature_df.empty:
                st.warning("No feature data available.")
                return

            entries = sorted(race.entries, key=lambda e: e.post_position)
            horse_names = [e.horse.name if e.horse else f"#{e.program_number}" for e in entries]

            # Use morning line as baseline probabilities
            ml_odds = np.array([e.morning_line_odds or 5.0 for e in entries])
            ml_probs = 1.0 / (ml_odds + 1.0)
            ml_probs = ml_probs / ml_probs.sum()

            # Monte Carlo simulation
            sim = henery_simulate(ml_probs, n_simulations=mc_sims)

            # Win probabilities
            st.subheader("Win Probabilities")
            import pandas as pd
            prob_df = pd.DataFrame({
                "Horse": horse_names,
                "ML Odds": ml_odds,
                "Win %": sim.win_probs * 100,
                "Place %": sim.place_probs * 100,
                "Show %": sim.show_probs * 100,
            }).sort_values("Win %", ascending=False)
            st.dataframe(prob_df.style.format({"Win %": "{:.1f}", "Place %": "{:.1f}", "Show %": "{:.1f}"}),
                        use_container_width=True)

            # Top exacta combinations
            st.subheader("Top 10 Exacta Probabilities")
            n = len(entries)
            exacta_rows = []
            for i in range(n):
                for j in range(n):
                    if i != j and sim.exacta_probs[i, j] > 0.01:
                        exacta_rows.append({
                            "1st": horse_names[i],
                            "2nd": horse_names[j],
                            "Prob %": sim.exacta_probs[i, j] * 100,
                        })
            exacta_df = pd.DataFrame(exacta_rows).sort_values("Prob %", ascending=False).head(10)
            st.dataframe(exacta_df.style.format({"Prob %": "{:.2f}"}), use_container_width=True)

            # Top trifecta combinations
            st.subheader("Top 10 Trifecta Probabilities")
            tri_rows = []
            for i in range(n):
                for j in range(n):
                    if j == i:
                        continue
                    for k in range(n):
                        if k == i or k == j:
                            continue
                        p = sim.trifecta_probs[i, j, k]
                        if p > 0.005:
                            tri_rows.append({
                                "1st": horse_names[i],
                                "2nd": horse_names[j],
                                "3rd": horse_names[k],
                                "Prob %": p * 100,
                            })
            tri_df = pd.DataFrame(tri_rows).sort_values("Prob %", ascending=False).head(10)
            st.dataframe(tri_df.style.format({"Prob %": "{:.3f}"}), use_container_width=True)

            session.close()

        except Exception as ex:
            st.error(f"Error: {ex}")
            import traceback
            st.code(traceback.format_exc())
