"""Backtesting results page."""

from __future__ import annotations

import streamlit as st


def render() -> None:
    st.header("Backtesting Results")
    st.info("Run walk-forward backtesting to see model performance over time.")
    st.markdown("""
    **Metrics tracked:**
    - Brier Score (calibration quality)
    - ΔR² over public odds (Benter's key metric)
    - Simulated ROI with flat-stake betting
    - Win rate at various confidence thresholds

    **Run backtesting:**
    ```bash
    python -m src.evaluation.backtesting --db horsegpt.db
    ```
    """)
