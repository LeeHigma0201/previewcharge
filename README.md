# HorseGPT v3.14

Multi-model horse racing handicapping tool. Combines a Benter-inspired logistic
offset, gradient boosting, a GNN pace model, Monte Carlo simulation, and a
longshot signal stack — all orchestrated through a Streamlit dashboard on a
SQLite backend.

## Quickstart

```bash
pip install -e ".[dev]"
make init        # create database
make ingest      # parse BRIS files into DB
make features    # compute feature matrix
make predict     # run models
make dashboard   # launch Streamlit UI
```

## Architecture

| Component | Library | Role |
|-----------|---------|------|
| Logistic regression | scikit-learn | Baseline with Benter odds offset |
| Gradient boosting | LightGBM | Primary tabular workhorse |
| Neural network | PyTorch | Nonlinear interactions, softmax over field |
| Graph neural network | PyTorch Geometric | Pace pressure modeling (GATv2Conv) |
| Monte Carlo | NumPy | Henery model for exotic bet distributions |
| Dashboard | Streamlit | Race analysis and bet recommendations |

## Project Structure

```
src/data/        Data ingestion, BRIS parsing, SQLite schema
src/features/    Feature engineering pipeline
src/models/      Models, ensemble, Monte Carlo
src/evaluation/  Metrics, calibration, backtesting
src/longshot/    Longshot signal module
dashboard/       Streamlit multi-page app
scripts/         Automation scripts
tests/           Test suite
```
