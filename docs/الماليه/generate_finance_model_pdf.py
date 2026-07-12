# -*- coding: utf-8 -*-
"""Generate agreed finance model PDF (Arabic RTL) with mind-map diagram."""

from __future__ import annotations

from pathlib import Path

from arabic_reshaper import reshape
from bidi.algorithm import get_display
from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[2]
OUT_PDF = Path(__file__).resolve().parent / "نموذج-المالية-المتفق-عليه.pdf"
FONT = Path(r"C:\Windows\Fonts\tahoma.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\tahomabd.ttf")
if not FONT_BOLD.exists():
    FONT_BOLD = FONT


def ar(text: str) -> str:
    """Shape + bidi for correct Arabic display in fpdf."""
    return get_display(reshape(text))


class FinancePdf(FPDF):
    def header(self) -> None:
        self.set_font("Tahoma", "", 9)
        self.set_text_color(100, 116, 139)
        self.cell(0, 6, ar("منصة دراسة الحالة العقارية — نموذج المالية المتفق عليه"), align="R")
        self.ln(4)
        self.set_draw_color(226, 232, 240)
        self.line(12, self.get_y(), self.w - 12, self.get_y())
        self.ln(6)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Tahoma", "", 8)
        self.set_text_color(148, 163, 184)
        self.cell(0, 8, f"{self.page_no()}", align="C")


def body(pdf: FinancePdf, text: str, size: int = 10) -> None:
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Tahoma", "", size)
    pdf.set_text_color(30, 41, 59)
    pdf.multi_cell(pdf.epw, 6.2, ar(text), align="R")
    pdf.ln(1)


def bullet(pdf: FinancePdf, text: str) -> None:
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Tahoma", "", 10)
    pdf.set_text_color(30, 41, 59)
    pdf.multi_cell(pdf.epw, 6, ar(f"- {text}"), align="R")


def section_title(pdf: FinancePdf, title: str) -> None:
    pdf.set_x(pdf.l_margin)
    pdf.ln(2)
    pdf.set_fill_color(15, 118, 110)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("TahomaBold", "", 12)
    pdf.cell(pdf.epw, 9, ar(title), fill=True, align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(30, 41, 59)
    pdf.ln(3)


def draw_mind_map(pdf: FinancePdf) -> None:
    """Simple RTL mind-map as nested boxes."""
    pdf.set_font("TahomaBold", "", 11)
    pdf.set_fill_color(15, 118, 110)
    pdf.set_text_color(255, 255, 255)
    page_w = pdf.w - 24
    x0 = 12
    y = pdf.get_y()

    # Root
    root_w = 70
    root_x = x0 + (page_w - root_w) / 2
    pdf.set_xy(root_x, y)
    pdf.cell(root_w, 10, ar("المالية"), fill=True, align="C")
    root_cy = y + 5
    root_bottom = y + 10

    # Two main branches
    y1 = root_bottom + 14
    col_w = (page_w - 8) / 2
    left_x = x0
    right_x = x0 + col_w + 8

    def branch_box(x: float, yb: float, w: float, h: float, title: str, fill: tuple[int, int, int]) -> float:
        pdf.set_fill_color(*fill)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("TahomaBold", "", 10)
        pdf.set_xy(x, yb)
        pdf.cell(w, h, ar(title), fill=True, align="C")
        return yb + h

    # Connectors from root
    pdf.set_draw_color(15, 118, 110)
    pdf.set_line_width(0.6)
    pdf.line(root_x + root_w / 2, root_bottom, left_x + col_w / 2, y1)
    pdf.line(root_x + root_w / 2, root_bottom, right_x + col_w / 2, y1)

    income_bottom = branch_box(right_x, y1, col_w, 9, "الدخل (من إنفاذ)", (20, 184, 166))
    expense_bottom = branch_box(left_x, y1, col_w, 9, "المصروفات", (245, 158, 11))

    pdf.set_text_color(30, 41, 59)
    pdf.set_font("Tahoma", "", 9)
    pdf.set_fill_color(240, 253, 250)

    # Income children
    items_income = [
        "1) دخل على إجمالي دراسة المعاملة",
        "2) دخل لتكاليف الرفع",
    ]
    iy = income_bottom + 4
    for item in items_income:
        pdf.set_xy(right_x + 2, iy)
        pdf.set_fill_color(236, 253, 245)
        pdf.set_draw_color(167, 243, 208)
        pdf.multi_cell(col_w - 4, 6, ar(item), fill=True, align="R", border=1)
        iy = pdf.get_y() + 2
        pdf.set_draw_color(20, 184, 166)
        pdf.line(right_x + col_w / 2, income_bottom, right_x + col_w / 2, iy - 8)

    # Expense children
    pdf.set_fill_color(255, 251, 235)
    ey = expense_bottom + 4
    pdf.set_xy(left_x + 2, ey)
    pdf.set_draw_color(253, 230, 138)
    pdf.multi_cell(col_w - 4, 6, ar("1) مكتب هندسي — نظير الرفع المساحي"), fill=True, align="R", border=1)
    ey = pdf.get_y() + 2

    pdf.set_xy(left_x + 2, ey)
    pdf.multi_cell(col_w - 4, 6, ar("2) متعاونون"), fill=True, align="R", border=1)
    ey = pdf.get_y() + 2

    # Nested cooperator
    nest_x = left_x + 8
    nest_w = col_w - 12
    pdf.set_fill_color(254, 243, 199)
    for item in [
        "المعاين المتعاون",
        "    • فرد — تسعيرة خاصة",
        "    • شركة — تسعيرة مختلفة",
        "المراجع الحكومي (متعاون)",
    ]:
        pdf.set_xy(nest_x, ey)
        pdf.multi_cell(nest_w, 5.5, ar(item), fill=True, align="R", border=1)
        ey = pdf.get_y() + 1.5

    pdf.set_y(max(iy, ey) + 6)
    pdf.set_x(pdf.l_margin)
    pdf.set_text_color(71, 85, 105)
    pdf.set_font("Tahoma", "", 8)
    pdf.multi_cell(
        pdf.epw,
        5,
        ar("مخطط ذهني — النموذج المستهدف المتفق عليه (ليس بالضرورة كل البنود مطبّقة في النظام حالياً)"),
        align="R",
    )
    pdf.set_x(pdf.l_margin)


def draw_flow(pdf: FinancePdf) -> None:
    steps = [
        "مسودة",
        "مشرف",
        "مالية",
        "أمر صرف",
        "مصروف",
    ]
    pdf.set_font("Tahoma", "", 9)
    n = len(steps)
    gap = 4
    usable = pdf.w - 24
    box_w = (usable - gap * (n - 1)) / n
    y = pdf.get_y()
    x = 12
    for i, step in enumerate(steps):
        pdf.set_fill_color(15, 118, 110) if i == n - 1 else pdf.set_fill_color(241, 245, 249)
        pdf.set_text_color(255, 255, 255) if i == n - 1 else pdf.set_text_color(30, 41, 59)
        pdf.set_xy(x, y)
        pdf.cell(box_w, 9, ar(step), fill=True, align="C", border=0)
        if i < n - 1:
            pdf.set_draw_color(148, 163, 184)
            pdf.set_line_width(0.5)
            pdf.line(x + box_w, y + 4.5, x + box_w + gap, y + 4.5)
        x += box_w + gap
    pdf.ln(14)


def main() -> None:
    pdf = FinancePdf(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.add_font("Tahoma", "", str(FONT))
    pdf.add_font("TahomaBold", "", str(FONT_BOLD))
    pdf.add_page()

    # Title
    pdf.set_font("TahomaBold", "", 18)
    pdf.set_text_color(15, 118, 110)
    pdf.cell(0, 10, ar("نموذج المالية المتفق عليه"), align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Tahoma", "", 10)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 6, ar("وارد من إنفاذ + صادر لأطراف التنفيذ — مع مقارنة الوضع الحالي"), align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    section_title(pdf, "1) المخطط الذهني")
    draw_mind_map(pdf)

    section_title(pdf, "2) الدخل (وارد من إنفاذ)")
    body(
        pdf,
        "يأتي الدخل من إنفاذ عند اكتمال أمر العمل. التفصيل المتفق عليه بندين:",
    )
    bullet(pdf, "دخل على إجمالي دراسة المعاملة")
    bullet(pdf, "دخل لتكاليف الرفع")
    body(
        pdf,
        "المطبّق في النظام: CaseStudyFeeSar + SurveyFeeSar لكل عقار، ثم فاتورة + ضريبة قيمة مضافة 15٪. الحفظ يقبل المبلغ القديم للتوافق.",
        size=9,
    )

    section_title(pdf, "3) المصروفات (صادر)")
    body(pdf, "المصروفات المتفق عليها:")
    bullet(pdf, "مصروف للمكتب الهندسي نظير الرفع المساحي")
    bullet(pdf, "مصروف للمتعاونين:")
    bullet(pdf, "المعاين المتعاون — فرد (تسعيرة) أو شركة (تسعيرة مختلفة)")
    bullet(pdf, "المراجع الحكومي (ضمن نموذجك كمتعاون مستحق)")

    section_title(pdf, "4) تسعير المعاين المتعاون (تفصيل متفق عليه)")
    body(
        pdf,
        "المعاين المتعاون ليس نوعاً واحداً: يوجد فرد ويوجد شركة، ولكل تسعيرة مختلفة. يجب تمييزهما عند إنشاء سجل الأتعاب وعند الصرف.",
    )
    body(
        pdf,
        "المطبّق: متعاون فرد 400 / متعاون شركة 500 / موظف 100. التسمية القديمة «متعاون» تُحسب كفرد.",
        size=9,
    )

    section_title(pdf, "5) مسار صرف الأتعاب الحالي (مطبق)")
    body(pdf, "مسار الدفع لأتعاب المعاينة والرفع المساحي كما هو مطبق:")
    draw_flow(pdf)
    bullet(pdf, "مسودة → رفع للمشرف → اعتماد → أمر صرف من المكتب → صرف من المالية")
    bullet(pdf, "فروع: إرجاع للمشرف / استفسار للمكتب")
    bullet(pdf, "ينطبق الآن على: المعاينة الميدانية + الرفع المساحي + المراجعة الحكومية")

    section_title(pdf, "6) مقارنة: المتفق عليه × المطبق الآن")
    rows = [
        ("البند", "المتفق عليه", "المطبق الآن"),
        ("دخل إنفاذ", "بندين: دراسة + رفع", "CaseStudy + Survey"),
        ("مكتب هندسي", "مصروف رفع مساحي", "موجود (أتعاب رفع)"),
        ("معاينة متعاون", "فرد / شركة بتسعيرتين", "فرد 400 / شركة 500"),
        ("مراجع حكومي", "ضمن المصروف", "سجل أتعاب عند التوزيع"),
        ("هامش", "إيراد − مصروفات", "إيراد إنفاذ − أتعاب أطراف"),
    ]
    col_w = [(pdf.epw) * r for r in (0.34, 0.33, 0.33)]
    pdf.set_x(pdf.l_margin)
    pdf.set_font("TahomaBold", "", 9)
    pdf.set_fill_color(15, 118, 110)
    pdf.set_text_color(255, 255, 255)
    for i, h in enumerate(rows[0]):
        pdf.cell(col_w[i], 7, ar(h), border=1, fill=True, align="C")
    pdf.ln()
    pdf.set_font("Tahoma", "", 8)
    pdf.set_x(pdf.l_margin)
    for r_i, row in enumerate(rows[1:]):
        pdf.set_x(pdf.l_margin)
        pdf.set_fill_color(248, 250, 252) if r_i % 2 == 0 else pdf.set_fill_color(255, 255, 255)
        pdf.set_text_color(30, 41, 59)
        for i, cell in enumerate(row):
            pdf.cell(col_w[i], 7, ar(cell), border=1, fill=True, align="C")
        pdf.ln()

    pdf.ln(4)
    section_title(pdf, "7) الخلاصة")
    bullet(pdf, "الاتجاه العام متطابق: وارد إنفاذ + صادر لأطراف التنفيذ")
    bullet(pdf, "مطبّق: إيراد إنفاذ بندين + تسعير فرد/شركة + أتعاب المراجع الحكومي عند التوزيع")
    bullet(pdf, "هذه الوثيقة مرجع الاتفاق التشغيلي مع الوضع المطبّق في الكود")

    pdf.ln(6)
    pdf.set_font("Tahoma", "", 9)
    pdf.set_text_color(100, 116, 139)
    pdf.multi_cell(
        0,
        5,
        ar("تاريخ الإصدار: حسب جلسة الاتفاق على نموذج المالية (دخل إنفاذ مفصّل + مصروفات المكتب والمتعاونين)."),
        align="R",
    )

    pdf.output(str(OUT_PDF))
    print("Wrote PDF OK:", OUT_PDF.exists(), OUT_PDF.stat().st_size if OUT_PDF.exists() else 0)


if __name__ == "__main__":
    main()
