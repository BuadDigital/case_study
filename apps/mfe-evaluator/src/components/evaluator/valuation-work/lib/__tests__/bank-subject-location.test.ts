import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComparablePropertyDto, ComparablePropertyListQuery } from "@platform/api-client";
import {
  buildBankDisplayRows,
  fetchBankCandidates,
  resolveSubjectCoordsForBank,
} from "../bank-ranking";

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

// The five land comparables the appraiser added next to the property.
const AL_KHARJ_COMPS = [
  comparable("CMP-A533C63F", "محافظة الخرج", 24.096257, 47.27524),
  comparable("CMP-C245C99D", "محافظة الخرج", 24.103441, 47.275758),
  comparable("CMP-7788B734", "محافظة الخرج", 24.102885, 47.27512),
  comparable("CMP-0FEE3D91", "محافظة الخرج", 24.103441, 47.275758),
  comparable("CMP-AE52A862", "محافظة الخرج", 24.103441, 47.275758),
];

// What the bank showed instead: central-Riyadh comparables, ~80 km away.
const RIYADH_COMPS = [
  comparable("CMP-985D3967", "الرياض", 24.7, 46.69),
  comparable("CMP-1294C5E4", "الرياض", 24.72, 46.66),
];

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

  it("from the Al-Kharj pin shows the Al-Kharj comparables, not Riyadh's", () => {
    const { rows } = buildBankDisplayRows({
      selectionItems: [],
      candidates: [...RIYADH_COMPS, ...AL_KHARJ_COMPS],
      subjectCity: "الخرج",
      subjectCoords: AL_KHARJ_PIN,
    });
    expect(rows.map((r) => r.comp.id).sort()).toEqual(AL_KHARJ_COMPS.map((c) => c.id).sort());
  });

  it("without coordinates matches «محافظة الخرج» to «الخرج»", () => {
    const { rows } = buildBankDisplayRows({
      selectionItems: [],
      candidates: [...RIYADH_COMPS, ...AL_KHARJ_COMPS],
      subjectCity: "الخرج",
      subjectCoords: null,
    });
    expect(rows.map((r) => r.comp.city)).not.toContain("الرياض");
    expect(rows).toHaveLength(AL_KHARJ_COMPS.length);
  });
});

// 962010002726 (production, 2026-11-01): land in مكة المكرمة with no pin and no map link yet.
describe("bank with no subject location", () => {
  const MAKKAH_LAND = {
    id: "CMP-MAKKAH",
    city: "مكة المكرمة",
    comparablePropertyType: "أرض",
    latitude: 21.35,
    longitude: 39.95,
    areaSqm: 5000,
  } as unknown as ComparablePropertyDto;
  const OTHER_CITY_LAND = {
    ...MAKKAH_LAND,
    id: "CMP-RIYADH",
    city: "الرياض",
  } as ComparablePropertyDto;

  // The same `Contains` filters ComparablePropertyRepository applies on the server.
  beforeEach(() => {
    listComparableProperties.mockImplementation(
      async (_config: unknown, query: ComparablePropertyListQuery) => ({
        ok: true,
        data: [MAKKAH_LAND, OTHER_CITY_LAND].filter(
          (c) =>
            (!query.city || (c.city ?? "").includes(query.city)) &&
            (!query.propertyType || c.comparablePropertyType.includes(query.propertyType)),
        ),
      }),
    );
  });

  it("shows a comparable saved as «أرض» whatever the subject's registered type", async () => {
    const res = await fetchBankCandidates(
      { token: "t", baseUrl: "" },
      { city: "مكة المكرمة", propertyId: "p1", subjectSqm: 147431 },
    );
    expect(res.subjectCoords).toBeNull();
    // No type goes to the server: «أرض» never contains «أرض سكنية», «فيلا» or «مزرعة».
    expect(listComparableProperties.mock.calls[0][1].propertyType).toBeUndefined();

    const { rows } = buildBankDisplayRows({
      selectionItems: [],
      candidates: res.data,
      subjectCity: "مكة المكرمة",
      subjectCoords: res.subjectCoords,
    });
    expect(rows.map((r) => r.comp.id)).toEqual(["CMP-MAKKAH"]);
  });
});
