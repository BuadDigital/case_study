import { describe, expect, it } from "vitest";
import { haversineKm } from "../geo";
import {
  approximatePropertyGeo,
  hasCityGeo,
  hasDistrictGeo,
  normalizePlaceName,
} from "../property-geo";

const RIYADH = { lat: 24.7136, lng: 46.6753 };

// The 13 regions and their capitals, as in the official catalog (regions_cities.json).
const REGION_CAPITALS: [region: string, capital: string][] = [
  ["منطقة الرياض", "الرياض"],
  ["منطقة مكة المكرمة", "مكة المكرمة"],
  ["منطقة المدينة المنورة", "المدينة المنورة"],
  ["منطقة القصيم", "بريدة"],
  ["المنطقة الشرقية", "الدمام"],
  ["منطقة عسير", "أبها"],
  ["منطقة تبوك", "تبوك"],
  ["منطقة حائل", "حائل"],
  ["منطقة الحدود الشمالية", "عرعر"],
  ["منطقة جازان", "جازان"],
  ["منطقة نجران", "نجران"],
  ["منطقة الباحة", "الباحة"],
  ["منطقة الجوف", "سكاكا"],
];

function geo(city: string, district?: string) {
  return approximatePropertyGeo({ city, district, deedNumber: "611508007272" });
}

describe("approximate property location", () => {
  it.each(REGION_CAPITALS)("%s: its capital «%s» resolves inside the Kingdom", (_region, capital) => {
    const at = geo(capital);
    expect(at).not.toBeNull();
    expect(at!.lat).toBeGreaterThan(16);
    expect(at!.lat).toBeLessThan(33);
    expect(at!.lng).toBeGreaterThan(34);
    expect(at!.lng).toBeLessThan(56);
  });

  it.each(REGION_CAPITALS.filter(([, capital]) => capital !== "الرياض"))(
    "%s: «%s» is not placed in Riyadh",
    (_region, capital) => {
      expect(haversineKm(geo(capital)!, RIYADH)).toBeGreaterThan(50);
    },
  );

  it("gives no location for a city it does not know — never central Riyadh", () => {
    expect(geo("قرية غير مدرجة")).toBeNull();
    expect(geo("قرية غير مدرجة", "حي غير مدرج")).toBeNull();
    expect(geo("")).toBeNull();
  });

  it("places the governorates seen in live data where they are", () => {
    // PO-067355: the inspector pinned the property in Al-Kharj at 24.0932, 47.2721.
    expect(haversineKm(geo("الخرج")!, { lat: 24.093248, lng: 47.272136 })).toBeLessThan(15);
    expect(haversineKm(geo("حفر الباطن")!, RIYADH)).toBeGreaterThan(300);
    expect(geo("ثول")).not.toBeNull();
  });

  it("meets the spelling variants the backend folds", () => {
    expect(hasCityGeo("محافظة الخرج")).toBe(true);
    expect(hasCityGeo("الأحساء")).toBe(true);
    expect(hasCityGeo("الاحساء")).toBe(true);
    expect(hasCityGeo("مكه المكرمه")).toBe(true);
    expect(hasDistrictGeo("الرياض", "حي النرجس")).toBe(true);
    expect(geo("محافظة الخرج")).toEqual(geo("الخرج"));
  });
});

describe("normalizePlaceName", () => {
  it.each([
    ["محافظة الخرج", "الخرج"],
    ["مدينة الرياض", "الرياض"],
    ["حي النرجس", "النرجس"],
    ["الأحساء", "الاحساء"],
    ["مكة المكرمة", "مكه المكرمه"],
    ["  أبها  ", "ابها"],
    ["مشرف", "مشرف"],
    ["", ""],
  ])("%j → %j", (raw, expected) => {
    expect(normalizePlaceName(raw)).toBe(expected);
  });
});
