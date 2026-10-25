/** Coordinate parsing + distance — implementation lives in ui-kit so its map loader can share it. */
import { parseLatLng, type LatLng } from "@platform/ui-kit";

export {
  haversineKm,
  haversineMeters,
  parseCoordinate,
  parseCoordinatePair,
  parseLatLng,
  type CoordinateAxis,
  type LatLng,
} from "@platform/ui-kit";

/** Extract lat/lng from a Google Maps URL when present. */
export function coordsFromLocationMapUrl(url: string | null | undefined): LatLng | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const q = u.searchParams.get("query") || u.searchParams.get("q");
    if (q) {
      const m = q.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
      if (m) return parseLatLng(m[1], m[2]);
    }
  } catch {
    /* not a URL — fall through */
  }
  const at = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return parseLatLng(at[1], at[2]);
  const plain = raw.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (plain) return parseLatLng(plain[1], plain[2]);
  return null;
}
