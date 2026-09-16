/** Map live work-order properties + comparable bank → PropertyMapView records. */

import type {
  ComparablePropertyDto,
  FieldInspectionWorkspaceListItemDto,
  ValuationRequestDto,
} from "@platform/api-client";
import {
  approximatePropertyGeo,
  coordsFromLocationMapUrl,
} from "@platform/app-shared/domain/property-geo";
import type { PoIntakeRecord, PoPropertyIntake } from "./po-intake-property-model";
import type {
  MapComparableRecord,
  MapCoords,
  MapPropertyRecord,
  WorkflowStatusKey,
} from "./map-locations-logic";

export { coordsFromLocationMapUrl };

export type MapValuationOverlay = {
  valuationDate: string | null;
  issueDate: string | null;
  finalValue: number | null;
  valuer: string | null;
  issued: boolean;
};

export type MapLiveOverlays = {
  inspectorPins?: Map<string, MapCoords>;
  valuations?: Map<string, MapValuationOverlay>;
};

function parseCoordPair(
  latRaw: string | number | null | undefined,
  lngRaw: string | number | null | undefined,
): MapCoords | null {
  const lat = Number.parseFloat(String(latRaw ?? "").trim().replace(",", "."));
  const lng = Number.parseFloat(String(lngRaw ?? "").trim().replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function propertyKey(id: string | null | undefined): string {
  return (id ?? "").trim().toLowerCase();
}

export function inspectorPinsByPropertyId(
  workspaces: FieldInspectionWorkspaceListItemDto[] | null | undefined,
): Map<string, MapCoords> {
  const out = new Map<string, MapCoords>();
  for (const workspace of workspaces ?? []) {
    const key = propertyKey(workspace.propertyId);
    if (!key || out.has(key)) continue;
    const coords = parseCoordPair(workspace.mapLatitude, workspace.mapLongitude);
    if (coords) out.set(key, coords);
  }
  return out;
}

function isIssuedValuation(row: ValuationRequestDto): boolean {
  if ((row.status ?? "").trim().toLowerCase() === "done") return true;
  return Boolean((row.issueDate ?? "").trim());
}

export function valuationsByPropertyId(
  rows: ValuationRequestDto[] | null | undefined,
): Map<string, MapValuationOverlay> {
  const out = new Map<string, MapValuationOverlay>();
  for (const row of rows ?? []) {
    const key = propertyKey(row.propId);
    if (!key) continue;
    const next: MapValuationOverlay = {
      valuationDate: (row.date ?? "").trim() || null,
      issueDate: (row.issueDate ?? "").trim() || null,
      finalValue:
        typeof row.finalOpinionValue === "number" &&
        Number.isFinite(row.finalOpinionValue) &&
        row.finalOpinionValue > 0
          ? row.finalOpinionValue
          : null,
      valuer: (row.appraiser ?? "").trim() || null,
      issued: isIssuedValuation(row),
    };
    const prev = out.get(key);
    if (!prev) {
      out.set(key, next);
      continue;
    }
    if (next.issued !== prev.issued) {
      if (next.issued) out.set(key, next);
      continue;
    }
    if ((next.valuationDate ?? "") > (prev.valuationDate ?? "")) {
      out.set(key, next);
    }
  }
  return out;
}

export function fillValuersFromAppraisalTasks(
  valuations: Map<string, MapValuationOverlay>,
  tasks:
    | { kind?: string; propertyId?: string; assigneeName?: string }[]
    | null
    | undefined,
): Map<string, MapValuationOverlay> {
  const out = new Map(valuations);
  for (const task of tasks ?? []) {
    if (task.kind !== "property-appraisal") continue;
    const key = propertyKey(task.propertyId);
    const name = (task.assigneeName ?? "").trim();
    if (!key || !name) continue;
    const prev = out.get(key);
    if (!prev) {
      out.set(key, {
        valuationDate: null,
        issueDate: null,
        finalValue: null,
        valuer: name,
        issued: false,
      });
      continue;
    }
    if (!prev.valuer) out.set(key, { ...prev, valuer: name });
  }
  return out;
}

export function resolveLivePropertyCoords(
  property: Pick<PoPropertyIntake, "city" | "deedNumber" | "locationMapUrl">,
  inspectorPin?: MapCoords | null,
): { coords: MapCoords | null; coordsSource: string | null } {
  if (inspectorPin) return { coords: inspectorPin, coordsSource: "معاينة" };
  const fromUrl = coordsFromLocationMapUrl(property.locationMapUrl);
  if (fromUrl) return { coords: fromUrl, coordsSource: "رابط الموقع" };
  const approx = approximatePropertyGeo(property);
  if (approx) return { coords: approx, coordsSource: "تقريبي (مدينة)" };
  return { coords: null, coordsSource: null };
}

function workflowForProperty(
  property: PoPropertyIntake,
  overlay: MapValuationOverlay | undefined,
): WorkflowStatusKey {
  if (property.isRemoved) return "infeasible";
  const vitality = property.deedStatus.trim();
  if (vitality === "غير فعال" || vitality.toLowerCase() === "inactive") {
    return "infeasible_candidate";
  }
  if (overlay?.issued) return "issued";
  return "in_progress";
}

function areaNumber(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function mapPoRecordsToMapProperties(
  records: PoIntakeRecord[] | null | undefined,
  overlays: MapLiveOverlays = {},
): MapPropertyRecord[] {
  if (!records?.length) return [];
  const out: MapPropertyRecord[] = [];
  for (const record of records) {
    for (const property of record.properties) {
      const key = propertyKey(property.id);
      const valuation = overlays.valuations?.get(key);
      const { coords, coordsSource } = resolveLivePropertyCoords(
        property,
        overlays.inspectorPins?.get(key) ?? null,
      );
      const workflowStatus = workflowForProperty(property, valuation);
      out.push({
        id: property.id,
        refNo: record.poNumber,
        deedNo: property.deedNumber.trim() || property.realEstateRegNumber.trim() || "—",
        deedType: property.deedKind.trim() || "—",
        propertyType: property.propertyType.trim() || property.classification.trim() || "—",
        city: property.city.trim() || "—",
        district: property.district.trim() || "—",
        area: areaNumber(property.area),
        client: (record.clientNameAr ?? "").trim() || "—",
        assignmentType: record.assignmentType || "—",
        workflowStatus,
        openedDate: record.createdAtUtc?.slice(0, 10) || null,
        valuationDate: valuation?.valuationDate ?? null,
        issueDate: valuation?.issueDate ?? null,
        closedDate: property.isRemoved
          ? property.removedAtUtc?.slice(0, 10) || record.createdAtUtc?.slice(0, 10) || null
          : null,
        finalValue: valuation?.finalValue ?? null,
        valuer: valuation?.valuer ?? null,
        coords,
        coordsSource,
        propertyGroupId: null,
        poNumber: record.poNumber,
        propertyId: property.id,
      });
    }
  }
  return out;
}

export function mapComparableDtosToMapRecords(
  rows: ComparablePropertyDto[] | null | undefined,
): MapComparableRecord[] {
  if (!rows?.length) return [];
  return rows
    .filter((r) => r.isActive)
    .map((r) => {
      const coords = parseCoordPair(String(r.latitude), String(r.longitude));
      return {
        id: r.id,
        refNo: r.referenceCode,
        comparableType: r.comparablePropertyType || r.usage || "—",
        operationType: r.transactionKindLabelAr || r.transactionKind || "—",
        priceDescription: r.priceDescriptionLabelAr || r.priceDescription || null,
        operationDate: r.transactionDate?.slice(0, 10) || null,
        price: Number.isFinite(r.price) ? r.price : null,
        area: Number.isFinite(r.areaSqm) ? r.areaSqm : null,
        city: (r.city ?? "").trim() || "—",
        district: (r.district ?? "").trim() || "—",
        source: r.source || null,
        approved: r.reliabilityTag !== "unreliable" && r.reliabilityTag !== "anomalous",
        description: r.description || null,
        coords,
      };
    });
}
