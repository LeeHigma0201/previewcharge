"""Big Races page — upcoming race calendar and exotic bet recommendations."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))


def render() -> None:
    st.header("Big Race Exotic Betting")

    from src.races.calendar import BigRaceCalendar

    calendar = BigRaceCalendar()

    # ── Upcoming Races Calendar ──────────────────────────────────────
    st.subheader("Upcoming Races")

    days_ahead = st.sidebar.slider("Days ahead", 7, 180, 60, key="big_days")
    category_filter = st.sidebar.selectbox(
        "Category",
        ["All", "triple_crown", "derby_prep", "championship", "breeders_cup_prep"],
        key="big_cat",
    )

    races = calendar.upcoming(days_ahead=days_ahead)
    if category_filter != "All":
        races = [r for r in races if r.category == category_filter]

    if not races:
        st.info("No upcoming races in this window.")
        return

    import pandas as pd

    cal_data = []
    for r in races:
        cal_data.append({
            "Date": r.date.isoformat(),
            "Days": r.days_until,
            "Grade": r.grade,
            "Race": r.name,
            "Track": r.track_code,
            "Dist": f"{r.distance_furlongs:.1f}f",
            "Surface": r.surface,
            "Purse": f"${r.purse:,}",
            "Category": r.category,
            "Status": r.status,
        })

    cal_df = pd.DataFrame(cal_data)
    st.dataframe(cal_df, use_container_width=True, hide_index=True)

    # ── Triple Crown Spotlight ───────────────────────────────────────
    triple = calendar.triple_crown()
    if triple:
        st.subheader("Triple Crown 2026")
        cols = st.columns(len(triple))
        for col, race in zip(cols, triple):
            with col:
                st.metric(race.name, race.date.strftime("%b %d"), f"{race.days_until}d")
                st.caption(f"{race.grade} | {race.track_code} | {race.distance_furlongs:.1f}f")

    # ── Race Analysis ────────────────────────────────────────────────
    st.subheader("Analyze Race")

    race_options = {r.name: r.slug for r in races}
    selected_name = st.selectbox("Select race:", list(race_options.keys()), key="big_select")

    if selected_name and st.button("Run Exotic Analysis", key="big_analyze"):
        selected = calendar.get_by_slug(race_options[selected_name])
        if selected is None:
            st.error("Race not found.")
            return

        st.info(f"Analyzing **{selected.name}** ({selected.grade}, {selected.track_code}, {selected.date})...")

        try:
            from config.settings import Settings
            from src.data.database import get_engine, get_session
            from src.data.models import Race
            from src.features.core import compute_race_features
            from src.models.exotic_engine import ExoticEngine
            from src.models.monte_carlo import henery_simulate

            settings = Settings.load()
            engine = get_engine(settings)
            session = get_session(engine)

            db_race = (
                session.query(Race)
                .filter_by(track_code=selected.track_code, race_date=selected.date)
                .first()
            )

            if db_race is None or not db_race.entries:
                st.warning(
                    f"No field data for this race yet. "
                    f"Add data via `data/scraped/{selected.slug}.json` or `make scrape`."
                )
                session.close()
                return

            entries = sorted(db_race.entries, key=lambda e: e.post_position)
            horse_names = [e.horse.name if e.horse else f"#{e.program_number}" for e in entries]

            ml_odds = np.array([e.morning_line_odds or 5.0 for e in entries])
            ml_probs = 1.0 / (ml_odds + 1.0)
            ml_probs = ml_probs / ml_probs.sum()

            mc_sims = settings.exotic.big_race_mc_iterations
            sim = henery_simulate(
                ml_probs,
                n_simulations=mc_sims,
                seed=42,
                superfecta=True,
                superfecta_threshold=settings.exotic.superfecta_prob_threshold,
            )

            # Win probabilities table
            st.subheader("Win Probabilities")
            prob_df = pd.DataFrame({
                "Horse": horse_names,
                "ML Odds": ml_odds,
                "Win %": sim.win_probs * 100,
                "Place %": sim.place_probs * 100,
                "Show %": sim.show_probs * 100,
            }).sort_values("Win %", ascending=False)
            st.dataframe(
                prob_df.style.format({"Win %": "{:.1f}", "Place %": "{:.1f}", "Show %": "{:.1f}"}),
                use_container_width=True,
            )

            # Exotic engine
            exotic = ExoticEngine(
                sim=sim,
                horse_names=horse_names,
                morning_line_odds=ml_odds.tolist(),
                bankroll=settings.exotic.default_bankroll,
                takeout=settings.model.exotic_pool_takeout,
                kelly_fraction=settings.model.kelly_fraction,
                min_ev=settings.model.min_overlay_ev,
            )

            rec = exotic.full_recommendation(race_slug=selected.slug, race_name=selected.name)

            # Show recommendations
            for bet in rec.bets:
                st.subheader(f"{bet.bet_type.upper()} Ticket")
                st.write(f"**{bet.ticket_structure}**")
                st.write(f"Cost: ${bet.cost:.2f} | Hit prob: {bet.probability:.2%} | EV: {bet.expected_value:.2f}")

                combo_data = []
                for combo in bet.combinations[:10]:
                    names = [horse_names[i] for i in combo]
                    combo_data.append({"Combination": " / ".join(names)})
                if combo_data:
                    st.dataframe(pd.DataFrame(combo_data), use_container_width=True, hide_index=True)

            st.success(f"Total ticket cost: ${rec.total_cost:.2f}")
            session.close()

        except Exception as e:
            st.error(f"Analysis failed: {e}")
