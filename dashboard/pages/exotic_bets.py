"""Exotic Bets page — query a race, run the model, see ranked exotic bets."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))


def render() -> None:
    st.header("Exotic Bet Engine")
    st.caption("Enter a race query. Gemini researches the race. Math models compute every exotic combo.")

    # --- Race Query Input ---
    query = st.text_input(
        "Race Query",
        placeholder="e.g. Churchill Downs Race 5 today, Belmont Race 8 June 14, Saratoga R3 tomorrow",
        key="race_query",
    )

    col1, col2 = st.columns([1, 1])
    with col1:
        mc_sims = st.number_input("Monte Carlo Sims", min_value=10000, max_value=500000, value=100000, step=10000, key="mc_sims")
    with col2:
        max_combos = st.number_input("Max combos per type", min_value=10, max_value=200, value=50, step=10, key="max_combos")

    if st.button("Run Model", key="run_model", type="primary"):
        if not query.strip():
            st.warning("Enter a race query above.")
            return
        _run_analysis(query.strip(), int(mc_sims), int(max_combos))


def _run_analysis(query: str, mc_sims: int, max_combos: int):
    """Full pipeline: Gemini fetch → Monte Carlo → ranked exotics."""
    try:
        # --- Step 1: Fetch race data via Gemini ---
        st.info(f"Researching: **{query}**")
        with st.spinner("Gemini is researching the race card..."):
            from src.data.gemini_fetcher import fetch_race_data, fetched_to_win_probs
            race_data = fetch_race_data(query)

        # --- Display Race Card ---
        st.subheader(f"{race_data.track_name} — Race {race_data.race_number}")
        st.caption(f"{race_data.race_date} | {race_data.distance} | {race_data.surface} | {race_data.race_type} | ${race_data.purse:,}")

        card_rows = []
        for h in race_data.horses:
            beyer_str = ", ".join(str(b) for b in h.last_3_beyer) if h.last_3_beyer else "—"
            card_rows.append({
                "#": h.program_number,
                "Horse": h.name,
                "ML Odds": f"{h.morning_line_odds:.1f}",
                "Style": h.running_style,
                "Jockey": h.jockey,
                "Trainer": h.trainer,
                "Last 3 Beyer": beyer_str,
                "Record": f"{h.wins}/{h.starts}",
            })
        st.dataframe(pd.DataFrame(card_rows), use_container_width=True, hide_index=True)

        # --- Step 2: Compute probabilities ---
        names, programs, probs_list = fetched_to_win_probs(race_data)
        win_probs = np.array(probs_list)

        with st.spinner(f"Running {mc_sims:,} Monte Carlo simulations..."):
            from src.models.monte_carlo import henery_simulate
            compute_super = len(race_data.horses) >= 4
            sim = henery_simulate(win_probs, n_simulations=mc_sims, seed=None, compute_superfecta=compute_super)

        # --- Step 3: Show win/place/show probabilities ---
        st.subheader("Win Probabilities")
        prob_rows = []
        for i, h in enumerate(race_data.horses):
            prob_rows.append({
                "#": programs[i],
                "Horse": names[i],
                "ML Odds": f"{h.morning_line_odds:.1f}",
                "Win %": f"{sim.win_probs[i]:.1%}",
                "Place %": f"{sim.place_probs[i]:.1%}",
                "Show %": f"{sim.show_probs[i]:.1%}",
            })
        prob_df = pd.DataFrame(prob_rows)
        st.dataframe(prob_df, use_container_width=True, hide_index=True)

        # --- Step 4: Ranked Exotic Combinations ---
        from src.betting.ranked_exotics import rank_exactas, rank_trifectas, rank_superfectas

        takeout = 0.22

        # Exactas
        st.subheader("Exacta — All Combos Ranked ($2.00 each)")
        exacta_list = rank_exactas(sim.exacta_probs, names, programs, takeout, max_combos=max_combos)
        _display_ranked_list(exacta_list)

        # Trifectas
        st.subheader("Trifecta — All Combos Ranked ($1.00 each)")
        trifecta_list = rank_trifectas(sim.trifecta_probs, names, programs, takeout, max_combos=max_combos)
        _display_ranked_list(trifecta_list)

        # Superfectas
        if sim.superfecta_probs is not None:
            st.subheader("Superfecta — All Combos Ranked ($0.10 each)")
            super_list = rank_superfectas(sim.superfecta_probs, names, programs, takeout, max_combos=max_combos)
            _display_ranked_list(super_list)

        # --- Summary ---
        st.subheader("Summary")
        c1, c2 = st.columns(2)
        c1.metric("Exacta Combos Above Cutoff", exacta_list.total_above_cutoff)
        c2.metric("Trifecta Combos Above Cutoff", trifecta_list.total_above_cutoff)
        if sim.superfecta_probs is not None:
            st.metric("Superfecta Combos Above Cutoff", super_list.total_above_cutoff)

    except RuntimeError as e:
        st.error(str(e))
        st.info("Add your Gemini API key to the `.env` file in the project root:\n\n`GEMINI_API_KEY=your_key_here`")
    except ValueError as e:
        st.error(f"Data issue: {e}")
    except Exception as ex:
        st.error(f"Error: {ex}")
        import traceback
        st.code(traceback.format_exc())


def _display_ranked_list(ranked) -> None:
    """Display a ranked exotic list as a styled DataFrame."""
    if not ranked.combos:
        st.warning("No combinations found.")
        return

    rows = []
    for c in ranked.combos:
        finish = " / ".join(f"#{p} {n}" for p, n in zip(c.program_numbers, c.horse_names))
        rows.append({
            "Rank": c.rank,
            "Finish Order": finish,
            "Probability": f"{c.probability:.4%}",
            "Est Payoff": f"${c.estimated_payoff:,.2f}",
            "Cost": f"${c.unit_cost:.2f}",
            "Bet": "BET" if c.above_cutoff else "",
        })

    df = pd.DataFrame(rows)

    st.caption(
        f"{ranked.total_above_cutoff} combos above probability cutoff | "
        f"Cost to play all: ${ranked.total_cost_above_cutoff:.2f}"
    )
    st.dataframe(df, use_container_width=True, hide_index=True)
