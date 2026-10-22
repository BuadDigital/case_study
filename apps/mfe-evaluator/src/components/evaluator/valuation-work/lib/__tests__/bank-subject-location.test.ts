import { describe, expect, it } from "vitest";
import type { ComparablePropertyDto } from "@platform/api-client";
import { buildBankDisplayRows, resolveSubjectCoordsForBank } from "../bank-ranking";

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
        city: "الخرج",
        district: "مشرف",
      }),
    ).toEqual(AL_KHARJ_PIN);
  });

  it("does not place a property of an unknown city in central Riyadh", () => {
    expect(resolveSubjectCoordsForBank({ city: "قرية غير مدرجة", district: "مشرف" })).toBeNull();
  });

  it("without a pin places an Al-Kharj property in Al-Kharj", () => {
    const at = resolveSubjectCoordsForBank({ city: "محافظة الخرج", district: "مشرف", deedNumber: "611508007272" });
    expect(at).not.toBeNull();
    expect(at!.lat).toBeCloseTo(AL_KHARJ_PIN.lat, 0);
    expect(at!.lng).toBeCloseTo(AL_KHARJ_PIN.lng, 0);
  });

  it("still approximates a city with a known centroid", () => {
    const riyadh = resolveSubjectCoordsForBank({ city: "الرياض", deedNumber: "123" });
    expect(riyadh).not.toBeNull();
    expect(riyadh!.lat).toBeCloseTo(24.71, 1);
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
