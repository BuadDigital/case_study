# -*- coding: utf-8 -*-
from pathlib import Path

base = Path(r"c:\workspace\property_study\docs\new look")
files = list(base.rglob("Case Study.html"))
target = max(files, key=lambda p: p.stat().st_size)
print("TARGET:", target)
print("SIZE:", target.stat().st_size)
text = target.read_text(encoding="utf-8")

out = Path(r"c:\workspace\property_study\docs\new look\_extracted_all_tx\_gov_keys_extract")
out.mkdir(exist_ok=True)

# line number helper
def line_of(idx: int) -> int:
    return text.count("\n", 0, idx) + 1


m = text.find(":root")
(out / "01-root-css.css").write_text(text[m : m + 2800], encoding="utf-8")
print("root line", line_of(m))

for name, start_pat, length in [
    ("02-status.css", ".status{", 900),
    ("02b-status.css", ".status {", 900),
    ("03-btn-ghost.css", ".btn-ghost", 700),
    ("04-toolbar.css", ".toolbar", 900),
    ("05-card.css", ".card{", 1500),
    ("05b-card.css", ".card {", 1500),
    ("06-kpi.css", ".kpi", 2000),
    ("06b-stats.css", ".stats", 1500),
    ("07-nav.css", ".nav-item", 1500),
    ("07b-pill.css", ".sd{", 400),
    ("07c-actions.css", ".act-pop", 1200),
    ("07d-modal.css", ".overlay", 2000),
]:
    i = text.find(start_pat)
    if i >= 0:
        (out / name).write_text(text[i : i + length], encoding="utf-8")
        print(f"saved {name} line={line_of(i)}")
    else:
        print("miss", name)

keys_label = "إدارة المفاتيح"
i = text.find(keys_label)
print("keys label first", i, "line", line_of(i) if i >= 0 else None)
print("keys count", text.count(keys_label))

j = text.find("var PAGES")
print("PAGES line", line_of(j) if j >= 0 else None)
if j >= 0:
    (out / "08-PAGES.js").write_text(text[j : j + 9000], encoding="utf-8")

k = text.find("function renderList")
print("renderList line", line_of(k) if k >= 0 else None)
if k >= 0:
    (out / "09-renderList.js").write_text(text[k : k + 4000], encoding="utf-8")

# also function renderGeneric / setHeader / showView for structure
for fn in ["function renderGeneric", "function setHeader", "function showView", "function pill(", "function statCard", "function refreshStats"]:
    idx = text.find(fn)
    print(fn, "line", line_of(idx) if idx >= 0 else None)
    if idx >= 0:
        safe = fn.replace(" ", "_").replace("(", "").replace(")", "")
        (out / f"fn-{safe}.js").write_text(text[idx : idx + 2500], encoding="utf-8")

if i >= 0:
    (out / "10-around-keys.html").write_text(text[max(0, i - 1200) : i + 600], encoding="utf-8")

terms = [
    "المراجعة الحكومية",
    "بانتظار الظرف",
    "تسجيل الاستلام",
    "مراجع حكومي",
    "خطاب التفويض",
    "بانتظار الاستلام",
    "تعذرات مفاتيح",
    "مستلمة",
    "إجمالي المفاتيح",
]
for term in terms:
    idx = text.find(term)
    print(f"TERM {term!r}: count={text.count(term)} first_line={line_of(idx) if idx>=0 else None}")

# Extract the keys PAGES entry specifically
ki = text.find("'إدارة المفاتيح'")
if ki < 0:
    ki = text.find('"إدارة المفاتيح"')
print("PAGES keys entry", ki, line_of(ki) if ki >= 0 else None)
if ki >= 0:
    # take from entry start to next page entry or closing
    end = text.find("'إدارة التعذرات'", ki)
    if end < 0:
        end = ki + 2000
    (out / "11-keys-page-entry.js").write_text(text[ki:end], encoding="utf-8")

# Compare with root Case Study
root_cs = base / "Case Study.html"
rt = root_cs.read_text(encoding="utf-8")
print("ROOT size", len(rt), "has keys page", "إدارة المفاتيح" in rt and "إجمالي المفاتيح" in rt)
print("ROOT keys KPI", rt.find("إجمالي المفاتيح"))

# Also extract from المهام Case Study
others = [f for f in files if f != target]
for f in others:
    t = f.read_text(encoding="utf-8")
    print(f"OTHER {f.name} parent={f.parent.name} size={f.stat().st_size} keys_kpi={t.find('إجمالي المفاتيح')} pages={t.find('var PAGES')}")
