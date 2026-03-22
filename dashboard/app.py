"""HorseGPT v3.14 — Streamlit Dashboard.

Main entry point. Multi-page app for race analysis and bet recommendations.
Run: streamlit run dashboard/app.py
"""

import sys
from pathlib import Path

import streamlit as st

# Ensure project root is in path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

st.set_page_config(
    page_title="HorseGPT v3.14",
    page_icon="🏇",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("HorseGPT v3.14")
st.markdown("**Multi-model horse racing handicapping tool**")

st.sidebar.title("Navigation")
page = st.sidebar.radio(
    "Select page:",
    ["Race Card", "Predictions", "Pace Analysis", "Backtesting"],
)

if page == "Race Card":
    from dashboard.pages.race_card import render
    render()
elif page == "Predictions":
    from dashboard.pages.predictions import render
    render()
elif page == "Pace Analysis":
    from dashboard.pages.pace_analysis import render
    render()
elif page == "Backtesting":
    from dashboard.pages.backtest import render
    render()
