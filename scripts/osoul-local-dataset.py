#!/usr/bin/env python3
"""
Osoul croquis LOCAL training dataset builder.

- No cloud OCR, no external APIs.
- Renders each PDF page locally (PyMuPDF), isolates red/blue CAD ink
  on the dual-table strip (same crop logic as the product).
- Writes PNG crops + a labels manifest for future in-house reader training.

Usage:
  python scripts/osoul-local-dataset.py --pdf-dir "C:/Users/.../Downloads" --out datasets/osoul-croquis
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Install PyMuPDF: pip install pymupdf", file=sys.stderr)
    sys.exit(1)

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("Install pillow numpy: pip install pillow numpy", file=sys.stderr)
    sys.exit(1)

# Training PDFs (basenames; may include Arabic spaces / underscores)
TRAIN_NAMES = [
    "960607007945.pdf",
    "740108021165.pdf",
    "220117008099.pdf",
    "_594372007067-01 (المعدل النهائي).pdf",
    "340118006879.pdf",
    "325409002374.pdf",
    "_320124004269 معدل نهائي.pdf",
    "_960002976413المعدل.pdf",
    "340202000289.pdf",
    "460685003964.pdf",
    "560002509573.pdf",
    "320135000198.pdf",
]


def strip_key(name: str) -> str:
    return re.sub(r"[^\w\-]+", "_", Path(name).stem, flags=re.UNICODE)[:80]


def render_page_rgb(pdf_path: Path, scale: float = 2.4) -> Image.Image:
    doc = fitz.open(pdf_path)
    try:
        page = doc[0]
        mat = fitz.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        return img
    finally:
        doc.close()


def crop_left_table(img: Image.Image) -> Image.Image:
    """ALWAYS dual croquis tables بموجب الصك/الطبيعة (same as product CROQUIS_DUAL_TABLE_CROP)."""
    w, h = img.size
    # product: x=0, y=0.26, w=0.32, h=0.58
    left, top = 0.0 * w, 0.26 * h
    right, bot = 0.32 * w, 0.26 * h + 0.58 * h
    return img.crop((int(left), int(top), int(right), int(bot)))


def rotate_ccw90(img: Image.Image) -> Image.Image:
    # product rotateCanvasQuarter(strip, 3) ≈ 270° CW = 90° CCW
    return img.transpose(Image.Transpose.ROTATE_90)


def isolate_ink(img: Image.Image, mode: str) -> Image.Image:
    """mode: red | blue — keep colored strokes as black on white."""
    arr = np.asarray(img.convert("RGB"), dtype=np.int16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    if mode == "blue":
        keep = (b > 100) & (b >= r + 20) & (b >= g + 20)
    else:
        keep = (r > 100) & (r >= g + 20) & (r >= b + 20)
    out = np.full(arr.shape[:2], 255, dtype=np.uint8)
    out[keep] = 0
    return Image.fromarray(out, mode="L")


def pdf_text_length_tokens(pdf_path: Path) -> list[str]:
    doc = fitz.open(pdf_path)
    try:
        text = ""
        for page in doc:
            text += page.get_text("text") + "\n"
    finally:
        doc.close()
    tokens = re.findall(r"\d{1,3}(?:\.\d{1,3})?", text)
    # keep plausible edge meters
    out: list[str] = []
    for t in tokens:
        try:
            v = float(t)
        except ValueError:
            continue
        if 3 <= v <= 99:
            out.append(t)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--pdf-dir",
        type=Path,
        default=Path.home() / "Downloads",
        help="Folder that contains the training PDFs",
    )
    ap.add_argument(
        "--out",
        type=Path,
        default=Path("datasets/osoul-croquis"),
        help="Output dataset root (gitignored preferred)",
    )
    ap.add_argument(
        "--gold",
        type=Path,
        default=Path(
            "apps/mfe-engineering-office/__tests__/fixtures/osoul-croquis-gold.json"
        ),
        help="Offline gold labels (no API)",
    )
    args = ap.parse_args()

    gold_by_file: dict[str, dict] = {}
    if args.gold.exists():
        data = json.loads(args.gold.read_text(encoding="utf-8"))
        for item in data.get("items", []):
            gold_by_file[item.get("file", "")] = item

    args.out.mkdir(parents=True, exist_ok=True)
    manifest: dict = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "note": "Local pure-ink crops only. No external OCR APIs.",
        "items": [],
    }

    found = 0
    for name in TRAIN_NAMES:
        src = args.pdf_dir / name
        if not src.exists():
            # fuzzy: any file containing core id digits
            digits = re.sub(r"\D", "", name)[:12]
            cand = None
            if digits:
                for p in args.pdf_dir.glob("*.pdf"):
                    if digits in p.name:
                        cand = p
                        break
            if cand is None:
                print(f"SKIP missing: {name}")
                continue
            src = cand
            name = src.name

        key = strip_key(name)
        sample_dir = args.out / key
        sample_dir.mkdir(parents=True, exist_ok=True)

        page = render_page_rgb(src)
        strip = rotate_ccw90(crop_left_table(page))
        deed = isolate_ink(strip, "red")
        nature = isolate_ink(strip, "blue")
        deed_path = sample_dir / "deed-ink.png"
        nature_path = sample_dir / "nature-ink.png"
        full_path = sample_dir / "page.png"
        page.save(full_path)
        deed.save(deed_path)
        nature.save(nature_path)

        gold = gold_by_file.get(name) or gold_by_file.get(src.name) or {}
        lengths = gold.get("textLayerLengths") or pdf_text_length_tokens(src)
        labels = {
            "file": name,
            "sourcePath": str(src.resolve()),
            "deedInk": str(deed_path.as_posix()),
            "natureInk": str(nature_path.as_posix()),
            "page": str(full_path.as_posix()),
            "textLayerLengths": lengths[:12],
            "deedDescRaw": gold.get("deedDescRaw", ""),
            "descN": gold.get("descN", ""),
            "descS": gold.get("descS", ""),
            "descE": gold.get("descE", ""),
            "descW": gold.get("descW", ""),
        }
        (sample_dir / "labels.json").write_text(
            json.dumps(labels, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        manifest["items"].append(
            {
                "id": key,
                "file": name,
                "dir": str(sample_dir.as_posix()),
                "hasGoldRaw": bool(gold.get("deedDescRaw")),
                "lengthTokenCount": len(lengths),
            }
        )
        found += 1
        print(f"OK {found:02d} {name} → {sample_dir}")

    (args.out / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nDone: {found}/{len(TRAIN_NAMES)} → {args.out}")
    print("Next: train local reader on deed-ink.png + labels (no external API).")
    return 0 if found else 1


if __name__ == "__main__":
    raise SystemExit(main())
