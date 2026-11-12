import type { ComparablePropertyDto } from "@platform/api-client";
import {
  comparableAreaLabel,
  comparableKindFromType,
  comparableTypeLabel,
} from "@platform/app-shared/app-data/comparable-entry";
import { haversineMeters, parseLatLng, type LatLng } from "@platform/app-shared/domain/geo";
import { fmtMax } from "@platform/app-shared/format/number";
import type { GoogleMapContextPin } from "@platform/ui-kit";

/** A comparable recorded in the bank, on the comparables maps. */
export const BANK_COMPARABLE_PIN_COLOR = "#d9822b";
/** A bank comparable chosen for the transaction at hand. */
export const ADOPTED_COMPARABLE_PIN_COLOR = "#1f9d55";
/** A comparable added to the transaction's table and not adopted yet. */
export const LISTED_COMPARABLE_PIN_COLOR = "#378add";
const SUBJECT_PIN_COLOR = "#12284C";

/**
 * The subject property on the comparables maps (Omar 2026-11-11): a navy circle carrying a house,
 * with a white edge, inside a blinking ring — larger than the comparables and drawn above them, on
 * every map that shows the bank's comparables around it.
 */
export function subjectPropertyMapPin(pin: LatLng): GoogleMapContextPin {
  return {
    lat: pin.lat,
    lng: pin.lng,
    title: "العقار موضوع التقييم",
    symbol: "home",
    color: SUBJECT_PIN_COLOR,
    emphasis: true,
  };
}

/** How far around the subject property the entry map shows the bank's comparables. */
export const NEARBY_BANK_SUBJECT_RADIUS_KM = 10;
/** How far around the pin being placed the bank is asked again (the pin may be far from the subject). */
export const NEARBY_BANK_PIN_RADIUS_KM = 1;
/** A recorded comparable this close to the new pin is probably the same property. */
export const SAME_COMPARABLE_WARN_METERS = 50;

/**
 * A bank comparable on the comparables maps, with the lines its note shows when pressed, one
 * under the other (Omar 2026-11-11): the property type, the usage, the district and the area.
 *
 * How it works: the area is named as the bank records it — «مساحة الأرض» for a land, «مسطح البناء»
 * for a building (a building's land is not recorded separately).
 * Edge cases: a value the comparable does not carry leaves its line out of the note.
 */
export function bankComparableMapPin(
  comparable: ComparablePropertyDto,
  color: string = BANK_COMPARABLE_PIN_COLOR,
): GoogleMapContextPin {
  const type = comparable.comparablePropertyType?.trim() ?? "";
  const usage = comparable.usage?.trim() ?? "";
  const district = comparable.district?.trim() ?? "";
  const areaLabel = comparableAreaLabel(comparableKindFromType(type));
  return {
    id: comparable.id,
    lat: comparable.latitude,
    lng: comparable.longitude,
    title: [comparable.referenceCode, comparableTypeLabel(type), district]
      .filter(Boolean)
      .join(" · "),
    details: [
      comparableTypeLabel(type),
      usage ? `الاستخدام: ${usage}` : "",
      district ? `الحي: ${district}` : "",
      Number.isFinite(comparable.areaSqm) ? `${areaLabel}: ${fmtMax(comparable.areaSqm)} م²` : "",
    ].filter(Boolean),
    color,
  };
}

/** One list from the two fetches (around the subject, around the pin) — each comparable once. */
export function mergeNearbyBankComparables(
  ...lists: (readonly ComparablePropertyDto[] | undefined)[]
): ComparablePropertyDto[] {
  const byId = new Map<string, ComparablePropertyDto>();
  for (const list of lists) {
    for (const comp of list ?? []) {
      if (!byId.has(comp.id)) byId.set(comp.id, comp);
    }
  }
  return [...byId.values()];
}

/**
 * The recorded comparable nearest to `pin`, when it lies within `withinMeters`.
 *
 * Edge cases: a comparable with no usable coordinates is skipped; nothing within the distance
 * returns null.
 */
export function nearestBankComparable(
  comparables: readonly ComparablePropertyDto[],
  pin: LatLng | null,
  withinMeters: number = SAME_COMPARABLE_WARN_METERS,
): { comparable: ComparablePropertyDto; meters: number } | null {
  if (!pin) return null;
  let best: { comparable: ComparablePropertyDto; meters: number } | null = null;
  for (const comparable of comparables) {
    const at = parseLatLng(comparable.latitude, comparable.longitude);
    if (!at) continue;
    const meters = haversineMeters(pin, at);
    if (meters <= withinMeters && (!best || meters < best.meters)) {
      best = { comparable, meters };
    }
  }
  return best;
}

/** «35 م» under a kilometre, «1.4 كم» above. */
export function distanceLabelAr(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} م` : `${(meters / 1000).toFixed(1)} كم`;
}
