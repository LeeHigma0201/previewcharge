"""Download free 2023 Equibase dataset for prototyping.

The Equibase complimentary full-year 2023 dataset includes past performances
and results charts — an excellent prototyping resource.

Source: equibase.com/handicappersdata.cfm

NOTE: This script provides instructions. Actual download requires
manual acceptance of Equibase terms of service.
"""

from __future__ import annotations

import sys
from pathlib import Path


def main() -> None:
    data_dir = Path("data/bris")
    data_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("HorseGPT v3.14 — Data Download Guide")
    print("=" * 60)
    print()
    print("FREE DATA SOURCES:")
    print()
    print("1. Equibase 2023 Dataset (Recommended for prototyping)")
    print("   URL: https://equibase.com/handicappersdata.cfm")
    print("   - Full year 2023 past performances + results charts")
    print("   - Requires free Equibase account")
    print(f"   - Download CSV files to: {data_dir.resolve()}")
    print()
    print("2. Kaggle Big Data Derby 2022")
    print("   - GPS tracking data for ~2,000 NYRA races")
    print("   - Aqueduct, Belmont, Saratoga")
    print()
    print("3. The Racing API (UK/Irish/HK racing)")
    print("   URL: https://theracingapi.com")
    print("   - JSON REST API, designed for ML developers")
    print()
    print("PAID DATA SOURCES:")
    print()
    print("4. BRIS Data Files (~$3/card or $59/month unlimited)")
    print("   - 1,430+ fields per horse, gold standard for ML")
    print("   - Archive data back to 1997")
    print()
    print("5. DRF Formulator Export (~$180/month unlimited)")
    print("   - Includes Beyer Speed Figures")
    print()
    print("=" * 60)
    print(f"Place data files in: {data_dir.resolve()}")
    print("Then run: make ingest")
    print("=" * 60)


if __name__ == "__main__":
    main()
