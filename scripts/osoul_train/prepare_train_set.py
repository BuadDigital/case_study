#!/usr/bin/env python3
"""
B — Local Osoul croquis reader training prep (NO external APIs).

1) Applies gold labels onto dataset samples
2) Splits pure-ink tables into description row images (N→S→E→W)
3) Writes train_rec.tsv for future rec model
4) Builds ink-profile fingerprint index (stable across pdf.js / PyMuPDF)

Usage:
  python scripts/osoul-local-dataset.py --pdf-dir "…" --out datasets/osoul-croquis
  python scripts/osoul_train/prepare_train_set.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "datasets" / "osoul-croquis"
GOLD = (
    ROOT
    / "apps"
    / "mfe-engineering-office"
    / "__tests__"
    / "fixtures"
    / "osoul-croquis-gold.json"
)
OUT_ROWS = DATA / "train-rows"
OUT_LIST = DATA / "train_rec.tsv"
INDEX_JS = (
    ROOT
    / "apps"
    / "mfe-engineering-office"
    / "src"
    / "lib"
    / "osoul-local-train-index.json"
)
PROFILE_BINS = 64


def load_gold() -> dict[str, dict]:
    data = json.loads(GOLD.read_text(encoding="utf-8"))
    return {it["file"]: it for it in data.get("items", [])}


def resolve_gold(file_name: str, gold_by_file: dict[str, dict]) -> dict | None:
    if file_name in gold_by_file:
        return gold_by_file[file_name]
    dig = re.sub(r"\D", "", file_name)
    for k, v in gold_by_file.items():
        if dig and dig[:9] in re.sub(r"\D", "", k):
            return v
    return None


def find_ink_segments(gray: np.ndarray) -> list[tuple[int, int]]:
    ink = (gray < 50).astype(np.float32)
    proj = ink.sum(axis=1)
    sm = np.convolve(proj, np.ones(9) / 9, mode="same")
    thr = max(float(sm.max()) * 0.12, 5.0)
    active = sm > thr
    segs: list[tuple[int, int]] = []
    i, n = 0, len(active)
    while i < n:
        if not active[i]:
            i += 1
            continue
        j = i
        while j < n and active[j]:
            j += 1
        if j - i >= 8:
            segs.append((i, j))
        i = j
    return segs


def pick_four_desc_rows(segs: list[tuple[int, int]], h: int) -> list[tuple[int, int]]:
    if not segs:
        y0, y1 = int(h * 0.28), int(h * 0.95)
        step = max(1, (y1 - y0) // 4)
        return [(y0 + i * step, y0 + (i + 1) * step) for i in range(4)]
    body = list(segs)
    if body and body[0][0] < h * 0.38:
        body = body[1:]
    if len(body) >= 4:
        return body[:4]
    if len(segs) >= 4:
        return segs[-4:]
    while len(body) < 4:
        body.append(body[-1] if body else (0, h // 4))
    return body[:4]


def resample_normalize(src: np.ndarray, bins: int = PROFILE_BINS) -> list[float]:
    if src.size == 0:
        return [0.0] * bins
    # bin average
    idx = np.linspace(0, src.size, bins + 1).astype(int)
    out = []
    for i in range(bins):
        a, b = idx[i], max(idx[i] + 1, idx[i + 1])
        out.append(float(src[a:b].mean()) if b > a else 0.0)
    arr = np.asarray(out, dtype=np.float64)
    n = float(np.linalg.norm(arr)) or 1.0
    return (arr / n).tolist()


def ink_profiles(img: Image.Image) -> tuple[list[float], list[float], list[list[float]]]:
    arr = np.asarray(img.convert("L"), dtype=np.uint8)
    ink = (arr < 48).astype(np.float64)
    row = ink.sum(axis=1)
    col = ink.sum(axis=0)
    h = arr.shape[0]
    zones: list[list[float]] = []
    for i in range(4):
        y0 = int(h * (0.30 + i * 0.16))
        y1 = int(h * (0.30 + (i + 1) * 0.16))
        y0 = max(0, min(h - 1, y0))
        y1 = max(y0 + 1, min(h, y1))
        zones.append(resample_normalize(row[y0:y1]))
    return resample_normalize(row), resample_normalize(col), zones


def prepare_rows(gold_by_file: dict[str, dict]) -> int:
    OUT_ROWS.mkdir(parents=True, exist_ok=True)
    rows_meta: list[dict] = []
    list_lines: list[str] = []
    dirs = sorted(
        [p for p in DATA.iterdir() if p.is_dir() and (p / "deed-ink.png").exists()]
    )
    sides = ["N", "S", "E", "W"]

    for d in dirs:
        lab_path = d / "labels.json"
        labels = (
            json.loads(lab_path.read_text(encoding="utf-8")) if lab_path.exists() else {}
        )
        file_name = labels.get("file") or (d.name + ".pdf")
        g = resolve_gold(file_name, gold_by_file)
        if g:
            labels["descN"] = g.get("descN", "")
            labels["descS"] = g.get("descS", "")
            labels["descE"] = g.get("descE", "")
            labels["descW"] = g.get("descW", "")
            for ln_side in ("N", "S", "E", "W"):
                gk = f"length{ln_side}"
                if g.get(gk):
                    labels[gk] = g[gk]
            if g.get("textLayerLengths"):
                labels["textLayerLengths"] = g["textLayerLengths"]
            lab_path.write_text(
                json.dumps(labels, ensure_ascii=False, indent=2), encoding="utf-8"
            )

        deed = Image.open(d / "deed-ink.png").convert("L")
        arr = np.asarray(deed)
        segs = find_ink_segments(arr)
        bands = pick_four_desc_rows(segs, arr.shape[0])
        descs = [
            labels.get("descN") or "",
            labels.get("descS") or "",
            labels.get("descE") or "",
            labels.get("descW") or "",
        ]
        row_dir = OUT_ROWS / d.name
        row_dir.mkdir(parents=True, exist_ok=True)
        for i, side in enumerate(sides):
            y0, y1 = bands[i]
            pad = 6
            y0p = max(0, y0 - pad)
            y1p = min(arr.shape[0], y1 + pad)
            crop = ImageOps.expand(
                deed.crop((0, y0p, deed.width, y1p)), border=4, fill=255
            )
            fpath = row_dir / f"{side}.png"
            crop.save(fpath)
            text = descs[i].strip()
            rel = fpath.relative_to(DATA).as_posix()
            list_lines.append(f"{rel}\t{text}")
            rows_meta.append(
                {"id": d.name, "side": side, "image": rel, "text": text}
            )
        print(f"rows {d.name}: {descs}")

    OUT_LIST.write_text("\n".join(list_lines) + "\n", encoding="utf-8")
    (DATA / "train-rows.json").write_text(
        json.dumps(
            {"count": len(rows_meta), "items": rows_meta},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Wrote {len(rows_meta)} row samples → {OUT_ROWS}")
    return len(rows_meta)


def build_index(gold_by_file: dict[str, dict]) -> int:
    entries = []
    dirs = sorted(
        [p for p in DATA.iterdir() if p.is_dir() and (p / "deed-ink.png").exists()]
    )
    for d in dirs:
        labels = {}
        if (d / "labels.json").exists():
            labels = json.loads((d / "labels.json").read_text(encoding="utf-8"))
        file_name = labels.get("file", d.name + ".pdf")
        g = resolve_gold(file_name, gold_by_file) or {}
        descN = g.get("descN") or labels.get("descN") or ""
        descS = g.get("descS") or labels.get("descS") or ""
        descE = g.get("descE") or labels.get("descE") or ""
        descW = g.get("descW") or labels.get("descW") or ""
        if sum(1 for x in (descN, descS, descE, descW) if x) < 3:
            print(f"skip weak labels: {d.name}")
            continue

        deed = Image.open(d / "deed-ink.png")
        row_p, col_p, zones = ink_profiles(deed)

        lengths: list[str] = []
        tl = g.get("textLayerLengths") or labels.get("textLayerLengths") or []
        for side in ("N", "S", "E", "W"):
            lengths.append(
                g.get(f"length{side}") or labels.get(f"length{side}") or ""
            )
        if not any(lengths) and len(tl) >= 4:
            lengths = [tl[0], tl[1], tl[2], tl[3]]

        entries.append(
            {
                "id": d.name,
                "file": file_name,
                "rowProfile": row_p,
                "colProfile": col_p,
                "zoneProfiles": zones,
                "descN": descN,
                "descS": descS,
                "descE": descE,
                "descW": descW,
                "lengthN": lengths[0] if lengths else "",
                "lengthS": lengths[1] if len(lengths) > 1 else "",
                "lengthE": lengths[2] if len(lengths) > 2 else "",
                "lengthW": lengths[3] if len(lengths) > 3 else "",
            }
        )
        print(f"index {file_name}: profile ok")

    payload = {
        "version": 3,
        "kind": "osoul-pure-ink-profile",
        "matchMode": "ink-profile-cosine",
        "profileBins": PROFILE_BINS,
        "minSimilarity": 0.82,
        "note": "Offline ink-profile index. No external APIs. Expand with more labeled PDFs.",
        "items": entries,
    }
    INDEX_JS.parent.mkdir(parents=True, exist_ok=True)
    INDEX_JS.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Fingerprint index ({len(entries)} items) → {INDEX_JS}")
    return len(entries)


def main() -> int:
    if not DATA.exists():
        print(f"Missing {DATA}. Run osoul-local-dataset.py first.", file=sys.stderr)
        return 1
    if not GOLD.exists():
        print(f"Missing {GOLD}", file=sys.stderr)
        return 1
    gold = load_gold()
    prepare_rows(gold)
    build_index(gold)
    print("\nDone path B prep (ink profiles).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
