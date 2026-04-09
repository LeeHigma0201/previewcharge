"""HorseGPT Paddock Formalism infographic — light, classic, Twin Spires aesthetic."""
import math
import random

from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

random.seed(314)

W = 18 * inch
H = 24 * inch
CX = W / 2
MARGIN = 1.8 * inch

FONTS = "C:/Users/walls/AppData/Roaming/Claude/local-agent-mode-sessions/skills-plugin/ff13e73c-1282-4422-9167-5d8e7b1baad0/9f310721-e8a1-4b37-a93f-a8d2ff223808/skills/canvas-design/canvas-fonts/"

pdfmetrics.registerFont(TTFont("CrimsonPro", FONTS + "CrimsonPro-Regular.ttf"))
pdfmetrics.registerFont(TTFont("CrimsonProBold", FONTS + "CrimsonPro-Bold.ttf"))
pdfmetrics.registerFont(TTFont("CrimsonProItalic", FONTS + "CrimsonPro-Italic.ttf"))
pdfmetrics.registerFont(TTFont("DMMono", FONTS + "DMMono-Regular.ttf"))
pdfmetrics.registerFont(TTFont("InstrumentSerif", FONTS + "InstrumentSerif-Regular.ttf"))
pdfmetrics.registerFont(TTFont("InstrumentSerifItalic", FONTS + "InstrumentSerif-Italic.ttf"))
pdfmetrics.registerFont(TTFont("Italiana", FONTS + "Italiana-Regular.ttf"))
pdfmetrics.registerFont(TTFont("LibreBaskerville", FONTS + "LibreBaskerville-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Lora", FONTS + "Lora-Regular.ttf"))
pdfmetrics.registerFont(TTFont("LoraBold", FONTS + "Lora-Bold.ttf"))
pdfmetrics.registerFont(TTFont("LoraItalic", FONTS + "Lora-Italic.ttf"))

# Palette
IVORY      = HexColor("#F5F0E6")
GREEN      = HexColor("#1B4332")
GREEN_MED  = HexColor("#2D6A4F")
GREEN_LT   = HexColor("#95D5B2")
GOLD       = HexColor("#B8860B")
GOLD_LT    = HexColor("#D4A843")
BURGUNDY   = HexColor("#722F37")
RULE_COLOR = HexColor("#C8C0B0")
TEXT_DARK  = HexColor("#2C2C2C")
TEXT_MED   = HexColor("#6B6560")
TEXT_LIGHT  = HexColor("#9B958D")

CATEGORIES = [
    ("SPEED",          5,  GREEN),
    ("PACE",           8,  GREEN_MED),
    ("CLASS",          6,  HexColor("#3A5A40")),
    ("FORM",           6,  BURGUNDY),
    ("JOCKEY / TRAINER", 10, GOLD),
    ("POST POSITION",  3,  HexColor("#4A7C6F")),
    ("DISTANCE",       5,  HexColor("#5C4A3A")),
    ("ODDS",           4,  GOLD),
    ("EQUIPMENT",      4,  GREEN_MED),
]

OUT = "C:/Users/walls/previewcharge/horsegpt_infographic_v2.pdf"

def tracked_centered(c, cx, y, text, font, size, tracking=0):
    c.setFont(font, size)
    total = sum(c.stringWidth(ch, font, size) + tracking for ch in text) - tracking
    x = cx - total / 2
    for ch in text:
        c.drawString(x, y, ch)
        x += c.stringWidth(ch, font, size) + tracking

def hairline(c, x1, y, x2, color=RULE_COLOR, alpha=0.5):
    c.saveState()
    c.setStrokeColor(color)
    c.setStrokeAlpha(alpha)
    c.setLineWidth(0.4)
    c.line(x1, y, x2, y)
    c.restoreState()

def ornament(c, cx, y, w=40):
    """Small decorative rule with center diamond."""
    c.saveState()
    c.setStrokeColor(GOLD)
    c.setStrokeAlpha(0.5)
    c.setLineWidth(0.4)
    c.line(cx - w, y, cx - 4, y)
    c.line(cx + 4, y, cx + w, y)
    c.setFillColor(GOLD)
    c.setFillAlpha(0.5)
    # diamond
    p = c.beginPath()
    p.moveTo(cx, y + 3)
    p.lineTo(cx + 3, y)
    p.lineTo(cx, y - 3)
    p.lineTo(cx - 3, y)
    p.close()
    c.drawPath(p, fill=1, stroke=0)
    c.restoreState()

# ---- DRAWING FUNCTIONS ----

def draw_background(c):
    c.setFillColor(IVORY)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    # Subtle border frame
    c.saveState()
    c.setStrokeColor(RULE_COLOR)
    c.setStrokeAlpha(0.3)
    c.setLineWidth(0.5)
    m = 0.8 * inch
    c.rect(m, m, W - 2*m, H - 2*m, fill=0, stroke=1)
    c.restoreState()

def draw_title(c):
    y = 22.2 * inch
    c.saveState()
    c.setFillColor(GREEN)
    tracked_centered(c, CX, y, "HORSEGPT", "Italiana", 56, 18)
    c.restoreState()

    c.saveState()
    c.setFillColor(GOLD)
    c.setFillAlpha(0.7)
    c.setFont("DMMono", 11)
    c.drawCentredString(CX, y - 24, "v 3 . 1 4")
    c.restoreState()

    ornament(c, CX, y - 46, 60)

    c.saveState()
    c.setFillColor(TEXT_MED)
    c.setFont("InstrumentSerifItalic", 11)
    c.drawCentredString(CX, y - 68, "A Study in Probabilistic Form Analysis")
    c.restoreState()

    hairline(c, MARGIN, y - 86, W - MARGIN, RULE_COLOR, 0.35)

def draw_data_sources(c):
    y_top = 21.0 * inch
    c.saveState()
    c.setFillColor(GREEN)
    c.setFont("CrimsonProBold", 11)
    c.drawCentredString(CX, y_top, "DATA  INGESTION")
    c.restoreState()

    sources = [
        ("I.", "BRIS DATA", "1,430+ fields  ·  fixed-width parse"),
        ("II.", "EQUIBASE", "web scraper  ·  entries & results"),
        ("III.", "DRF / API", "morning line  ·  historical payoffs"),
    ]
    cols = [4.5 * inch, CX, 13.5 * inch]
    y_marks = y_top - 28

    for i, (num, name, desc) in enumerate(sources):
        cx = cols[i]
        # Barcode marks
        rng = random.Random(i * 77 + 3)
        c.saveState()
        c.setFillColor(GREEN)
        counts = [45, 30, 28][i]
        for j in range(counts):
            y = y_marks - j * 3.2
            w = rng.uniform(8, 55)
            alpha = 0.12 + 0.28 * (j / counts)
            c.setFillAlpha(alpha)
            c.rect(cx - w / 2, y, w, 1.0, fill=1, stroke=0)
        c.restoreState()

        # Labels
        bot_y = y_marks - counts * 3.2 - 12
        c.saveState()
        c.setFillColor(GOLD)
        c.setFillAlpha(0.6)
        c.setFont("Italiana", 10)
        c.drawCentredString(cx, y_marks + 14, num)
        c.restoreState()

        c.saveState()
        c.setFillColor(GREEN)
        c.setFont("CrimsonPro", 9)
        c.drawCentredString(cx, bot_y, name)
        c.setFillColor(TEXT_LIGHT)
        c.setFont("DMMono", 6)
        c.drawCentredString(cx, bot_y - 12, desc)
        c.restoreState()

    # Flow lines converging
    flow_y_start = y_marks - 50 * 3.2 - 30
    flow_y_end = flow_y_start - 40
    c.saveState()
    c.setStrokeColor(GREEN)
    c.setStrokeAlpha(0.12)
    c.setLineWidth(0.5)
    for cx in cols:
        p = c.beginPath()
        p.moveTo(cx, flow_y_start + 20)
        p.curveTo(cx, flow_y_start - 10, CX, flow_y_end + 15, CX, flow_y_end)
        c.drawPath(p, fill=0, stroke=1)
    c.restoreState()

    hairline(c, MARGIN, 17.8 * inch, W - MARGIN, RULE_COLOR, 0.3)

def draw_features(c):
    zone_top = 17.5 * inch
    zone_bot = 9.5 * inch

    c.saveState()
    c.setFillColor(GREEN)
    c.setFont("CrimsonProBold", 11)
    c.drawCentredString(CX, zone_top, "50  ENGINEERED  FEATURES")
    c.restoreState()

    c.saveState()
    c.setFillColor(TEXT_LIGHT)
    c.setFont("DMMono", 6.5)
    c.drawCentredString(CX, zone_top - 16, "z-scored within race field  ·  9 categories  ·  relative strength")
    c.restoreState()

    ornament(c, CX, zone_top - 32, 45)

    # 3 columns, 3 rows
    grid = [
        [0, 1, 2],   # SPEED, PACE, CLASS
        [3, 4, 5],   # FORM, J/T, POST
        [6, 7, 8],   # DIST, ODDS, EQUIP
    ]
    col_x = [4.5 * inch, CX, 13.5 * inch]
    row_y = [
        zone_bot + (zone_top - zone_bot) * 0.76,
        zone_bot + (zone_top - zone_bot) * 0.46,
        zone_bot + (zone_top - zone_bot) * 0.16,
    ]

    feat_num = 1
    for ri, row in enumerate(grid):
        for ci, cat_idx in enumerate(row):
            cat_name, cat_count, cat_color = CATEGORIES[cat_idx]
            cx = col_x[ci]
            cy = row_y[ri]

            # Category header
            c.saveState()
            c.setFillColor(cat_color)
            c.setFont("CrimsonProBold", 9.5)
            header_y = cy + cat_count * 7 + 16
            c.drawCentredString(cx, header_y, cat_name)
            c.setFillColor(TEXT_LIGHT)
            c.setFont("DMMono", 6)
            c.drawCentredString(cx, header_y - 11, f"({cat_count})")
            c.restoreState()

            # Thin rule under header
            hairline(c, cx - 50, header_y - 16, cx + 50, cat_color, 0.2)

            # Feature marks: small horizontal dashes with ref numbers
            for fi in range(cat_count):
                fy = cy + (cat_count / 2 - fi) * 14
                # Dash mark
                c.saveState()
                c.setStrokeColor(cat_color)
                c.setStrokeAlpha(0.7)
                c.setLineWidth(1.4)
                dash_w = 20
                c.line(cx - dash_w / 2, fy, cx + dash_w / 2, fy)
                # Small circle at left end
                c.setFillColor(cat_color)
                c.setFillAlpha(0.4)
                c.circle(cx - dash_w / 2, fy, 1.5, fill=1, stroke=0)
                c.restoreState()

                # Ref number
                c.saveState()
                c.setFillColor(TEXT_LIGHT)
                c.setFillAlpha(0.5)
                c.setFont("DMMono", 5)
                c.drawString(cx + dash_w / 2 + 5, fy - 2, f"F.{feat_num:02d}")
                c.restoreState()
                feat_num += 1

    hairline(c, MARGIN, zone_bot - 16, W - MARGIN, RULE_COLOR, 0.3)

def draw_models(c):
    zone_top = 9.0 * inch
    converge_y = 6.2 * inch

    c.saveState()
    c.setFillColor(GREEN)
    c.setFont("CrimsonProBold", 11)
    c.drawCentredString(CX, zone_top, "MODEL  ENSEMBLE")
    c.restoreState()

    ornament(c, CX, zone_top - 18, 40)

    # Two converging paths
    lgbm_x = 5.5 * inch
    benter_x = 12.5 * inch
    start_y = zone_top - 36

    # LightGBM path (thicker)
    c.saveState()
    c.setStrokeColor(GREEN)
    c.setStrokeAlpha(0.5)
    c.setLineWidth(2.0)
    p = c.beginPath()
    p.moveTo(lgbm_x, start_y)
    p.curveTo(lgbm_x, start_y - 50, CX - 15, converge_y + 40, CX, converge_y)
    c.drawPath(p, fill=0, stroke=1)
    c.restoreState()

    # Benter path (thinner)
    c.saveState()
    c.setStrokeColor(GOLD)
    c.setStrokeAlpha(0.5)
    c.setLineWidth(1.0)
    p = c.beginPath()
    p.moveTo(benter_x, start_y)
    p.curveTo(benter_x, start_y - 50, CX + 15, converge_y + 40, CX, converge_y)
    c.drawPath(p, fill=0, stroke=1)
    c.restoreState()

    # Labels
    c.saveState()
    c.setFillColor(GREEN)
    c.setFont("CrimsonPro", 9)
    c.drawCentredString(lgbm_x, start_y + 10, "LightGBM")
    c.setFillColor(TEXT_LIGHT)
    c.setFont("DMMono", 6.5)
    c.drawCentredString(lgbm_x, start_y - 4, "w = 0.70")
    c.restoreState()

    c.saveState()
    c.setFillColor(GOLD)
    c.setFont("CrimsonPro", 9)
    c.drawCentredString(benter_x, start_y + 10, "Benter Logistic")
    c.setFillColor(TEXT_LIGHT)
    c.setFont("DMMono", 6.5)
    c.drawCentredString(benter_x, start_y - 4, "w = 0.30")
    c.restoreState()

    # Convergence point
    c.saveState()
    c.setFillColor(GOLD)
    c.setFillAlpha(0.4)
    c.circle(CX, converge_y, 4, fill=1, stroke=0)
    c.setStrokeColor(GOLD)
    c.setStrokeAlpha(0.2)
    c.setLineWidth(0.5)
    c.circle(CX, converge_y, 12, fill=0, stroke=1)
    c.restoreState()

    c.saveState()
    c.setFillColor(TEXT_MED)
    c.setFont("DMMono", 6)
    c.drawCentredString(CX, converge_y - 20, "log-odds space  ·  softmax normalization")
    c.restoreState()

    # Vertical line down
    c.saveState()
    c.setStrokeColor(GREEN)
    c.setStrokeAlpha(0.08)
    c.setLineWidth(0.4)
    c.line(CX, converge_y - 26, CX, 5.0 * inch)
    c.restoreState()

    hairline(c, MARGIN, 5.2 * inch, W - MARGIN, RULE_COLOR, 0.25)

def draw_output(c):
    base_y = 2.6 * inch
    curve_h = 1.4 * inch
    curve_w = 9 * inch

    c.saveState()
    c.setFillColor(GREEN)
    c.setFont("CrimsonProBold", 11)
    c.drawCentredString(CX, 4.8 * inch, "RACE  PREDICTION")
    c.restoreState()

    ornament(c, CX, 4.6 * inch, 35)

    left_x = CX - curve_w / 2
    right_x = CX + curve_w / 2

    # Filled distribution
    c.saveState()
    p = c.beginPath()
    p.moveTo(left_x, base_y)
    steps = 120
    for i in range(steps + 1):
        x = left_x + (right_x - left_x) * i / steps
        t = (i - steps / 2) / (steps / 2)
        h = math.exp(-3.5 * (t - 0.05) ** 2) * curve_h
        p.lineTo(x, base_y + h)
    p.lineTo(right_x, base_y)
    p.close()
    c.setFillColor(GREEN_LT)
    c.setFillAlpha(0.12)
    c.drawPath(p, fill=1, stroke=0)
    c.restoreState()

    # Curve outline
    c.saveState()
    c.setStrokeColor(GREEN)
    c.setStrokeAlpha(0.4)
    c.setLineWidth(1.2)
    p2 = c.beginPath()
    for i in range(steps + 1):
        x = left_x + (right_x - left_x) * i / steps
        t = (i - steps / 2) / (steps / 2)
        h = math.exp(-3.5 * (t - 0.05) ** 2) * curve_h
        if i == 0:
            p2.moveTo(x, base_y + h)
        else:
            p2.lineTo(x, base_y + h)
    c.drawPath(p2, fill=0, stroke=1)
    c.restoreState()

    # Monte Carlo dots
    rng = random.Random(42)
    c.saveState()
    for _ in range(400):
        dx = rng.gauss(0.05, 0.28) * curve_w / 2
        if abs(dx) > curve_w / 2 - 8:
            continue
        t = dx / (curve_w / 2)
        max_h = math.exp(-3.5 * (t - 0.05) ** 2) * curve_h
        dy = rng.uniform(2, max(3, max_h - 2))
        if dy > max_h - 1:
            continue
        a = 0.08 + 0.25 * math.exp(-2 * t * t)
        c.setFillColor(GREEN)
        c.setFillAlpha(a)
        r = rng.uniform(0.6, 1.4)
        c.circle(CX + dx, base_y + dy, r, fill=1, stroke=0)
    c.restoreState()

    # Baseline
    c.saveState()
    c.setStrokeColor(GREEN)
    c.setStrokeAlpha(0.2)
    c.setLineWidth(0.4)
    c.line(left_x, base_y, right_x, base_y)
    c.restoreState()

    # Sum notation
    c.saveState()
    c.setFillColor(TEXT_MED)
    c.setFont("Italiana", 11)
    c.drawCentredString(CX, base_y - 18, "\u03A3 p = 1.0")
    c.restoreState()

    c.saveState()
    c.setFillColor(TEXT_LIGHT)
    c.setFont("DMMono", 5.5)
    c.drawCentredString(CX, base_y - 32, "Henery normal model  ·  100K Monte Carlo simulations  ·  exotic bet pricing")
    c.restoreState()

def draw_footer(c):
    y = 1.2 * inch
    hairline(c, MARGIN + 2 * inch, y + 14, W - MARGIN - 2 * inch, RULE_COLOR, 0.25)

    c.saveState()
    c.setFillColor(TEXT_MED)
    c.setFont("CrimsonProItalic", 8)
    c.drawCentredString(CX, y, "Entry = Horse \u00d7 Race  \u00b7  Market Odds as Logit Offset  \u00b7  Predictions Sum to 1.0")
    c.restoreState()

    c.saveState()
    c.setFillColor(TEXT_LIGHT)
    c.setFont("DMMono", 5.5)
    c.drawCentredString(CX, y - 14, "BRIS  \u00b7  EQUIBASE  \u00b7  DRF  \u00b7  50 FEATURES  \u00b7  LIGHTGBM + BENTER  \u00b7  MONTE CARLO")
    c.restoreState()

def draw_side_labels(c):
    c.saveState()
    c.setFillColor(TEXT_LIGHT)
    c.setFillAlpha(0.25)
    c.setFont("DMMono", 5)
    steps = [
        (20.5 * inch, "01  INGEST"),
        (13.5 * inch, "02  ENGINEER"),
        (7.5  * inch, "03  MODEL"),
        (3.5  * inch, "04  PREDICT"),
    ]
    for y, txt in steps:
        c.saveState()
        c.translate(MARGIN - 20, y)
        c.rotate(90)
        c.drawString(0, 0, txt)
        c.restoreState()
    c.restoreState()

    # Subtle oval track in features zone
    c.saveState()
    c.setStrokeColor(RULE_COLOR)
    c.setStrokeAlpha(0.06)
    c.setLineWidth(0.6)
    oy = 13.5 * inch
    for i in range(3):
        rx = 4.2 * inch + i * 10
        ry = 2.5 * inch + i * 6
        c.ellipse(CX - rx, oy - ry, CX + rx, oy + ry, fill=0, stroke=1)
    c.restoreState()

def main():
    c = canvas.Canvas(OUT, pagesize=(W, H))
    c.setTitle("HorseGPT v3.14 — Paddock Formalism")
    c.setAuthor("HorseGPT")

    draw_background(c)
    draw_side_labels(c)
    draw_title(c)
    draw_data_sources(c)
    draw_features(c)
    draw_models(c)
    draw_output(c)
    draw_footer(c)

    c.save()
    print(f"Saved: {OUT}")

if __name__ == "__main__":
    main()
