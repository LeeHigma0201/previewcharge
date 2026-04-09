"""Generate HorseGPT Kinetic Cartography infographic — museum-quality PDF."""
import math
import random

from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
random.seed(314)

W = 18 * inch   # 1296 pt
H = 24 * inch   # 1728 pt
CX = W / 2      # center x
MARGIN = 1.5 * inch

FONTS = "C:/Users/walls/AppData/Roaming/Claude/local-agent-mode-sessions/skills-plugin/ff13e73c-1282-4422-9167-5d8e7b1baad0/9f310721-e8a1-4b37-a93f-a8d2ff223808/skills/canvas-design/canvas-fonts/"

# Register fonts
pdfmetrics.registerFont(TTFont("JuraLight", FONTS + "Jura-Light.ttf"))
pdfmetrics.registerFont(TTFont("JuraMedium", FONTS + "Jura-Medium.ttf"))
pdfmetrics.registerFont(TTFont("DMMono", FONTS + "DMMono-Regular.ttf"))
pdfmetrics.registerFont(TTFont("InstrumentSans", FONTS + "InstrumentSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("InstrumentSansBold", FONTS + "InstrumentSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("WorkSans", FONTS + "WorkSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Italiana", FONTS + "Italiana-Regular.ttf"))

# Palette
BG          = HexColor("#0B1120")
AMBER       = HexColor("#C4956A")
AMBER_LIGHT = HexColor("#DDB892")
SAGE        = HexColor("#5A7A58")
STEEL       = HexColor("#7A8FA3")
DUSTY_ROSE  = HexColor("#B07878")
GOLD        = HexColor("#C8B47A")
TEAL        = HexColor("#6B9BA8")
VIOLET      = HexColor("#9B8AB0")
CREAM       = HexColor("#CCC5B8")
FAINT       = HexColor("#1A2538")
RULE_COLOR  = HexColor("#2A3A50")

# Feature categories: (name, count, color, short_label)
CATEGORIES = [
    ("SPEED",     5,  AMBER,      "SPD"),
    ("PACE",      8,  SAGE,       "PCE"),
    ("CLASS",     6,  STEEL,      "CLS"),
    ("FORM",      6,  DUSTY_ROSE, "FRM"),
    ("JOCKEY/TRAINER", 10, GOLD,  "J/T"),
    ("POST",      3,  TEAL,       "PST"),
    ("DISTANCE",  5,  VIOLET,     "DST"),
    ("ODDS",      4,  AMBER_LIGHT,"ODS"),
    ("EQUIPMENT", 3,  SAGE,       "EQP"),
]

OUT = "C:/Users/walls/previewcharge/horsegpt_infographic.pdf"

# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def tracked_text(c, x, y, text, font, size, tracking=0):
    """Draw text with manual letter-spacing, returns total width."""
    c.setFont(font, size)
    total = 0
    for ch in text:
        c.drawString(x + total, y, ch)
        total += c.stringWidth(ch, font, size) + tracking
    return total

def tracked_text_centered(c, cx, y, text, font, size, tracking=0):
    """Draw tracked text centered on cx."""
    # Compute total width first
    c.setFont(font, size)
    total = sum(c.stringWidth(ch, font, size) + tracking for ch in text) - tracking
    tracked_text(c, cx - total / 2, y, text, font, size, tracking)

def thin_rule(c, x1, y, x2, alpha=0.3):
    c.saveState()
    c.setStrokeColor(RULE_COLOR)
    c.setStrokeAlpha(alpha)
    c.setLineWidth(0.5)
    c.line(x1, y, x2, y)
    c.restoreState()

# ---------------------------------------------------------------------------
# MARK DRAWING FUNCTIONS (one per feature category)
# ---------------------------------------------------------------------------

def draw_chevron(c, x, y, s=8):
    """Speed: rightward chevron ›"""
    p = c.beginPath()
    p.moveTo(x - 3, y + s)
    p.lineTo(x + s * 0.8, y)
    p.lineTo(x - 3, y - s)
    c.drawPath(p, fill=0, stroke=1)

def draw_pace_bar(c, x, y, w=28, h=4):
    """Pace: three-segment horizontal bar"""
    seg = w / 3 - 1.5
    ox = x - w / 2
    for i in range(3):
        alpha = [0.95, 0.5, 0.85][i]
        c.setFillAlpha(alpha)
        c.rect(ox + i * (seg + 2), y - h / 2, seg, h, fill=1, stroke=0)
    c.setFillAlpha(1)

def draw_class_stack(c, x, y, w=20, h=14):
    """Class: stacked thin rectangles"""
    for i in range(3):
        ry = y - h / 2 + i * (h / 3 + 1)
        rw = w - i * 3
        c.rect(x - rw / 2, ry, rw, h / 3 - 1.5, fill=0, stroke=1)

_form_call_count = 0
def draw_form_circle(c, x, y, r=5.5, filled=True):
    """Form: circle — alternates filled/open to show cycle states."""
    global _form_call_count
    _form_call_count += 1
    is_filled = _form_call_count % 3 != 0  # 2 filled, 1 open, repeat
    c.circle(x, y, r, fill=1 if is_filled else 0, stroke=1)

def draw_paired_dots(c, x, y, r=3.5, gap=10):
    """Jockey/Trainer: paired dots"""
    c.circle(x - gap / 2, y, r, fill=1, stroke=0)
    c.circle(x + gap / 2, y, r, fill=1, stroke=0)

def draw_post_bar(c, x, y, h=14, w=3):
    """Post: vertical bar"""
    c.rect(x - w / 2, y - h / 2, w, h, fill=1, stroke=0)

def draw_cross(c, x, y, s=6):
    """Distance: small cross"""
    c.line(x - s, y, x + s, y)
    c.line(x, y - s, x, y + s)

def draw_triangle(c, x, y, s=7):
    """Odds: small triangle"""
    p = c.beginPath()
    p.moveTo(x, y + s)
    p.lineTo(x - s * 0.7, y - s * 0.5)
    p.lineTo(x + s * 0.7, y - s * 0.5)
    p.close()
    c.drawPath(p, fill=0, stroke=1)

def draw_diamond(c, x, y, s=6):
    """Equipment: diamond"""
    p = c.beginPath()
    p.moveTo(x, y + s)
    p.lineTo(x + s, y)
    p.lineTo(x, y - s)
    p.lineTo(x - s, y)
    p.close()
    c.drawPath(p, fill=0, stroke=1)

MARK_FUNCS = [
    draw_chevron, draw_pace_bar, draw_class_stack, draw_form_circle,
    draw_paired_dots, draw_post_bar, draw_cross, draw_triangle, draw_diamond,
]

# ---------------------------------------------------------------------------
# SECTION RENDERERS
# ---------------------------------------------------------------------------

def draw_background(c):
    c.setFillColor(BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)

    # Subtle grid texture
    c.setStrokeColor(FAINT)
    c.setStrokeAlpha(0.12)
    c.setLineWidth(0.3)
    step = 18
    for x in range(0, int(W), step):
        c.line(x, 0, x, H)
    for y in range(0, int(H), step):
        c.line(0, y, W, y)
    c.setStrokeAlpha(1)

    # Subtle oval track ghost in center (Easter egg)
    c.saveState()
    c.setStrokeColor(FAINT)
    c.setStrokeAlpha(0.06)
    c.setLineWidth(0.8)
    oy = 11.5 * inch  # center of feature zone
    for i in range(4):
        rx = 4.5 * inch + i * 12
        ry = 2.8 * inch + i * 8
        c.ellipse(CX - rx, oy - ry, CX + rx, oy + ry, fill=0, stroke=1)
    c.restoreState()


def draw_title(c):
    """Top title zone with subtle glow."""
    y_title = 22.6 * inch

    # Title glow (layered translucent circles behind text)
    c.saveState()
    c.setFillColor(AMBER)
    for r, a in [(120, 0.012), (80, 0.018), (50, 0.025)]:
        c.setFillAlpha(a)
        c.circle(CX, y_title + 8, r, fill=1, stroke=0)
    c.restoreState()

    # Main title
    c.saveState()
    c.setFillColor(CREAM)
    c.setFillAlpha(0.92)
    tracked_text_centered(c, CX, y_title, "HORSEGPT", "JuraLight", 52, 14)

    # Version
    c.setFillAlpha(0.45)
    c.setFont("DMMono", 13)
    c.drawCentredString(CX, y_title - 28, "v 3 . 1 4")
    c.restoreState()

    # Thin rule
    thin_rule(c, MARGIN + 1.5 * inch, y_title - 48, W - MARGIN - 1.5 * inch, 0.25)

    # Subtitle
    c.saveState()
    c.setFillColor(CREAM)
    c.setFillAlpha(0.32)
    c.setFont("InstrumentSans", 9.5)
    c.drawCentredString(CX, y_title - 66, "A  STUDY  IN  PROBABILISTIC  FORM  ANALYSIS")
    c.restoreState()


def draw_data_sources(c):
    """Three barcode-like columns representing data ingestion."""
    y_top = 21.3 * inch
    y_bot = 18.8 * inch
    cols = [4.5 * inch, CX, 13.5 * inch]
    labels = ["BRIS  DATA", "EQUIBASE", "DRF"]
    sublabels = ["1430+  FIELDS", "WEB  SCRAPE", "FREE  API"]
    counts = [55, 35, 30]

    for ci, (col_x, label, sub, cnt) in enumerate(zip(cols, labels, sublabels, counts)):
        rng = random.Random(ci * 100 + 7)
        step = (y_top - y_bot) / cnt

        c.saveState()
        c.setFillColor(AMBER)

        for i in range(cnt):
            y = y_bot + i * step
            w = rng.uniform(12, 72)
            alpha = 0.25 + 0.55 * (i / cnt)
            c.setFillAlpha(alpha)
            c.rect(col_x - w / 2, y, w, 1.2, fill=1, stroke=0)

        c.restoreState()

        # Column label
        c.saveState()
        c.setFillColor(CREAM)
        c.setFillAlpha(0.55)
        c.setFont("DMMono", 8)
        c.drawCentredString(col_x, y_bot - 18, label)
        c.setFillAlpha(0.3)
        c.setFont("DMMono", 6.5)
        c.drawCentredString(col_x, y_bot - 30, sublabels[ci])
        c.restoreState()

        # Roman numeral
        c.saveState()
        c.setFillColor(AMBER)
        c.setFillAlpha(0.35)
        c.setFont("Italiana", 11)
        numerals = ["I", "II", "III"]
        c.drawCentredString(col_x, y_top + 12, numerals[ci])
        c.restoreState()

    # Section label
    c.saveState()
    c.setFillColor(CREAM)
    c.setFillAlpha(0.35)
    c.setFont("InstrumentSans", 8)
    c.drawString(MARGIN + 8, y_top + 14, "DATA  INGESTION")
    c.restoreState()

    thin_rule(c, MARGIN, 18.5 * inch, W - MARGIN, 0.18)


def draw_flow_lines(c):
    """Curved lines connecting data sources down to feature matrix."""
    cols = [4.5 * inch, CX, 13.5 * inch]
    y_start = 18.5 * inch
    y_end = 17.5 * inch

    c.saveState()
    c.setStrokeColor(AMBER)
    c.setStrokeAlpha(0.22)
    c.setLineWidth(0.7)

    for col_x in cols:
        p = c.beginPath()
        p.moveTo(col_x, y_start)
        p.curveTo(col_x, y_start - 30, CX, y_end + 30, CX, y_end)
        c.drawPath(p, fill=0, stroke=1)

    c.restoreState()

    # Convergence dot
    c.saveState()
    c.setFillColor(AMBER)
    c.setFillAlpha(0.45)
    c.circle(CX, y_end, 3, fill=1, stroke=0)
    c.setFillAlpha(0.1)
    c.circle(CX, y_end, 10, fill=1, stroke=0)
    c.restoreState()

    # Vertical flow line down to features
    c.saveState()
    c.setStrokeColor(AMBER)
    c.setStrokeAlpha(0.12)
    c.setLineWidth(0.5)
    c.line(CX, y_end, CX, 17 * inch)
    c.restoreState()


def draw_feature_matrix(c):
    """The hero section: 50 feature marks in 9 category groups."""
    # Zone: y = 9" to 16.8"
    zone_top = 16.8 * inch
    zone_bot = 9.2 * inch
    zone_h = zone_top - zone_bot

    # Section label
    c.saveState()
    c.setFillColor(CREAM)
    c.setFillAlpha(0.35)
    c.setFont("InstrumentSans", 8)
    c.drawString(MARGIN + 8, zone_top + 16, "FEATURE  ENGINEERING")
    c.restoreState()

    # Thin label: "50 FEATURES  ·  9 CATEGORIES  ·  Z-SCORED WITHIN FIELD"
    c.saveState()
    c.setFillColor(CREAM)
    c.setFillAlpha(0.32)
    c.setFont("DMMono", 7)
    c.drawRightString(W - MARGIN - 8, zone_top + 16,
                      "50  FEATURES   ·   9  CATEGORIES   ·   Z-SCORED  WITHIN  FIELD")
    c.restoreState()

    thin_rule(c, MARGIN, zone_top + 10, W - MARGIN, 0.15)

    # 3x3 grid layout
    # Row 0 (top):    SPEED(5),  CLASS(6),  FORM(6)
    # Row 1 (middle): PACE(8),   J/T(10),   DIST(5)
    # Row 2 (bottom): POST(3),   ODDS(4),   EQUIP(3)
    grid = [
        [0, 2, 3],   # SPEED, CLASS, FORM
        [1, 4, 6],   # PACE, J/T, DISTANCE
        [5, 7, 8],   # POST, ODDS, EQUIP
    ]

    col_centers = [4.2 * inch, CX, 13.8 * inch]
    row_centers = [
        zone_bot + zone_h * 0.78,  # top row
        zone_bot + zone_h * 0.48,  # middle row
        zone_bot + zone_h * 0.18,  # bottom row
    ]
    cell_w = 4.0 * inch
    mark_spacing = 16

    feature_idx = 1  # running feature counter for labels

    for ri, row in enumerate(grid):
        for ci_in_row, cat_idx in enumerate(row):
            cat_name, cat_count, cat_color, cat_short = CATEGORIES[cat_idx]
            cx = col_centers[ci_in_row]
            cy = row_centers[ri]

            # Category label
            c.saveState()
            c.setFillColor(cat_color)
            c.setFillAlpha(0.75)
            c.setFont("DMMono", 9)
            label_y = cy + (cat_count / 2) * mark_spacing + 22
            c.drawCentredString(cx, label_y, cat_name)

            # Count
            c.setFillAlpha(0.4)
            c.setFont("DMMono", 7)
            c.drawCentredString(cx, label_y - 13, f"({cat_count})")
            c.restoreState()

            # Draw marks
            marks_start_y = cy + ((cat_count - 1) / 2) * mark_spacing
            mark_func = MARK_FUNCS[cat_idx]

            c.saveState()
            c.setStrokeColor(cat_color)
            c.setFillColor(cat_color)
            c.setLineWidth(1.0)

            for mi in range(cat_count):
                my = marks_start_y - mi * mark_spacing

                # Draw the mark
                c.setStrokeAlpha(0.85)
                c.setFillAlpha(0.75)
                mark_func(c, cx, my)

                # Reference label
                c.setFillAlpha(0.35)
                c.setFont("DMMono", 6)
                c.drawString(cx + 22, my - 2.5, f"F.{feature_idx:02d}")
                feature_idx += 1

            c.restoreState()

            # Subtle border around group
            c.saveState()
            c.setStrokeColor(cat_color)
            c.setStrokeAlpha(0.08)
            c.setLineWidth(0.5)
            group_h = cat_count * mark_spacing + 24
            c.roundRect(cx - cell_w / 2.5, cy - group_h / 2 - 2,
                        cell_w / 1.25, group_h + 44, 4, fill=0, stroke=1)
            c.restoreState()

    thin_rule(c, MARGIN, zone_bot - 8, W - MARGIN, 0.18)

    # Connecting flow line to model section
    c.saveState()
    c.setStrokeColor(AMBER)
    c.setStrokeAlpha(0.1)
    c.setLineWidth(0.4)
    c.line(CX, zone_bot - 8, CX, 9.0 * inch)
    # Small flow dot
    c.setFillColor(AMBER)
    c.setFillAlpha(0.2)
    c.circle(CX, 9.0 * inch, 2, fill=1, stroke=0)
    c.restoreState()


def draw_model_convergence(c):
    """Two model paths converging into ensemble."""
    zone_top = 8.8 * inch
    zone_bot = 5.0 * inch
    converge_y = zone_bot + 0.6 * inch

    # Section label
    c.saveState()
    c.setFillColor(CREAM)
    c.setFillAlpha(0.35)
    c.setFont("InstrumentSans", 8)
    c.drawString(MARGIN + 8, zone_top + 12, "MODEL  ENSEMBLE")
    c.restoreState()

    # LightGBM path (left, thicker — 0.7 weight)
    lgbm_x = 5.5 * inch
    benter_x = 12.5 * inch

    # LightGBM
    c.saveState()
    c.setStrokeColor(AMBER)
    c.setStrokeAlpha(0.6)
    c.setLineWidth(2.2)
    p = c.beginPath()
    p.moveTo(lgbm_x, zone_top)
    p.curveTo(lgbm_x, zone_top - 60, CX - 20, converge_y + 60, CX, converge_y)
    c.drawPath(p, fill=0, stroke=1)
    c.restoreState()

    # LightGBM label
    c.saveState()
    c.setFillColor(AMBER)
    c.setFillAlpha(0.5)
    c.setFont("DMMono", 8)
    c.drawCentredString(lgbm_x, zone_top + 10, "LIGHTGBM")
    c.setFillAlpha(0.3)
    c.setFont("DMMono", 6.5)
    c.drawCentredString(lgbm_x, zone_top - 6, "w = 0.70")
    c.restoreState()

    # Benter logistic (right, thinner — 0.3 weight)
    c.saveState()
    c.setStrokeColor(GOLD)
    c.setStrokeAlpha(0.5)
    c.setLineWidth(1.0)
    p = c.beginPath()
    p.moveTo(benter_x, zone_top)
    p.curveTo(benter_x, zone_top - 60, CX + 20, converge_y + 60, CX, converge_y)
    c.drawPath(p, fill=0, stroke=1)
    c.restoreState()

    # Benter label
    c.saveState()
    c.setFillColor(GOLD)
    c.setFillAlpha(0.5)
    c.setFont("DMMono", 8)
    c.drawCentredString(benter_x, zone_top + 10, "BENTER  LOGISTIC")
    c.setFillAlpha(0.3)
    c.setFont("DMMono", 6.5)
    c.drawCentredString(benter_x, zone_top - 6, "w = 0.30")
    c.restoreState()

    # Convergence point
    c.saveState()
    c.setFillColor(AMBER)
    c.setFillAlpha(0.5)
    c.circle(CX, converge_y, 4, fill=1, stroke=0)
    c.setFillAlpha(0.12)
    c.circle(CX, converge_y, 14, fill=1, stroke=0)
    c.restoreState()

    # "LOG-ODDS SPACE" label at convergence
    c.saveState()
    c.setFillColor(CREAM)
    c.setFillAlpha(0.3)
    c.setFont("DMMono", 6)
    c.drawCentredString(CX, converge_y - 22, "LOG-ODDS  SPACE")
    c.restoreState()

    # Odds offset notation
    c.saveState()
    c.setFillColor(CREAM)
    c.setFillAlpha(0.2)
    c.setFont("DMMono", 5.5)
    c.drawCentredString(CX, converge_y - 34, "logit(p) = offset + residual")
    c.restoreState()

    # Vertical line down to output
    c.saveState()
    c.setStrokeColor(AMBER)
    c.setStrokeAlpha(0.12)
    c.setLineWidth(0.5)
    c.line(CX, converge_y - 40, CX, 4.2 * inch)
    c.restoreState()

    thin_rule(c, MARGIN, zone_bot - 10, W - MARGIN, 0.15)


def draw_monte_carlo(c):
    """Monte Carlo scatter field forming a probability distribution."""
    zone_top = 4.5 * inch
    zone_bot = 1.8 * inch
    base_y = 2.4 * inch
    curve_height = 1.6 * inch
    curve_width = 10 * inch

    # Section label
    c.saveState()
    c.setFillColor(CREAM)
    c.setFillAlpha(0.35)
    c.setFont("InstrumentSans", 8)
    c.drawString(MARGIN + 8, zone_top + 8, "MONTE  CARLO  SIMULATION")
    c.restoreState()

    # Draw the probability distribution as a filled shape (very subtle)
    c.saveState()
    p = c.beginPath()
    left_x = CX - curve_width / 2
    right_x = CX + curve_width / 2
    p.moveTo(left_x, base_y)
    steps = 120
    for i in range(steps + 1):
        x = left_x + (right_x - left_x) * i / steps
        t = (i - steps / 2) / (steps / 2)  # -1 to 1
        # Slightly asymmetric (skewed right — favoring favorites)
        h = math.exp(-3.5 * (t - 0.05) ** 2) * curve_height
        p.lineTo(x, base_y + h)
    p.lineTo(right_x, base_y)
    p.close()
    c.setFillColor(AMBER)
    c.setFillAlpha(0.04)
    c.drawPath(p, fill=1, stroke=0)
    c.restoreState()

    # Draw the curve outline
    c.saveState()
    c.setStrokeColor(AMBER)
    c.setStrokeAlpha(0.3)
    c.setLineWidth(1.0)
    p2 = c.beginPath()
    for i in range(steps + 1):
        x = left_x + (right_x - left_x) * i / steps
        t = (i - steps / 2) / (steps / 2)
        h = math.exp(-3.5 * (t - 0.05) ** 2) * curve_height
        if i == 0:
            p2.moveTo(x, base_y + h)
        else:
            p2.lineTo(x, base_y + h)
    c.drawPath(p2, fill=0, stroke=1)
    c.restoreState()

    # Monte Carlo dots
    rng = random.Random(42)
    c.saveState()
    for _ in range(500):
        # Gaussian distribution matching the curve
        dx = rng.gauss(0.05, 0.28) * curve_width / 2
        if abs(dx) > curve_width / 2 - 10:
            continue
        # Height within curve envelope
        t = dx / (curve_width / 2)
        max_h = math.exp(-3.5 * (t - 0.05) ** 2) * curve_height
        dy = rng.uniform(2, max(3, max_h - 2))
        if dy > max_h - 1:
            continue
        x = CX + dx
        y = base_y + dy
        # Alpha based on density (center brighter)
        a = 0.15 + 0.45 * math.exp(-2 * t * t)
        c.setFillColor(AMBER)
        c.setFillAlpha(a)
        r = rng.uniform(0.8, 1.8)
        c.circle(x, y, r, fill=1, stroke=0)
    c.restoreState()

    # Baseline
    c.saveState()
    c.setStrokeColor(AMBER)
    c.setStrokeAlpha(0.2)
    c.setLineWidth(0.5)
    c.line(left_x, base_y, right_x, base_y)
    c.restoreState()

    # Sum = 1 notation
    c.saveState()
    c.setFillColor(CREAM)
    c.setFillAlpha(0.35)
    c.setFont("Italiana", 12)
    c.drawCentredString(CX, base_y - 20, "\u03A3 p = 1.0")
    c.restoreState()

    # "SOFTMAX NORMALIZATION" below
    c.saveState()
    c.setFillColor(CREAM)
    c.setFillAlpha(0.18)
    c.setFont("DMMono", 5.5)
    c.drawCentredString(CX, base_y - 36, "SOFTMAX  NORMALIZATION  ACROSS  RACE  FIELD")
    c.restoreState()


def draw_footer(c):
    """Bottom footer."""
    y = 0.65 * inch

    thin_rule(c, MARGIN + 2 * inch, y + 16, W - MARGIN - 2 * inch, 0.15)

    # Footer text
    c.saveState()
    c.setFillColor(CREAM)
    c.setFillAlpha(0.28)
    c.setFont("InstrumentSans", 8)
    c.drawCentredString(CX, y, "MULTI-MODEL  HORSE  RACING  HANDICAPPING  ·  BENTER  LOGISTIC  +  LIGHTGBM  ENSEMBLE")
    c.restoreState()

    c.saveState()
    c.setFillColor(CREAM)
    c.setFillAlpha(0.17)
    c.setFont("DMMono", 6.5)
    c.drawCentredString(CX, y - 16, "ENTRY = HORSE \u00d7 RACE   ·   MARKET ODDS AS LOGIT OFFSET   ·   HENERY NORMAL MODEL")
    c.restoreState()


def draw_side_annotations(c):
    """Small reference annotations along the margins."""
    c.saveState()
    c.setFillColor(CREAM)
    c.setFillAlpha(0.18)
    c.setFont("DMMono", 5.5)

    # Left margin annotations
    notes_left = [
        (20.5 * inch, "INGEST"),
        (17.0 * inch, "PARSE"),
        (13.0 * inch, "Z-SCORE"),
        (8.0  * inch, "FIT"),
        (4.0  * inch, "PREDICT"),
    ]
    for y, txt in notes_left:
        c.saveState()
        c.translate(MARGIN - 14, y)
        c.rotate(90)
        c.drawString(0, 0, txt)
        c.restoreState()

    # Right margin: pipeline step numbers
    steps = [
        (20.5 * inch, "01"),
        (17.0 * inch, "02"),
        (13.0 * inch, "03"),
        (8.0  * inch, "04"),
        (4.0  * inch, "05"),
    ]
    c.setFillAlpha(0.12)
    for y, num in steps:
        c.setFont("DMMono", 5)
        c.drawRightString(W - MARGIN + 10, y, num)

    c.restoreState()

    # Small dots marking pipeline stages along center
    c.saveState()
    c.setFillColor(AMBER)
    c.setFillAlpha(0.08)
    for y_inch in [18.5, 17.0, 9.0, 5.0, 4.2]:
        c.circle(CX, y_inch * inch, 1.5, fill=1, stroke=0)
    c.restoreState()


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    c_pdf = canvas.Canvas(OUT, pagesize=(W, H))
    c_pdf.setTitle("HorseGPT v3.14 — Kinetic Cartography")
    c_pdf.setAuthor("HorseGPT")

    # Draw layers back to front
    draw_background(c_pdf)
    draw_title(c_pdf)
    draw_data_sources(c_pdf)
    draw_flow_lines(c_pdf)
    draw_feature_matrix(c_pdf)
    draw_model_convergence(c_pdf)
    draw_monte_carlo(c_pdf)
    draw_footer(c_pdf)
    draw_side_annotations(c_pdf)

    c_pdf.save()
    print(f"Saved: {OUT}")


if __name__ == "__main__":
    main()
