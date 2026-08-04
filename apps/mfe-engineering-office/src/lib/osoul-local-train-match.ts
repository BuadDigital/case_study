/**
 * Offline training-set matcher for Osoul pure-ink croquis tables.
 * No external APIs. Fingerprints from scripts/osoul_train/prepare_train_set.py
 *
 * Matching uses ink density profiles (stable across pdf.js vs PyMuPDF) +
 * zone correlations — not crypto.subtle (fails on non-secure origins).
 */

import trainIndex from "./osoul-local-train-index.json";

export type OsoulTrainMatch = {
  id: string;
  file: string;
  /** 0 = best; lower is better (1 - similarity). */
  score: number;
  hamming: number;
  zoneHits: number;
  descriptions: {
    north: string;
    south: string;
    east: string;
    west: string;
  };
  lengths: {
    north: string;
    south: string;
    east: string;
    west: string;
  };
};

type IndexItem = {
  id: string;
  file: string;
  contentSha?: string;
  contentShaTight?: string;
  zoneShas?: string[];
  /** Normalized row / col ink profiles (64 bins each). */
  rowProfile?: number[];
  colProfile?: number[];
  zoneProfiles?: number[][];
  descN: string;
  descS: string;
  descE: string;
  descW: string;
  lengthN?: string;
  lengthS?: string;
  lengthE?: string;
  lengthW?: string;
};

type IndexFile = {
  version?: number;
  minSimilarity?: number;
  items: IndexItem[];
};

const index = trainIndex as IndexFile;
const PROFILE_BINS = 64;

function inkMaskFromCanvas(source: HTMLCanvasElement): {
  w: number;
  h: number;
  ink: Uint8Array;
} {
  const ctx = source.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { w: 0, h: 0, ink: new Uint8Array(0) };
  const { width: w, height: h } = source;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const ink = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const g = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    ink[p] = g < 48 ? 1 : 0;
  }
  return { w, h, ink };
}

/** Resize 1D signal to fixed bins, L2-normalize. */
function resampleNormalize(src: number[], bins: number): number[] {
  if (!src.length) return Array(bins).fill(0);
  const out = new Array<number>(bins).fill(0);
  for (let i = 0; i < bins; i++) {
    const a = (i / bins) * src.length;
    const b = ((i + 1) / bins) * src.length;
    let s = 0;
    let n = 0;
    for (let j = Math.floor(a); j < Math.ceil(b) && j < src.length; j++) {
      s += src[j]!;
      n += 1;
    }
    out[i] = n ? s / n : 0;
  }
  let norm = 0;
  for (const v of out) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return out.map((v) => v / norm);
}

export function inkProfilesFromCanvas(source: HTMLCanvasElement): {
  row: number[];
  col: number[];
  zones: number[][];
} {
  const { w, h, ink } = inkMaskFromCanvas(source);
  const row = new Array<number>(h).fill(0);
  const col = new Array<number>(w).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (ink[y * w + x]) {
        row[y]! += 1;
        col[x]! += 1;
      }
    }
  }
  const zones: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const y0 = Math.floor(h * (0.3 + i * 0.16));
    const y1 = Math.floor(h * (0.3 + (i + 1) * 0.16));
    const slice = row.slice(Math.max(0, y0), Math.max(y0 + 1, y1));
    zones.push(resampleNormalize(slice, PROFILE_BINS));
  }
  return {
    row: resampleNormalize(row, PROFILE_BINS),
    col: resampleNormalize(col, PROFILE_BINS),
    zones,
  };
}

function cosine(a: number[] | undefined, b: number[] | undefined): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

/**
 * Match pure-ink table canvas against offline training fingerprint index.
 */
export function matchOsoulTrainIndex(
  pureInkCanvas: HTMLCanvasElement,
): OsoulTrainMatch | null {
  const items = index.items ?? [];
  if (!items.length || typeof document === "undefined") return null;

  const { row, col, zones } = inkProfilesFromCanvas(pureInkCanvas);
  const inkCount = (() => {
    const { ink } = inkMaskFromCanvas(pureInkCanvas);
    let n = 0;
    for (let i = 0; i < ink.length; i++) if (ink[i]) n += 1;
    return n;
  })();
  if (inkCount < 80) return null;

  const minSim = index.minSimilarity ?? 0.82;
  let best: { item: IndexItem; score: number; zoneHits: number } | null = null;

  for (const item of items) {
    if (!item.rowProfile?.length || !item.colProfile?.length) continue;
    const rowSim = cosine(row, item.rowProfile);
    const colSim = cosine(col, item.colProfile);
    let zoneAcc = 0;
    let zoneHits = 0;
    const zp = item.zoneProfiles ?? [];
    for (let i = 0; i < 4; i++) {
      const zs = cosine(zones[i], zp[i]);
      zoneAcc += zs;
      if (zs >= 0.88) zoneHits += 1;
    }
    const zoneSim = zoneAcc / 4;
    // Weighted: global structure + zone details
    const score = rowSim * 0.35 + colSim * 0.25 + zoneSim * 0.4;
    if (score < minSim && zoneHits < 3) continue;
    if (!best || score > best.score) {
      best = { item, score, zoneHits };
    }
  }

  if (!best) return null;
  const it = best.item;
  if (!it.descN && !it.descS && !it.descE && !it.descW) return null;

  return {
    id: it.id,
    file: it.file,
    score: best.score,
    hamming: Math.round((1 - best.score) * 100),
    zoneHits: best.zoneHits,
    descriptions: {
      north: it.descN || "",
      south: it.descS || "",
      east: it.descE || "",
      west: it.descW || "",
    },
    lengths: {
      north: it.lengthN || "",
      south: it.lengthS || "",
      east: it.lengthE || "",
      west: it.lengthW || "",
    },
  };
}

export function trainIndexSize(): number {
  return index.items?.length ?? 0;
}
