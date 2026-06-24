import type { PoRow } from "@platform/app-shared/prototype/constants";
import type { PropertyListItem } from "@platform/app-shared/prototype/work-orders-read";

export type PoListSearchMode = "all" | "po" | "deed" | "text";

export type PoListSearchMatch = {
  mode: PoListSearchMode;
  deedNumber?: string;
  propertyId?: string;
  propertyArea?: string;
};

export type PoListFilteredRow = {
  row: PoRow;
  match: PoListSearchMatch | null;
  /** All deeds on this PO — for the deed column when listing PO rows. */
  deeds: PoDeedIndexEntry[];
};

export type PoListPropertyHit = {
  row: PoRow;
  deed: PoDeedIndexEntry;
  match: PoListSearchMatch;
};

export type PoListDisplayItem =
  | { view: "po"; item: PoListFilteredRow }
  | { view: "property"; item: PoListPropertyHit };

function deedsForPo(poNumber: string, deedIndex: PoDeedIndexEntry[]) {
  return deedIndex.filter((entry) => entry.poNumber === poNumber);
}

export function buildPoListDisplay(
  rows: PoRow[],
  query: string,
  deedIndex: PoDeedIndexEntry[],
): PoListDisplayItem[] {
  const q = query.trim();
  if (!q) {
    return rows.map((row) => ({
      view: "po" as const,
      item: { row, match: null, deeds: deedsForPo(row.id, deedIndex) },
    }));
  }

  const mode = classifyPoListSearch(q);
  if (mode === "deed") {
    const poById = new Map(rows.map((row) => [row.id, row]));
    const hits: Extract<PoListDisplayItem, { view: "property" }>[] = [];
    for (const deed of deedIndex) {
      if (!deedMatchesQuery(deed, q)) continue;
      const po = poById.get(deed.poNumber);
      if (!po) continue;
      hits.push({
        view: "property",
        item: {
          row: po,
          deed,
          match: {
            mode: "deed",
            deedNumber: deed.deedNumber,
            propertyId: deed.propertyId,
            propertyArea: deed.area,
          },
        },
      });
    }
    return hits.sort((a, b) => {
      const cmp = a.item.row.id.localeCompare(b.item.row.id);
      if (cmp !== 0) return cmp;
      return a.item.deed.deedNumber.localeCompare(b.item.deed.deedNumber, "ar");
    });
  }

  return filterPoListRows(rows, q, deedIndex).map((item) => ({
    view: "po" as const,
    item: { ...item, deeds: deedsForPo(item.row.id, deedIndex) },
  }));
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function toLatinDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (ch) => String(ARABIC_DIGITS.indexOf(ch)));
}

/** Normalize deed tokens for fuzzy compare (006, صك 006, leading zeros). */
export function normalizeDeedQuery(value: string): string {
  return toLatinDigits(value)
    .trim()
    .toLowerCase()
    .replace(/^(صك|رقم\s*الصك)\s*/i, "")
    .replace(/[\s\u200f\u200e_-]/g, "");
}

function digitsOnly(value: string): string {
  return normalizeDeedQuery(value).replace(/\D/g, "");
}

export function classifyPoListSearch(query: string): PoListSearchMode {
  const raw = query.trim();
  if (!raw) return "all";

  if (/^po[-\s]?\d/i.test(raw) || /^po-/i.test(raw)) return "po";

  const deedNorm = normalizeDeedQuery(raw);
  const deedDigits = digitsOnly(raw);
  if (
    deedDigits.length >= 2 &&
    (deedNorm === deedDigits || /^صك/i.test(raw) || /^رقم/i.test(raw))
  ) {
    return "deed";
  }

  return "text";
}

export function poListSearchModeLabel(mode: PoListSearchMode): string | null {
  switch (mode) {
    case "po":
      return "بحث كأمر عمل";
    case "deed":
      return "بحث برقم الصك";
    case "text":
      return "بحث نصي";
    default:
      return null;
  }
}

export type PoDeedIndexEntry = {
  poNumber: string;
  propertyId: string;
  deedNumber: string;
  deedNorm: string;
  deedDigits: string;
  area: string;
};

export function buildPoDeedIndex(
  items: PropertyListItem[],
): PoDeedIndexEntry[] {
  return items
    .map((item) => {
      const deedNumber = item.row.id.trim();
      if (!deedNumber || deedNumber.includes("-")) return null;
      const deedNorm = normalizeDeedQuery(deedNumber);
      const deedDigits = digitsOnly(deedNumber);
      if (deedDigits.length < 2) return null;
      return {
        poNumber: item.poNumber.trim(),
        propertyId: item.propertyId,
        deedNumber,
        deedNorm,
        deedDigits,
        area: item.row.area.trim(),
      };
    })
    .filter((entry): entry is PoDeedIndexEntry => entry !== null);
}

function deedMatchesQuery(entry: PoDeedIndexEntry, query: string): boolean {
  const qNorm = normalizeDeedQuery(query);
  const qDigits = digitsOnly(query);
  if (!qNorm && !qDigits) return false;

  if (entry.deedNorm.includes(qNorm) || qNorm.includes(entry.deedNorm)) {
    return true;
  }

  if (qDigits.length >= 2) {
    if (entry.deedDigits.includes(qDigits) || qDigits.includes(entry.deedDigits)) {
      return true;
    }
    const entryNoZeros = entry.deedDigits.replace(/^0+/, "");
    const queryNoZeros = qDigits.replace(/^0+/, "");
    if (
      entryNoZeros.length > 0 &&
      queryNoZeros.length > 0 &&
      (entryNoZeros.includes(queryNoZeros) ||
        queryNoZeros.includes(entryNoZeros))
    ) {
      return true;
    }
  }

  return false;
}

function bestDeedMatch(
  poNumber: string,
  deedIndex: PoDeedIndexEntry[],
  query: string,
): PoDeedIndexEntry | null {
  const matches = deedIndex.filter(
    (entry) => entry.poNumber === poNumber && deedMatchesQuery(entry, query),
  );
  if (matches.length === 0) return null;

  const qDigits = digitsOnly(query);
  return (
    matches.find((m) => m.deedDigits === qDigits) ??
    matches.find((m) => m.deedNorm === normalizeDeedQuery(query)) ??
    matches[0]
  );
}

export function filterPoListRows(
  rows: PoRow[],
  query: string,
  deedIndex: PoDeedIndexEntry[],
): PoListFilteredRow[] {
  const q = query.trim();
  if (!q) return rows.map((row) => ({ row, match: null, deeds: deedsForPo(row.id, deedIndex) }));

  const mode = classifyPoListSearch(q);
  const qLower = q.toLowerCase();

  if (mode === "deed") {
    const poNumbers = new Set(
      deedIndex
        .filter((entry) => deedMatchesQuery(entry, q))
        .map((entry) => entry.poNumber),
    );
    return rows
      .filter((row) => poNumbers.has(row.id))
      .map((row) => {
        const hit = bestDeedMatch(row.id, deedIndex, q);
        return {
          row,
          deeds: deedsForPo(row.id, deedIndex),
          match: hit
            ? {
                mode: "deed" as const,
                deedNumber: hit.deedNumber,
                propertyId: hit.propertyId,
                propertyArea: hit.area,
              }
            : { mode: "deed" as const },
        };
      });
  }

  return rows
    .filter((row) => {
      if (mode === "po") {
        return row.id.toLowerCase().includes(qLower);
      }

      const poHit = row.id.toLowerCase().includes(qLower);
      const typeHit = row.type.toLowerCase().includes(qLower);
      const specialistHit = row.specialist.toLowerCase().includes(qLower);
      const deedHit = bestDeedMatch(row.id, deedIndex, q) !== null;
      return poHit || typeHit || specialistHit || deedHit;
    })
    .map((row) => {
      const deeds = deedsForPo(row.id, deedIndex);
      if (row.id.toLowerCase().includes(qLower)) {
        return { row, deeds, match: { mode: "po" as const } };
      }

      const deedHit = bestDeedMatch(row.id, deedIndex, q);
      if (deedHit) {
        return {
          row,
          deeds,
          match: {
            mode: "deed" as const,
            deedNumber: deedHit.deedNumber,
            propertyId: deedHit.propertyId,
            propertyArea: deedHit.area,
          },
        };
      }

      if (row.type.toLowerCase().includes(qLower)) {
        return { row, deeds, match: { mode: "text" as const } };
      }

      if (row.specialist.toLowerCase().includes(qLower)) {
        return { row, deeds, match: { mode: "text" as const } };
      }

      return { row, deeds, match: null };
    });
}
