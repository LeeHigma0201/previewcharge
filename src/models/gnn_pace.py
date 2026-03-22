"""GNN pace pressure model using GATv2Conv.

No published work uses graph neural networks for horse racing pace
pressure modeling — this is a genuinely novel research direction.

Architecture inspired by TacticAI (Nature Communications, 2024):
- Each horse is a node in a fully connected graph
- Edge features encode pairwise competitive dynamics
- GAT multi-head attention learns different interaction types:
  * Pace pressure (E↔E dueling)
  * Stalking advantage (P/S watching E horses)
  * Class/ability gaps
- Attention weights are directly interpretable

Small field sizes (6-14) make fully connected graphs trivial.

class PacePressureGNN(torch.nn.Module):
    def __init__(self, node_dim, edge_dim, hidden=64, heads=4):
        super().__init__()
        self.conv1 = GATv2Conv(node_dim, hidden, heads=heads, edge_dim=edge_dim)
        self.conv2 = GATv2Conv(hidden*heads, hidden, heads=heads, edge_dim=edge_dim)
        self.conv3 = GATv2Conv(hidden*heads, hidden, heads=heads, edge_dim=edge_dim)
        self.decoder = nn.Sequential(
            nn.Linear(hidden*heads, 128), nn.ReLU(), nn.Linear(128, 1)
        )

    def forward(self, data):
        x = F.elu(self.conv1(data.x, data.edge_index, edge_attr=data.edge_attr))
        x = F.elu(self.conv2(x, data.edge_index, edge_attr=data.edge_attr))
        x = F.elu(self.conv3(x, data.edge_index, edge_attr=data.edge_attr))
        return softmax(self.decoder(x).squeeze(-1), data.batch)
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.models.base import BaseModel


# Running style encoding for edge features
STYLE_MAP = {"E": 0, "EP": 1, "P": 2, "S": 3, "C": 4}

# Edge interaction types
INTERACTION_TYPES = {
    (0, 0): "E_E_duel",  # Both early speed — pace pressure
    (0, 1): "E_EP_pressure",
    (1, 1): "EP_EP_duel",
    (2, 0): "P_stalking_E",
    (3, 0): "S_stalking_E",
    (4, 0): "C_closing_E",
}


def build_edge_features(
    running_styles: list[str],
    post_positions: list[int],
    speed_figures: list[float | None],
    pace_e1: list[float | None],
) -> dict:
    """Build edge feature tensors for the race graph.

    Returns dict with:
        edge_index: (2, num_edges) — fully connected pairs
        edge_attr: (num_edges, edge_dim) — edge feature vectors
    """
    n = len(running_styles)
    edges_src = []
    edges_dst = []
    edge_attrs = []

    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            edges_src.append(i)
            edges_dst.append(j)

            # Edge features
            pp_diff = abs(post_positions[i] - post_positions[j])
            style_i = STYLE_MAP.get(running_styles[i], 2)
            style_j = STYLE_MAP.get(running_styles[j], 2)
            same_style = 1.0 if style_i == style_j else 0.0

            speed_gap = 0.0
            if speed_figures[i] is not None and speed_figures[j] is not None:
                speed_gap = speed_figures[i] - speed_figures[j]

            pace_gap = 0.0
            if pace_e1[i] is not None and pace_e1[j] is not None:
                pace_gap = pace_e1[i] - pace_e1[j]

            edge_attrs.append([
                float(pp_diff),
                float(style_i),
                float(style_j),
                same_style,
                speed_gap,
                pace_gap,
            ])

    return {
        "edge_index": [edges_src, edges_dst],
        "edge_attr": edge_attrs,
    }


def count_early_speed(running_styles: list[str]) -> int:
    """Count early speed types — the single most important pace variable."""
    return sum(1 for s in running_styles if s in ("E", "EP"))


class PacePressureGNN(BaseModel):
    """GATv2Conv-based pace pressure model.

    TODO: Full PyTorch Geometric implementation in Phase 4.

    Node features (per horse):
        - Speed figures, running style embedding, pace figures
        - Post position (positional encoding), log odds
        - Class rating, form cycle, age, weight
        - Jockey/trainer embeddings

    Edge features (per pair):
        - Post position proximity
        - Running style differential
        - Speed figure gap
        - Pace pressure differential
        - Same-style binary flag

    Graph features (race-level):
        - Count of early speed types
        - Distance, surface, field size
    """

    def __init__(self, hidden_dim: int = 64, heads: int = 4, num_layers: int = 3):
        self.hidden_dim = hidden_dim
        self.heads = heads
        self.num_layers = num_layers

    def fit(self, X: pd.DataFrame, y: np.ndarray, odds: np.ndarray | None = None) -> None:
        raise NotImplementedError(
            "PacePressureGNN: Phase 4. Requires PyTorch Geometric. "
            "Use BenterLogisticModel or LightGBMModel for now."
        )

    def predict_proba(
        self, X: pd.DataFrame, odds: np.ndarray | None = None
    ) -> np.ndarray:
        raise NotImplementedError("PacePressureGNN: Phase 4.")
