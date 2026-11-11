import { describe, expect, it } from "vitest";
import type { ComparablePropertyDto } from "@platform/api-client";
import {
  distanceLabelAr,
  mergeNearbyBankComparables,
  nearestBankComparable,
  subjectPropertyMapPin,
} from "../nearby-bank-comparables";

const PIN = { lat: 24.7136, lng: 46.6753 };

/** A bank comparable `meters` north of the pin (1° of latitude ≈ 111.19 km). */
function at(id: string, meters: number): ComparablePropertyDto {
  return {
    id,
    latitude: PIN.lat + meters / 111_190,
    longitude: PIN.lng,
  } as unknown as ComparablePropertyDto;
}

describe("the recorded comparable at the spot of a new pin", () => {
  it("is the nearest one within 50 m", () => {
    const hit = nearestBankComparable([at("far", 400), at("b", 30), at("a", 12)], PIN);
    expect(hit?.comparable.id).toBe("a");
    expect(hit?.meters).toBeCloseTo(12, 0);
  });

  it("is none when the nearest lies farther, or no pin is placed", () => {
    expect(nearestBankComparable([at("far", 80)], PIN)).toBeNull();
    expect(nearestBankComparable([at("a", 5)], null)).toBeNull();
  });

  it("skips a comparable with no usable coordinates", () => {
    const blank = { id: "blank", latitude: 0, longitude: 0 } as unknown as ComparablePropertyDto;
    expect(nearestBankComparable([blank], PIN)).toBeNull();
  });
});

describe("the bank comparables drawn on the entry map", () => {
  it("lists each comparable once across the two fetches", () => {
    const merged = mergeNearbyBankComparables([at("a", 10), at("b", 20)], undefined, [at("b", 20), at("c", 30)]);
    expect(merged.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("names a distance in metres under a kilometre, in kilometres above", () => {
    expect(distanceLabelAr(34.6)).toBe("35 م");
    expect(distanceLabelAr(1440)).toBe("1.4 كم");
  });
});

/** Omar 2026-11-11: the subject stands out on both comparables maps. */
describe("the subject property on the comparables maps", () => {
  it("is an emphasised navy circle carrying a house, at the subject's spot", () => {
    expect(subjectPropertyMapPin(PIN)).toEqual({
      lat: PIN.lat,
      lng: PIN.lng,
      title: "العقار موضوع التقييم",
      symbol: "home",
      color: "#12284C",
      emphasis: true,
    });
  });
});
