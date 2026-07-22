# -*- coding: utf-8 -*-
from pathlib import Path

base = Path(r"c:\workspace\property_study\docs\new look")
target = max(base.rglob("Case Study.html"), key=lambda p: p.stat().st_size)
text = target.read_text(encoding="utf-8")
out = Path(r"c:\workspace\property_study\docs\new look\_extracted_all_tx\_gov_keys_extract")

def line_of(idx: int) -> int:
    return text.count("\n", 0, idx) + 1

for pat, name, n in [
    (".modal-overlay", "css-modal-overlay.css", 1500),
    (".modal{", "css-modal.css", 1200),
    (".modal-head", "css-modal-head.css", 800),
    (".dash-card", "css-dash-card.css", 400),
    (".ghost-btn{", "css-ghost-btn-full.css", 350),
    (".back-link", "css-back-link.css", 300),
    ('id="view-keys"', "html-view-keys.html", 300),
    ('id="view-govReview"', "html-view-gov.html", 300),
    ('id="view-keyFees"', "html-view-fees.html", 300),
    ('id="view-keyDetail"', "html-view-detail.html", 300),
]:
    i = text.find(pat)
    print(pat, line_of(i) if i>=0 else None)
    if i >= 0:
        (out / name).write_text(text[i:i+n], encoding="utf-8")

# Absolute path for report
print("ABS PATH:", target.resolve())
print("Parent:", target.parent.resolve())

# Confirm which folder: الأظرف vs المهام by checking unique content
print("has renderKeys", "function renderKeys" in text)
print("has renderGovReview", "function renderGovReview" in text)

# Smaller files content check
for f in base.rglob("Case Study.html"):
    t = f.read_text(encoding="utf-8")
    print(f.parent.name[:40], f.stat().st_size,
          "renderKeys=", "function renderKeys" in t,
          "renderGov=", "function renderGovReview" in t,
          "PAGES_keys=", "'إدارة المفاتيح'" in t and "إجمالي المفاتيح" in t)
