.PHONY: init ingest features predict dashboard test lint all clean

PYTHON ?= python
DB ?= horsegpt.db

init:
	$(PYTHON) scripts/init_db.py

ingest:
	$(PYTHON) -m src.data.ingest --db $(DB) --input data/bris/

features:
	$(PYTHON) -m src.features.pipeline --db $(DB)

predict:
	$(PYTHON) -m src.models.logistic --db $(DB)

dashboard:
	streamlit run dashboard/app.py

test:
	pytest tests/ -v

lint:
	ruff check src/ tests/ dashboard/
	mypy src/

all: init ingest features predict

clean:
	rm -f $(DB)
	find . -type d -name __pycache__ -exec rm -rf {} +
