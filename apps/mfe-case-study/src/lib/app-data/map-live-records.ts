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
import { parseLatLng } from "@platform/app-shared/domain/geo";
import { parseLocaleNumber } from "@platform/app-shared/format/number";
import type { FailureRecord } from "@platform/app-shared/failures/failures-types";
import { failuresForProperty } from "@failures/mfe/lib/failure-property-match";
import type { PoIntakeRecord, PoPropertyIntake } from "./po-intake-property-model";
import type {
  MapComparableRecord,
  MapCoords,
  MapPropertyRecord,
  WorkflowStatusKey,
} from "./map-locations-logic";

export { coordsFromLocationMapUrl };

type MapValuationOverlay = {
  valuationDate: string | null;
  issueDate: string | null;
  finalValue: number | null;
  valuer: string | null;
  issued: boolean;
};

type MapLiveOverlays = {
  inspectorPins?: Map<string, MapCoords>;
  valuations?: Map<string, MapValuationOverlay>;
  /** Every failure (التعذّرات) — the map marks a property from its newest unresolved one. */
  failures?: FailureRecord[];
};

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
    const coords = parseLatLng(workspace.mapLatitude, workspace.mapLongitude);
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

/** The property's newest failure that is not resolved — the one that decides its map status. */
function openFailureFor(
  failures: FailureRecord[] | undefined,
  poNumber: string,
  property: PoPropertyIntake,
): FailureRecord | null {
  if (!failures?.length) return null;
  const matched = failuresForProperty(failures, {
    poNumber,
    propertyId: property.id,
    deedNumber: property.deedNumber,
  });
  return matched.find((failure) => failure.status !== "resolved") ?? null;
}

/**
 * «متعذّر»: removed, or its failure was approved / suspended the transaction.
 * «مرشح تعذّر»: a failure still in draft, review or returned to the specialist, or an inactive deed.
 */
function workflowForProperty(
  property: PoPropertyIntake,
  overlay: MapValuationOverlay | undefined,
  failure: FailureRecord | null,
): WorkflowStatusKey {
  if (property.isRemoved) return "infeasible";
  if (failure?.status === "approved" || failure?.status === "suspended") return "infeasible";
  if (failure) return "infeasible_candidate";
  const vitality = property.deedStatus.trim();
  if (vitality === "غير فعال" || vitality.toLowerCase() === "inactive") {
    return "infeasible_candidate";
  }
  if (overlay?.issued) return "issued";
  return "in_progress";
}

function areaNumber(raw: string): number | null {
  const n = parseLocaleNumber(raw);
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
      const failure = openFailureFor(overlays.failures, record.poNumber, property);
      const workflowStatus = workflowForProperty(property, valuation, failure);
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
        failureTitle: failure?.title.trim() || null,
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
        // Decision 2026-10-19: deeds of one transaction cluster into one point. A transaction
        // with one deed stays a single (groupForMap turns one-member groups back into singles).
        propertyGroupId: property.transactionId?.trim() || null,
        transactionNumber:
          property.referenceNumber?.trim() || property.transactionDraftNumber?.trim() || null,
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
      const coords = parseLatLng(r.latitude, r.longitude);
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
