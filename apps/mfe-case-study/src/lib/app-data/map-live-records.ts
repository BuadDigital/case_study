/** Map live work-order properties + comparable bank → PropertyMapView records. */

import type { ComparablePropertyDto } from "@platform/api-client";
import { approximatePropertyGeo } from "./po-intake-boundaries";
import type { PoIntakeRecord, PoPropertyIntake } from "./po-intake-property-model";
import type {
  MapComparableRecord,
  MapCoords,
  MapPropertyRecord,
  WorkflowStatusKey,
} from "./map-locations-logic";

function parseCoordPair(
  latRaw: string | null | undefined,
  lngRaw: string | null | undefined,
): MapCoords | null {
  const lat = Number.parseFloat((latRaw ?? "").trim().replace(",", "."));
  const lng = Number.parseFloat((lngRaw ?? "").trim().replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/** Extract lat/lng from a Google Maps URL when present. */
export function coordsFromLocationMapUrl(
  url: string | null | undefined,
): MapCoords | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const q = u.searchParams.get("query") || u.searchParams.get("q");
    if (q) {
      const m = q.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
      if (m) return parseCoordPair(m[1], m[2]);
    }
  } catch {
    /* not a URL — fall through */
  }
  const at = raw.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (at) return parseCoordPair(at[1], at[2]);
  const plain = raw.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
  if (plain) return parseCoordPair(plain[1], plain[2]);
  return null;
}

export function resolveLivePropertyCoords(
  property: Pick<PoPropertyIntake, "city" | "deedNumber" | "locationMapUrl">,
): { coords: MapCoords | null; coordsSource: string | null } {
  const fromUrl = coordsFromLocationMapUrl(property.locationMapUrl);
  if (fromUrl) return { coords: fromUrl, coordsSource: "رابط الموقع" };
  const approx = approximatePropertyGeo(property);
  if (approx) return { coords: approx, coordsSource: "تقريبي (مدينة)" };
  return { coords: null, coordsSource: null };
}

function workflowForProperty(property: PoPropertyIntake): WorkflowStatusKey {
  if (property.isRemoved) return "infeasible";
  const vitality = property.deedStatus.trim();
  if (vitality === "غير فعال" || vitality.toLowerCase() === "inactive") {
    return "infeasible_candidate";
  }
  return "in_progress";
}

function areaNumber(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function mapPoRecordsToMapProperties(
  records: PoIntakeRecord[] | null | undefined,
): MapPropertyRecord[] {
  if (!records?.length) return [];
  const out: MapPropertyRecord[] = [];
  for (const record of records) {
    for (const property of record.properties) {
      const { coords, coordsSource } = resolveLivePropertyCoords(property);
      const workflowStatus = workflowForProperty(property);
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
        valuationDate: null,
        issueDate: null,
        closedDate: property.isRemoved
          ? property.removedAtUtc?.slice(0, 10) || record.createdAtUtc?.slice(0, 10) || null
          : null,
        finalValue: null,
        valuer: null,
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
