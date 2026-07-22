# -*- coding: utf-8 -*-
from pathlib import Path
import re

base = Path(r"c:\workspace\property_study\docs\new look")
target = max(base.rglob("Case Study.html"), key=lambda p: p.stat().st_size)
text = target.read_text(encoding="utf-8")
out = Path(r"c:\workspace\property_study\docs\new look\_extracted_all_tx\_gov_keys_extract")

def line_of(idx: int) -> int:
    return text.count("\n", 0, idx) + 1

def extract_fn(name: str) -> str:
    start = text.find(f"function {name}(")
    if start < 0:
        start = text.find(f"function {name} ")
    if start < 0:
        return ""
    # find next function at indent "  function "
    nf = text.find("\n  function ", start + 10)
    # also consider end of script
    if nf < 0:
        nf = start + 8000
    return text[start:nf]

fns = [
    "keyRef", "keyPersist", "keyScen", "keyStat", "keyAssign", "keyHoType",
    "keyHoState", "keyTlMeta", "keyAtt", "keyPill", "keyTimeline", "keyFiltered",
    "keyDrawList", "renderKeys", "renderKeyDetail", "ensurePropEnv", "keyPanelForProp",
    "keyToday", "keyCloseModal", "keyModalShell", "keyErr", "openKeyRegister",
    "openKeyAssign", "openKeyHandoff", "openKeyResult", "keyConfirmHandoff",
    "markFeeCollected", "keySetCourtAccess", "renderKeyFees", "govProps",
    "renderGovReview", "govSetUser",
]

index_lines = []
for fn in fns:
    chunk = extract_fn(fn)
    if not chunk:
        print("MISSING", fn)
        continue
    start = text.find(f"function {fn}(")
    ln = line_of(start)
    (out / f"fn-{fn}.js").write_text(chunk, encoding="utf-8")
    index_lines.append(f"{fn}: lines {ln}-{ln + chunk.count(chr(10))} ({len(chunk)} chars)")
    print(index_lines[-1])

(out / "00-INDEX.txt").write_text(
    f"SOURCE: {target}\nSIZE: {target.stat().st_size}\n\n" + "\n".join(index_lines),
    encoding="utf-8",
)

# Also dump CSS for ghost-btn, muted, empty, modal shell patterns used by keys
for pat, name, n in [
    (".ghost-btn", "css-ghost-btn.css", 400),
    (".muted{", "css-muted.css", 200),
    (".empty{", "css-empty.css", 400),
    (".modal-card", "css-modal-card.css", 800),
    ("#keyModal", "css-keyModal.css", 600),
    (".fld{", "css-fld.css", 800),
    (".ov{", "css-ov.css", 600),
]:
    i = text.find(pat)
    print(pat, line_of(i) if i >= 0 else None)
    if i >= 0:
        (out / name).write_text(text[i : i + n], encoding="utf-8")

# Extract KEYS_DB / seed data if present
for term in ["var KEYS", "var ENVELOPES", "KEYS_DB", "_envelopes", "window.KEYS"]:
    i = text.find(term)
    print(term, line_of(i) if i >= 0 else None)

# Find state init for envelopes near keyRef
chunk = extract_fn("keyRef")
print("--- keyRef ---")
print(chunk[:800])
