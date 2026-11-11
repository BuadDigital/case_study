import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComparablePropertyDto, ComparablePropertyListQuery } from "@platform/api-client";
import { resolveSubjectCoordsForBank, searchBankComparables } from "../bank-ranking";

const listComparableProperties = vi.hoisted(() => vi.fn());
vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  listComparableProperties,
}));

// PO-067355 (production, 2026-10-22): a building in الخرج / مشرف, pinned by the inspector.
const AL_KHARJ_PIN = { lat: 24.093248, lng: 47.272136 };

function comparable(
  id: string,
  city: string,
  lat: number,
  lng: number,
): ComparablePropertyDto {
  return { id, city, latitude: lat, longitude: lng, areaSqm: 500 } as unknown as ComparablePropertyDto;
}

describe("bank subject location", () => {
  it("uses the inspector's pin when there is one", () => {
    expect(
      resolveSubjectCoordsForBank({
        latitude: AL_KHARJ_PIN.lat,
        longitude: AL_KHARJ_PIN.lng,
      }),
    ).toEqual(AL_KHARJ_PIN);
  });

  it("falls back to the intake map link", () => {
    expect(
      resolveSubjectCoordsForBank({
        locationMapUrl: `https://www.google.com/maps?q=${AL_KHARJ_PIN.lat},${AL_KHARJ_PIN.lng}`,
      }),
    ).toEqual(AL_KHARJ_PIN);
  });

  it("never guesses a location without a pin or a map link", () => {
    expect(resolveSubjectCoordsForBank({})).toBeNull();
    expect(resolveSubjectCoordsForBank({ latitude: 0, longitude: 0 })).toBeNull();
  });
});

// Ruling 2026-11-11: the system suggests no comparables — the bank is asked only for a search
// typed in the «إضافة مقارن» window's search.
describe("the bank search of the comparables map", () => {
  const MAKKAH_LAND = {
    id: "CMP-MAKKAH",
    city: "مكة المكرمة",
    comparablePropertyType: "أرض",
    latitude: 21.35,
    longitude: 39.95,
    areaSqm: 5000,
  } as unknown as ComparablePropertyDto;
  const RIYADH_LAND = comparable("CMP-RIYADH", "الرياض", 24.7, 46.69);

  beforeEach(() => {
    listComparableProperties.mockReset();
    listComparableProperties.mockImplementation(
      async (_config: unknown, _query: ComparablePropertyListQuery) => ({
        ok: true,
        data: [RIYADH_LAND, MAKKAH_LAND],
      }),
    );
  });

  it("asks nothing without search text", async () => {
    const hits = await searchBankComparables(
      { token: "t", baseUrl: "" },
      {
        q: "  ",
        city: "الخرج",
        propertyId: "p1",
        subjectSqm: 500,
        latitude: AL_KHARJ_PIN.lat,
        longitude: AL_KHARJ_PIN.lng,
      },
    );
    expect(listComparableProperties).not.toHaveBeenCalled();
    expect(hits).toEqual([]);
  });

  it("searches the whole bank — no city, no type — and ranks the hits from the subject", async () => {
    const hits = await searchBankComparables(
      { token: "t", baseUrl: "" },
      { q: " CMP-26 ", city: "مكة المكرمة", propertyId: "p1", subjectSqm: 5000, latitude: 21.36, longitude: 39.95 },
    );
    const query = listComparableProperties.mock.calls[0][1];
    expect(query.q).toBe("CMP-26");
    // No type goes to the server: «أرض» never contains «أرض سكنية», «فيلا» or «مزرعة».
    expect(query.propertyType).toBeUndefined();
    expect(query.city).toBeUndefined();
    expect(hits.map((c) => c.id)).toEqual(["CMP-MAKKAH", "CMP-RIYADH"]);
  });
});
