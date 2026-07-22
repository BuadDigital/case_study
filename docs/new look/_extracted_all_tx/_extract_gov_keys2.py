# -*- coding: utf-8 -*-
from pathlib import Path

base = Path(r"c:\workspace\property_study\docs\new look")
files = list(base.rglob("Case Study.html"))
target = max(files, key=lambda p: p.stat().st_size)
text = target.read_text(encoding="utf-8")
out = Path(r"c:\workspace\property_study\docs\new look\_extracted_all_tx\_gov_keys_extract")

def line_of(idx: int) -> int:
    return text.count("\n", 0, idx) + 1

# Extract card/grid/row CSS
for pat, name, n in [
    (".card{", "12-card.css", 1200),
    (".grid{", "13-grid.css", 800),
    (".thead{", "14-thead.css", 600),
    (".row{", "15-row.css", 600),
    (".th{", "16-th.css", 400),
    (".td{", "17-td.css", 400),
    (".primary{", "18-primary.css", 500),
    (".search{", "19-search.css", 500),
    ("#intakeOverlay", "20-intake.html", 3000),
    ("reopenOverlay", "21-reopen.html", 2500),
    (".modal", "22-modal.css", 1500),
]:
    i = text.find(pat)
    print(pat, "->", line_of(i) if i >= 0 else None)
    if i >= 0:
        (out / name).write_text(text[i : i + n], encoding="utf-8")

# Context around بانتظار الظرف
term = "بانتظار الظرف"
idx = 0
n = 0
while True:
    i = text.find(term, idx)
    if i < 0:
        break
    n += 1
    start = max(0, i - 400)
    end = min(len(text), i + 400)
    (out / f"23-awaiting-envelope-{n}.js").write_text(text[start:end], encoding="utf-8")
    print(f"awaiting envelope #{n} line {line_of(i)}")
    idx = i + len(term)

# Context around خطاب التفويض in actions menus
term = "خطاب التفويض"
idx = 0
n = 0
while True:
    i = text.find(term, idx)
    if i < 0:
        break
    n += 1
    if n <= 5:
        (out / f"24-delegation-{n}.js").write_text(text[max(0, i - 500) : i + 300], encoding="utf-8")
        print(f"delegation #{n} line {line_of(i)}")
    idx = i + len(term)
print("delegation total", n)

# PO view structure - find view-po and ORDERS table columns
for term in ["id=\"view-po\"", "id=\"view-generic\"", "سجل أوامر العمل", "رقم PO", "أمر عمل جديد"]:
    i = text.find(term)
    print(term, line_of(i) if i >= 0 else None)

# Extract PO KPI band HTML static
i = text.find('id="kpiTotal"')
if i >= 0:
    (out / "25-po-kpi-html.html").write_text(text[max(0, i - 800) : i + 1200], encoding="utf-8")
    print("po kpi html line", line_of(i))

# Sidebar HTML section
i = text.find('قسم دراسة الحالة')
if i >= 0:
    (out / "26-sidebar-case.html").write_text(text[i : i + 2500], encoding="utf-8")
    print("sidebar line", line_of(i))

# Compare keys pages across 3 Case Study files
print("\n=== KEYS PAGE COMPARE ===")
for f in sorted(files, key=lambda p: p.stat().st_size):
    t = f.read_text(encoding="utf-8")
    a = t.find("'إدارة المفاتيح'")
    if a < 0:
        a = t.find('"إدارة المفاتيح"')
    b = t.find("'إدارة التعذرات'", a) if a >= 0 else -1
    snippet = t[a:b] if a >= 0 and b > a else ""
    print(f.parent.name, "size", f.stat().st_size, "keys_entry_len", len(snippet))
    if snippet:
        (out / f"keys-compare-{f.stat().st_size}.js").write_text(snippet, encoding="utf-8")

# Screenshots inventory with sizes
print("\n=== SCREENSHOTS ===")
for folder_name in ["screenshots", "scraps", "uploads"]:
    for folder in base.rglob(folder_name):
        if not folder.is_dir():
            continue
        print("DIR", folder)
        for img in sorted(folder.iterdir()):
            if img.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".svg"}:
                print(f"  {img.name} {img.stat().st_size}")

# Look for any mention of government review dedicated page/nav
for term in ["المراجعة الحكومية", "government-review", "Government Review", "طابور"]:
    print(term, "count", text.count(term))
