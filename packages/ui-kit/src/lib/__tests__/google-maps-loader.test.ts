import { describe, expect, it } from "vitest";
import { placeFromReverseGeocodePayload } from "../google-maps-loader";

describe("placeFromReverseGeocodePayload", () => {
  it("reads the neighbourhood (النرجس) instead of repeating the city", () => {
    const place = placeFromReverseGeocodePayload({
      city: "الرياض",
      locality: "الرياض",
      countryName: "السعودية",
      principalSubdivision: "منطقة الرياض",
      localityInfo: {
        administrative: [
          { name: "السعودية", adminLevel: 2 },
          { name: "منطقة الرياض", adminLevel: 4 },
          { name: "الرياض", adminLevel: 6 },
          { name: "محافظة الرياض", adminLevel: 6 },
          { name: "بلدية الشمال", adminLevel: 9 },
          { name: "النرجس", adminLevel: 10 },
        ],
      },
    });
    expect(place.city).toBe("الرياض");
    expect(place.district).toBe("النرجس");
    expect(place.formattedAddress).toBe("النرجس، الرياض، منطقة الرياض");
  });

  it("strips a leading حي from the district name", () => {
    const place = placeFromReverseGeocodePayload({
      city: "الرياض",
      locality: "الرياض",
      localityInfo: {
        administrative: [{ name: "حي الملقا", adminLevel: 10 }],
      },
    });
    expect(place.district).toBe("الملقا");
  });

  it("does not treat the city or municipality as a district", () => {
    const place = placeFromReverseGeocodePayload({
      city: "جدة",
      locality: "جدة",
      countryName: "السعودية",
      principalSubdivision: "منطقة مكة المكرمة",
      localityInfo: {
        administrative: [
          { name: "السعودية", adminLevel: 2 },
          { name: "منطقة مكة المكرمة", adminLevel: 4 },
          { name: "جدة", adminLevel: 6 },
        ],
      },
    });
    expect(place.city).toBe("جدة");
    expect(place.district).toBeUndefined();
  });
});
