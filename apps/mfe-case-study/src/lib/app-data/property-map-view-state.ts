/**
 * Pure rules behind `PropertyMapView` — the filter criteria object, the marker
 * projection, the toolbar option lists and the small label helpers. No React,
 * no I/O.
 */
import { fmtSar } from "@platform/app-shared/format/number";
import type {
  MapBasemap,
  PropertyMapMarker,
} from "../../components/property-map/PropertyMapCanvas";
import type {
  DatePreset,
  FilterCriteria,
  LayerKey,
  MapComparableRecord,
  MapPropertyRecord,
  PropertyKindCat,
  PropertyUsageCat,
  groupForMap,
} from "./map-locations-logic";
import { countWithoutCoords, isFailureRecord } from "./map-locations-logic";

export type MapGroupedPoint = ReturnType<typeof groupForMap>[number];

export type PropertyMapSelection =
  | { kind: "property"; record: MapPropertyRecord; groupCount?: number }
  | { kind: "comparable"; record: MapComparableRecord }
  | { kind: "cluster"; ids: string[] }
  | null;

export type PropertyMapLayerPanel = LayerKey | null;

export type PropertyMapBasemap = MapBasemap;

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "كل الفترات" },
  { value: "today", label: "اليوم" },
  { value: "7d", label: "آخر 7 أيام" },
  { value: "month", label: "هذا الشهر" },
  { value: "year", label: "هذه السنة" },
];

export const LAYER_CHIPS: {
  key: LayerKey;
  label: string;
  color: string;
  diamond?: boolean;
  alert?: boolean;
}[] = [
  { key: "active", label: "العقارات النشطة", color: "#12284C" },
  { key: "archive", label: "العقارات المكتملة", color: "#8a8d96" },
  { key: "comparables", label: "أرشيف المقارنات", color: "#a4906f", diamond: true },
  { key: "failures", label: "التعذّرات", color: "#d9694f", alert: true },
];

export function workflowTone(key: MapPropertyRecord["workflowStatus"]) {
  if (key === "issued") return "success" as const;
  if (key === "infeasible") return "danger" as const;
  if (key === "infeasible_candidate") return "warning" as const;
  return "info" as const;
}

export function fmtShort(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

/** A grouped point's picker/marker key — group id when clustered, else record id. */
export function nodeKey(point: {
  kind: string;
  groupId?: string;
  record?: MapPropertyRecord;
}): string {
  return point.kind === "group" && point.groupId
    ? `g:${point.groupId}`
    : `p:${point.record!.id}`;
}

/** The toolbar draft fields as one filter criteria object. */
type PropertyMapFilterDraft = {
  query: string;
  city: string;
  kindCat: PropertyKindCat | "";
  usage: PropertyUsageCat | "";
  datePreset: DatePreset;
  dateFrom: string;
  dateTo: string;
  operationType: string;
  approvedOnly: boolean;
};

export function mapFilterCriteria(
  draft: PropertyMapFilterDraft,
): FilterCriteria {
  return {
    query: draft.query.trim() || undefined,
    city: draft.city || undefined,
    kindCat: draft.kindCat || undefined,
    usage: draft.usage || undefined,
    datePreset: draft.datePreset,
    dateFrom: draft.dateFrom ? new Date(draft.dateFrom) : null,
    dateTo: draft.dateTo ? new Date(`${draft.dateTo}T23:59:59`) : null,
    operationType: draft.operationType || undefined,
    approvedOnly: draft.approvedOnly || undefined,
  };
}

/** Whether the “clear filters” chip shows — the date preset counts unless “all”. */
export function hasActiveMapFilters(
  draft: Pick<
    PropertyMapFilterDraft,
    "query" | "city" | "kindCat" | "usage" | "dateFrom" | "dateTo" | "datePreset"
  >,
  dateLabel: string,
): boolean {
  return !!(
    draft.query.trim() ||
    draft.city ||
    draft.kindCat ||
    draft.usage ||
    dateLabel ||
    draft.dateFrom ||
    draft.dateTo ||
    (draft.datePreset && draft.datePreset !== "all")
  );
}

/** Every visible property record behind the grouped points. */
export function recordsOfGrouped(
  grouped: MapGroupedPoint[],
): MapPropertyRecord[] {
  const list: MapPropertyRecord[] = [];
  for (const p of grouped) {
    if (p.kind === "single") list.push(p.record);
    else list.push(...p.members);
  }
  return list;
}

/** Grouped points and comparables projected to canvas markers. */
export function buildMapMarkers(
  grouped: MapGroupedPoint[],
  shownComparables: MapComparableRecord[],
): PropertyMapMarker[] {
  const list: PropertyMapMarker[] = [];
  for (const point of grouped) {
    const coords = point.coords;
    if (!coords) continue;
    if (point.kind === "single") {
      list.push({
        id: `p:${point.record.id}`,
        coords,
        layer: isFailureRecord(point.record) ? "failures" : point.active ? "active" : "archive",
        pulse: point.active,
        archived: !point.active,
        infeasible: isFailureRecord(point.record),
        title: point.record.refNo,
        subtitle: `${point.record.city} · ${point.record.district} · ${point.record.propertyType}`,
      });
    } else {
      const head = point.members[0]!;
      list.push({
        id: `g:${point.groupId}`,
        coords,
        layer: isFailureRecord(head) ? "failures" : point.active ? "active" : "archive",
        pulse: point.active,
        archived: !point.active,
        infeasible: isFailureRecord(head),
        count: point.deedCount,
        // Decision 2026-10-19: a cluster is one transaction, so it is titled by its number.
        title: `${head.transactionNumber ?? head.refNo} — ${point.deedCount} صكوك`,
        subtitle: `${head.city} · ${head.district} · ${head.propertyType}`,
      });
    }
  }
  for (const c of shownComparables) {
    if (!c.coords) continue;
    list.push({
      id: `c:${c.id}`,
      coords: c.coords,
      layer: "comparables",
      approved: c.approved,
      title: `${c.comparableType} — ${c.operationType}`,
      subtitle: `${c.city} · ${c.price != null ? fmtSar(c.price, { digits: 3, trim: true }) : ""}`,
    });
  }
  return list;
}

/** Years present in either data set, newest first — the date panel's year list. */
export function mapYearOptions(
  properties: MapPropertyRecord[],
  comparables: MapComparableRecord[],
): number[] {
  const years = new Set<number>();
  for (const r of properties) {
    const d = r.valuationDate || r.openedDate;
    if (d) years.add(new Date(d).getFullYear());
  }
  for (const c of comparables) {
    if (c.operationDate) years.add(new Date(c.operationDate).getFullYear());
  }
  return [...years].sort((a, b) => b - a);
}

/** The prefixed marker id of the current selection, for canvas highlighting. */
export function selectedMarkerId(
  selection: PropertyMapSelection,
): string | null {
  if (selection?.kind === "property")
    return selection.record.propertyGroupId
      ? `g:${selection.record.propertyGroupId}`
      : `p:${selection.record.id}`;
  if (selection?.kind === "comparable") return `c:${selection.record.id}`;
  if (selection?.kind === "cluster") return selection.ids[0] ?? null;
  return null;
}

/** “No coordinates” footer text — only the layers currently switched on. */
export function noCoordsSummary(
  layers: Record<LayerKey, boolean>,
  partitioned: { activeNoCoords: number; archiveNoCoords: number; failuresNoCoords: number },
  filteredComparables: MapComparableRecord[],
): string[] {
  const parts: string[] = [];
  if (layers.active) parts.push(`نشط ${partitioned.activeNoCoords}`);
  if (layers.archive) parts.push(`أرشيف ${partitioned.archiveNoCoords}`);
  if (layers.failures) parts.push(`تعذّر ${partitioned.failuresNoCoords}`);
  if (layers.comparables)
    parts.push(`مقارنات ${countWithoutCoords(filteredComparables)}`);
  return parts;
}
