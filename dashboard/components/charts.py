"""Reusable Streamlit chart components for HorseGPT dashboard."""

from __future__ import annotations

import numpy as np
import streamlit as st


def probability_bar_chart(
    names: list[str],
    probabilities: np.ndarray,
    title: str = "Win Probabilities",
) -> None:
    """Horizontal bar chart of win probabilities."""
    import pandas as pd

    df = pd.DataFrame({
        "Horse": names,
        "Probability": probabilities * 100,
    }).sort_values("Probability", ascending=True)

    st.subheader(title)
    st.bar_chart(df.set_index("Horse"))


def calibration_plot(
    bin_centers: np.ndarray,
    bin_true_rates: np.ndarray,
) -> None:
    """Calibration curve: predicted vs actual probabilities."""
    import pandas as pd

    df = pd.DataFrame({
        "Predicted": bin_centers * 100,
        "Actual": bin_true_rates * 100,
        "Perfect": bin_centers * 100,
    })
    st.line_chart(df.set_index("Predicted"))


def finish_position_heatmap(
    names: list[str],
    finish_matrix: np.ndarray,
) -> None:
    """Heatmap of P(horse finishes in position)."""
    import pandas as pd

    n = len(names)
    positions = [f"Pos {i+1}" for i in range(min(n, 5))]
    df = pd.DataFrame(
        finish_matrix[:, :5] * 100,
        index=names,
        columns=positions,
    )
    st.dataframe(df.style.background_gradient(cmap="YlOrRd", axis=None).format("{:.1f}%"),
                use_container_width=True)
