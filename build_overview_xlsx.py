"""Build HorseGPT system overview spreadsheet."""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

wb = Workbook()

# -- Shared styles --
NAVY = "0B1120"
AMBER = "C4956A"
WHITE_FONT = Font(name="Arial", color="FFFFFF", bold=True, size=11)
HEADER_FILL = PatternFill("solid", fgColor="1B2838")
SUB_FILL = PatternFill("solid", fgColor="2A3A50")
AMBER_FILL = PatternFill("solid", fgColor=AMBER)
LIGHT_ROW = PatternFill("solid", fgColor="F5F2ED")
DARK_ROW = PatternFill("solid", fgColor="EDE8E0")
TITLE_FONT = Font(name="Arial", bold=True, size=14, color=NAVY)
SECTION_FONT = Font(name="Arial", bold=True, size=11, color=AMBER)
BODY = Font(name="Arial", size=10)
BOLD = Font(name="Arial", size=10, bold=True)
WRAP = Alignment(wrap_text=True, vertical="top")
THIN = Side(style="thin", color="CCCCCC")
BORDER = Border(bottom=THIN)

def style_header(ws, row, cols):
    for c in range(1, cols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = WHITE_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal="left", vertical="center")

def style_row(ws, row, cols, alt=False):
    for c in range(1, cols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = BODY
        cell.alignment = WRAP
        if alt:
            cell.fill = LIGHT_ROW
        cell.border = BORDER

def set_widths(ws, widths):
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w

# ============================================================
# SHEET 1: OVERVIEW
# ============================================================
ws = wb.active
ws.title = "Overview"
set_widths(ws, [30, 60])

ws["A1"] = "HorseGPT v3.14"
ws["A1"].font = TITLE_FONT
ws["A2"] = "Multi-model horse racing handicapping system"
ws["A2"].font = Font(name="Arial", size=11, italic=True, color="666666")

overview = [
    ("What It Does", "Predicts race outcomes using BRIS data, 50 engineered features, and an ensemble of ML models. Finds where the betting market is wrong."),
    ("Unit of Prediction", "Entry = one horse in one race. Everything operates at this level: features, training, evaluation."),
    ("Core Insight", "The public betting market (odds) is the baseline. Our model learns only the RESIDUAL signal — where the crowd is wrong."),
    ("Pipeline", "Data Ingestion → Database → Feature Engineering → Models → Evaluation / Dashboard"),
    ("Data Sources", "BRIS fixed-width files (1430+ fields), Equibase web scraper, DRF free API, Racing API"),
    ("Feature Count", "50 features across 9 categories, all z-scored within the race field"),
    ("Models", "Benter Logistic (odds offset) + LightGBM, combined in log-odds ensemble (0.3 / 0.7)"),
    ("Simulations", "Monte Carlo (Henery normal model) converts win probs → finish distributions for exotic bets"),
    ("NLP Queries", 'Plain English queries like "Saratoga race 5 today" auto-load all data into a prompt'),
    ("Dashboard", "Streamlit UI for race analysis and predictions"),
    ("Frontend", "Next.js 16 web app (Vercel deployment)"),
]

r = 4
style_header(ws, r, 2)
ws.cell(r, 1, "Concept")
ws.cell(r, 2, "Description")
for i, (k, v) in enumerate(overview):
    r += 1
    ws.cell(r, 1, k).font = BOLD
    ws.cell(r, 2, v)
    style_row(ws, r, 2, alt=i % 2 == 0)

# ============================================================
# SHEET 2: DATA SOURCES
# ============================================================
ws2 = wb.create_sheet("Data Sources")
set_widths(ws2, [18, 22, 14, 50])

ws2["A1"] = "Data Sources"
ws2["A1"].font = TITLE_FONT

sources = [
    ("BRIS Files", "Fixed-width text (DRF)", "1430+ fields", "Gold standard. Parsed via bris_parser.py into ParsedEntry dataclasses. Maps ~100 key fields in Phase 1. Includes speed figures, past performances, workouts, jockey/trainer stats."),
    ("Equibase", "Web scraper (httpx)", "Entries + results", "Free public data. Scrapes race cards and results. Outputs ScrapedCard JSON."),
    ("DRF Free", "REST API", "Entries + odds", "Daily Racing Form free tier. Morning line odds, entries, scratches."),
    ("Racing API", "REST API", "Results + payoffs", "Historical results and exotic payoffs for backtesting."),
]

r = 3
style_header(ws2, r, 4)
for c, h in enumerate(["Source", "Format", "Scope", "Details"], 1):
    ws2.cell(r, c, h)

for i, (src, fmt, scope, details) in enumerate(sources):
    r += 1
    ws2.cell(r, 1, src).font = BOLD
    ws2.cell(r, 2, fmt)
    ws2.cell(r, 3, scope)
    ws2.cell(r, 4, details)
    style_row(ws2, r, 4, alt=i % 2 == 0)

r += 2
ws2.cell(r, 1, "Data Flow").font = SECTION_FONT
r += 1
flow_steps = [
    ("1. Ingest", "Raw files/API → ParsedEntry dataclasses"),
    ("2. Deduplicate", "Unique constraints on horse name + track + date"),
    ("3. Store", "SQLAlchemy ORM → 5 tables (Horse, Race, Entry, PastPerformance, Workout)"),
    ("4. Bridge", "All scrapers output ScrapedCard → converted to ParsedEntry → same ingest path"),
]
for i, (step, desc) in enumerate(flow_steps):
    ws2.cell(r, 1, step).font = BOLD
    ws2.cell(r, 2, desc)
    style_row(ws2, r, 4, alt=i % 2 == 0)
    r += 1

# ============================================================
# SHEET 3: ALL 50 FEATURES
# ============================================================
ws3 = wb.create_sheet("50 Features")
set_widths(ws3, [5, 14, 24, 55, 20])

ws3["A1"] = "50 Engineered Features"
ws3["A1"].font = TITLE_FONT
ws3["A2"] = "All features are z-scored within the race field so models see relative strength, not absolute values."
ws3["A2"].font = Font(name="Arial", size=10, italic=True, color="666666")

features = [
    # SPEED (5)
    ("SPD", "best_beyer", "Highest Beyer figure from past performances", "Higher = faster horse overall"),
    ("SPD", "avg_beyer", "Average Beyer across all PPs", "Consistency indicator"),
    ("SPD", "last_beyer", "Most recent race Beyer figure", "Current form snapshot"),
    ("SPD", "beyer_trend", "Linear regression slope over PPs (positive = improving)", "Direction of form"),
    ("SPD", "beyer_stdev", "Standard deviation of Beyer figures", "Consistency vs volatility"),
    # PACE (8)
    ("PCE", "avg_e1_pace", "Average early pace (1st call)", "How fast they break"),
    ("PCE", "avg_e2_pace", "Average mid-race pace (2nd call)", "Sustain speed?"),
    ("PCE", "avg_late_pace", "Average late pace figure", "Closing ability"),
    ("PCE", "style_E / EP / P / S / C", "One-hot running style (5 features)", "E=early, EP=early presser, P=presser, S=stalker, C=closer"),
    ("PCE", "pace_velocity_change", "Late pace minus early pace", "Acceleration profile"),
    ("PCE", "early_late_ratio", "E1 pace / late pace ratio", "Speed distribution pattern"),
    # CLASS (6)
    ("CLS", "current_purse", "Today's race purse", "Class level today"),
    ("CLS", "avg_past_purse", "Average purse in past races", "Where they've been running"),
    ("CLS", "class_change_pct", "(Current purse - avg past) / avg past", "Moving up or dropping?"),
    ("CLS", "claiming_price_ratio", "Current claim / avg past claims", "Claiming class shift"),
    ("CLS", "race_type_encoded", "MSW=5, STK=6, ALW=4, CLM=3, MCL=2", "Race type hierarchy"),
    ("CLS", "is_class_drop", "1 if class_change < -15%", "Dropping in class (bullish signal)"),
    # FORM (6)
    ("FRM", "days_since_last", "Days since most recent race", "Layoff length"),
    ("FRM", "log_days_since_last", "Log transform of days since last", "Non-linear rest effect"),
    ("FRM", "is_optimal_rest", "1 if 28-60 days since last race", "Sweet spot window"),
    ("FRM", "win_rate_last_5", "Win% in last 5 starts", "Recent win frequency"),
    ("FRM", "avg_finish_pos", "Average finish position", "Typical competitiveness"),
    ("FRM", "improvement_last_3", "Beyer slope over last 3-5 races", "Sharpening or declining"),
    # J/T (10)
    ("J/T", "jockey_win_pct", "Jockey win % (prior races only)", "Jockey quality"),
    ("J/T", "jockey_roi", "Jockey ROI ($2 base)", "Jockey profitability"),
    ("J/T", "jockey_starts", "Total jockey starts", "Jockey experience"),
    ("J/T", "jockey_top3_pct", "Jockey top-3 finish %", "Jockey consistency"),
    ("J/T", "jockey_avg_odds", "Avg odds on jockey's mounts", "Quality of mounts"),
    ("J/T", "trainer_win_pct", "Trainer win % (prior races only)", "Trainer quality"),
    ("J/T", "trainer_roi", "Trainer ROI ($2 base)", "Trainer profitability"),
    ("J/T", "trainer_starts", "Total trainer starts", "Trainer experience"),
    ("J/T", "trainer_top3_pct", "Trainer top-3 finish %", "Trainer consistency"),
    ("J/T", "trainer_avg_odds", "Avg odds on trainer's runners", "Barn quality"),
    # POST (3→5 with interactions)
    ("PST", "post_position", "Raw post position number", "Gate number"),
    ("PST", "post_position_pct", "Post / field size", "Relative position"),
    ("PST", "is_outside_dirt_sprint", "1 if outside + dirt + sprint", "Key disadvantage angle"),
    # DISTANCE (5)
    ("DST", "distance_exp_pct", "% of PPs at today's distance (±0.5f)", "Distance experience"),
    ("DST", "surface_exp_pct", "% of PPs on today's surface", "Surface experience"),
    ("DST", "is_surface_switch", "1 if switching surface from last race", "Turf↔Dirt change"),
    ("DST", "distance_change_yards", "Yards change from last race", "Stretch-out or cutback"),
    ("DST", "is_route_to_sprint", "1 if shortening 2f+", "Route to sprint angle"),
    # ODDS (4)
    ("ODS", "morning_line_odds", "Morning line odds", "Oddsmaker's initial estimate"),
    ("ODS", "ml_implied_prob", "1 / (1 + ML odds)", "Implied win probability"),
    ("ODS", "log_ml_odds", "Log of morning line odds", "Log-scale for model input"),
    ("ODS", "is_ml_favorite", "1 if ML odds ≤ 3.0", "Favorite flag"),
    # EQUIPMENT (4)
    ("EQP", "has_blinkers", "1 if wearing blinkers", "Focus equipment"),
    ("EQP", "first_time_blinkers", "1 if adding blinkers for first time", "Top-5 profitable angle in racing"),
    ("EQP", "blinkers_off", "1 if removing blinkers", "Equipment change"),
    ("EQP", "has_lasix", "1 if on Lasix", "Anti-bleeding medication"),
]

r = 4
style_header(ws3, r, 5)
for c, h in enumerate(["#", "Category", "Feature", "Description", "Why It Matters"], 1):
    ws3.cell(r, c, h)

cat_colors = {
    "SPD": "E8DDD0", "PCE": "D5E0D4", "CLS": "D4DBE4",
    "FRM": "E4D4D4", "J/T": "E4DFD0", "PST": "D0E0E4",
    "DST": "DCD4E4", "ODS": "E8DDD0", "EQP": "D5E0D4",
}

for i, (cat, name, desc, why) in enumerate(features):
    r += 1
    ws3.cell(r, 1, i + 1).font = Font(name="Arial", size=9, color="999999")
    ws3.cell(r, 2, cat).font = BOLD
    ws3.cell(r, 3, name)
    ws3.cell(r, 4, desc)
    ws3.cell(r, 5, why)
    fill = PatternFill("solid", fgColor=cat_colors.get(cat, "F5F2ED"))
    for c in range(1, 6):
        ws3.cell(r, c).fill = fill
        ws3.cell(r, c).alignment = WRAP
        ws3.cell(r, c).border = BORDER
        if c > 2:
            ws3.cell(r, c).font = BODY

# ============================================================
# SHEET 4: MODELS
# ============================================================
ws4 = wb.create_sheet("Models")
set_widths(ws4, [22, 55])

ws4["A1"] = "Model Architecture"
ws4["A1"].font = TITLE_FONT

models = [
    ("BENTER LOGISTIC", None),
    ("What", "Logistic regression that uses market odds as a fixed logit offset, then learns residual signal from features."),
    ("Why", "The betting market is the strongest single predictor. Rather than ignore it, we use it as the baseline and only model what the crowd gets wrong."),
    ("Formula", "logit(p) = logit(p_market) + X·β — the market probability enters as a fixed offset (coefficient ≈ 1.0)."),
    ("Weight", "0.30 in ensemble"),
    ("", ""),
    ("LIGHTGBM", None),
    ("What", "Gradient-boosted decision tree trained on all 50 features."),
    ("Why", "Captures non-linear interactions between features that logistic regression misses (e.g., first-time blinkers + class drop + top trainer)."),
    ("Weight", "0.70 in ensemble"),
    ("", ""),
    ("ENSEMBLE", None),
    ("Method", "Weighted average in LOG-ODDS space (not probability space). This preserves longshot overlay signals."),
    ("Formula", "logit(p_ensemble) = 0.70 · logit(p_lgbm) + 0.30 · logit(p_benter)"),
    ("Normalization", "Softmax across race field — predictions always sum to 1.0."),
    ("", ""),
    ("MONTE CARLO", None),
    ("What", "Henery normal model converts win probabilities to ability scores, then simulates 10,000+ races."),
    ("Why", "Win probabilities alone can't price exactas, trifectas, or superfectas. Monte Carlo gives full finish-order distributions."),
    ("Output", "Exact/tri/super probabilities for exotic bet pricing."),
    ("", ""),
    ("KEY CONSTRAINT", None),
    ("Z-scoring", "All 50 features are z-scored within the race field. A best_beyer of 0.0 means field average, not zero."),
    ("No lookahead", "Jockey/trainer stats use only races BEFORE the current date to prevent data leakage."),
    ("Sum to 1", "Win probabilities always sum to 1.0 across the field via softmax normalization."),
]

r = 3
for i, (k, v) in enumerate(models):
    r += 1
    if v is None:
        ws4.cell(r, 1, k).font = Font(name="Arial", bold=True, size=12, color=AMBER)
        ws4.cell(r, 1).fill = PatternFill("solid", fgColor="1B2838")
        ws4.cell(r, 2).fill = PatternFill("solid", fgColor="1B2838")
    elif k == "":
        continue
    else:
        ws4.cell(r, 1, k).font = BOLD
        ws4.cell(r, 2, v).font = BODY
        ws4.cell(r, 2).alignment = WRAP
        if i % 2 == 0:
            ws4.cell(r, 1).fill = LIGHT_ROW
            ws4.cell(r, 2).fill = LIGHT_ROW

# ============================================================
# SHEET 5: IDEAS (blank for collaboration)
# ============================================================
ws5 = wb.create_sheet("Ideas & TODOs")
set_widths(ws5, [8, 30, 50, 18, 18])

ws5["A1"] = "Ideas & TODOs"
ws5["A1"].font = TITLE_FONT
ws5["A2"] = "Add your ideas below — features, data sources, model changes, anything."
ws5["A2"].font = Font(name="Arial", size=10, italic=True, color="666666")

r = 4
style_header(ws5, r, 5)
for c, h in enumerate(["#", "Area", "Idea / Task", "Priority", "Status"], 1):
    ws5.cell(r, c, h)

starters = [
    ("Feature", "Add trainer-jockey combo win %", "Medium", ""),
    ("Feature", "Track bias features (inside/outside rail advantage today)", "High", ""),
    ("Data", "Add weather/track condition data from Weather API", "Medium", ""),
    ("Model", "Try XGBoost as third ensemble member", "Low", ""),
    ("Model", "Stacking meta-learner (Phase 3 from ensemble.py)", "Medium", ""),
    ("UI", "Add race replay video links to dashboard", "Low", ""),
    ("NLP", "Support multi-race queries ('all stakes at Saratoga')", "Medium", ""),
]

for i, (area, idea, pri, status) in enumerate(starters):
    r += 1
    ws5.cell(r, 1, i + 1)
    ws5.cell(r, 2, area)
    ws5.cell(r, 3, idea)
    ws5.cell(r, 4, pri)
    ws5.cell(r, 5, status)
    style_row(ws5, r, 5, alt=i % 2 == 0)

# Leave 20 blank formatted rows for adding ideas
for j in range(20):
    r += 1
    ws5.cell(r, 1, len(starters) + j + 1).font = Font(name="Arial", size=9, color="CCCCCC")
    style_row(ws5, r, 5, alt=j % 2 == 0)

OUT = "C:/Users/walls/previewcharge/horsegpt_overview.xlsx"
wb.save(OUT)
print(f"Saved: {OUT}")
