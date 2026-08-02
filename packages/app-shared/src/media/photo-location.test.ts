import { describe, expect, it } from "vitest";
import {
  PHOTO_LOCATION_FLAGS,
  PHOTO_LOCATION_MAX_MATCH_M,
  evaluatePhotoLocation,
  haversineMeters,
} from "./photo-location";

describe("photo-location", () => {
  it("flags missing photo GPS as unavailable", () => {
    expect(
      evaluatePhotoLocation({
        propertyLatitude: 21.48,
        propertyLongitude: 39.19,
      }),
    ).toEqual({
      distanceM: null,
      flag: PHOTO_LOCATION_FLAGS.location_unavailable,
    });
  });

  it("marks match inside 500m", () => {
    const result = evaluatePhotoLocation({
      photoLatitude: 21.4858,
      photoLongitude: 39.1925,
      propertyLatitude: 21.4859,
      propertyLongitude: 39.1926,
    });
    expect(result.flag).toBe(PHOTO_LOCATION_FLAGS.match);
    expect(result.distanceM).not.toBeNull();
    expect(result.distanceM!).toBeLessThan(PHOTO_LOCATION_MAX_MATCH_M);
  });

  it("marks outside when beyond 500m", () => {
    // ~1.1 km north of property
    const result = evaluatePhotoLocation({
      photoLatitude: 21.4958,
      photoLongitude: 39.1925,
      propertyLatitude: 21.4858,
      propertyLongitude: 39.1925,
    });
    expect(result.flag).toBe(PHOTO_LOCATION_FLAGS.outside_property);
    expect(result.distanceM!).toBeGreaterThan(PHOTO_LOCATION_MAX_MATCH_M);
  });

  it("haversine is symmetric", () => {
    const a = haversineMeters(21.48, 39.19, 21.49, 39.2);
    const b = haversineMeters(21.49, 39.2, 21.48, 39.19);
    expect(Math.abs(a - b)).toBeLessThan(0.01);
  });
});
