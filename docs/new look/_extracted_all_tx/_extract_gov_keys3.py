# -*- coding: utf-8 -*-
from pathlib import Path

base = Path(r"c:\workspace\property_study\docs\new look")
files = list(base.rglob("Case Study.html"))
target = max(files, key=lambda p: p.stat().st_size)
text = target.read_text(encoding="utf-8")
out = Path(r"c:\workspace\property_study\docs\new look\_extracted_all_tx\_gov_keys_extract")

def line_of(idx: int) -> int:
    return text.count("\n", 0, idx) + 1

# Find all gov-related functions
for term in [
    "function renderGovReview",
    "function renderKeys",
    "view-govReview",
    "govRegBtn",
    "data-gov-reg",
    "تسجيل ظرف",
    "function openGov",
    "govProps",
    "_keysStatus",
    "_env",
    "KeyEnvelope",
    "ظرف مسجّل",
    "حالة المفاتيح",
    "بوابة الظرف",
]:
    i = text.find(term)
    print(f"{term!r}: line={line_of(i) if i>=0 else None} count={text.count(term)}")

# Extract renderGovReview fully - find next function after it
start = text.find("function renderGovReview")
if start < 0:
    start = text.find("renderGovReview")
print("start", start, line_of(start) if start>=0 else None)

# Find end: next "function " at same indent level after a reasonable chunk
if start >= 0:
    # search for next top-level function after start+50
    nxt_candidates = []
    search_from = start + 20
    while True:
        nf = text.find("\n  function ", search_from)
        if nf < 0 or nf > start + 25000:
            break
        nxt_candidates.append(nf)
        search_from = nf + 10
        if len(nxt_candidates) >= 3:
            break
    end = nxt_candidates[0] if nxt_candidates else start + 12000
    print("end candidates lines", [line_of(x) for x in nxt_candidates])
    chunk = text[start:end]
    (out / "30-renderGovReview.js").write_text(chunk, encoding="utf-8")
    print("gov review chunk len", len(chunk), "lines", chunk.count("\n"))

# Also extract keys-related register modal if any
for term in ["function renderKeysEnvelopes", "function openEnvelope", "تسجيل ظرف مفاتيح", "keysOverlay", "envOverlay", "fee-report", "تقرير الأتعاب"]:
    i = text.find(term)
    print(f"{term!r}: line={line_of(i) if i>=0 else None}")

# Extract HTML shell for view-govReview
i = text.find('id="view-govReview"')
print("view-govReview html line", line_of(i) if i>=0 else None)
if i >= 0:
    (out / "31-view-govReview-shell.html").write_text(text[max(0,i-200):i+200], encoding="utf-8")

# Nav item for المراجعة الحكومية - how activated
i = text.find(">المراجعة الحكومية<")
if i < 0:
    i = text.find("المراجعة الحكومية</span>")
print("nav gov review span line", line_of(i) if i>=0 else None)
if i >= 0:
    (out / "32-nav-gov.html").write_text(text[max(0,i-600):i+200], encoding="utf-8")

# Extract around ghost-btn and gov register
i = text.find("data-gov-reg")
if i >= 0:
    (out / "33-gov-reg-btn.js").write_text(text[max(0,i-300):i+800], encoding="utf-8")

# List all function names containing gov/key/env/letter
import re
fns = re.findall(r"function\s+(\w*[Gg]ov\w*|\w*[Kk]ey\w*|\w*[Ee]nv\w*|\w*[Ll]etter\w*|\w*keys\w*)", text)
print("related functions:", sorted(set(fns)))
all_fns = re.findall(r"\n  function (\w+)\(", text)
print("total functions", len(all_fns))
# print ones that look relevant
for fn in all_fns:
    low = fn.lower()
    if any(x in low for x in ["gov", "key", "env", "letter", "court", "handoff", "fee", "review"]):
        print(" FN", fn, "line", line_of(text.find(f"function {fn}")))
