.PHONY: init ingest features predict dashboard test lint all clean scrape query preview-keeneland preview-keeneland-ingest

PYTHON ?= python
DB ?= horsegpt.db
TRACK ?= SAR
DATE ?= $(shell date +%Y-%m-%d)

init:
	$(PYTHON) scripts/init_db.py

ingest:
	$(PYTHON) -m src.data.ingest --db $(DB) --input data/bris/

ingest-scraped:
	$(PYTHON) -c "from src.data.scrapers.ingest_scraped import ingest_scraped_directory; from pathlib import Path; ingest_scraped_directory('sqlite:///$(DB)', Path('data/scraped'))"

scrape:
	$(PYTHON) -m src.nlp.cli --scrape $(TRACK) $(DATE) --db sqlite:///$(DB)

query:
	$(PYTHON) -m src.nlp.cli --db sqlite:///$(DB) $(ARGS)

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

preview-keeneland:
	$(PYTHON) scripts/keeneland_preview.py --track KEE --date $(DATE) --db sqlite:///$(DB) --export-only

preview-keeneland-ingest:
	$(PYTHON) scripts/keeneland_preview.py --track KEE --date $(DATE) --db sqlite:///$(DB) --ingest-results

all: init ingest features predict

clean:
	rm -f $(DB)
	find . -type d -name __pycache__ -exec rm -rf {} +
