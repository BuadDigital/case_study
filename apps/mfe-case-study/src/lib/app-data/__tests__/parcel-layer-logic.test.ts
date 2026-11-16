import { describe, expect, it } from "vitest";
import {
  LAND_LAYERS_OFF,
  arabicForMap,
  landLayerHint,
  parcelFacts,
  parcelHighlightColor,
  parcelKey,
  parcelLineStyle,
  parcelNumberText,
  parcelTileUrls,
  parcelTilesBase,
  parcelUseLabel,
  planNumberText,
} from "../parcel-layer-logic";

// Omar 2026-11-16: the land parcels on the properties map.
describe("parcelTilesBase / parcelTileUrls", () => {
  it("has no layer without a tile server, and trims the address's trailing slashes", () => {
    expect(parcelTilesBase("")).toBeNull();
    expect(parcelTilesBase("   ")).toBeNull();
    expect(parcelTilesBase(undefined)).toBe(parcelTilesBase(process.env.NEXT_PUBLIC_PARCEL_TILES_URL));
    expect(parcelTilesBase(" http://localhost:8091// ")).toBe("http://localhost:8091");
  });

  it("puts the parcels and their numbers under the server's address", () => {
    expect(parcelTileUrls("https://tiles.example")).toEqual({
      plans: "https://tiles.example/plans/{z}/{x}/{y}.mvt",
      parcels: "https://tiles.example/parcels/{z}/{x}/{y}.mvt",
      labels: "https://tiles.example/labels/{z}/{x}/{y}.mvt",
    });
  });
});

describe("parcelFacts", () => {
  it("lists the plan, parcel, district, city, area and use of a clicked parcel", () => {
    expect(
      parcelFacts({ plan: "1637/ك", parcel: "1588/2", district: "الملقا", city: "الرياض", area: 450.5, use: 100000 }),
    ).toEqual([
      { label: "رقم المخطط", value: "1637/ك", ltr: true },
      { label: "رقم القطعة", value: "1588/2", ltr: true },
      { label: "الحي", value: "الملقا" },
      { label: "المدينة", value: "الرياض" },
      { label: "المساحة", value: "450.5 م²" },
      { label: "الاستخدام", value: "سكني" },
    ]);
  });

  it("reads MOMRAH's 9999 as no plan, an empty value as «—», an unknown use as its code", () => {
    const facts = parcelFacts({ plan: "9999", parcel: null, area: null, use: 999 });
    expect(facts.map((f) => f.value)).toEqual(["—", "—", "—", "—", "—", "999"]);
    expect(parcelUseLabel("200000")).toBe("تجاري");
  });
});

describe("parcelKey / parcelNumberText / parcelLineStyle", () => {
  it("names a parcel by its city, plan and number, and spaces the number's slash", () => {
    expect(parcelKey({ city: "جدة", plan: "290ج/س", parcel: "12" })).toBe("جدة|290ج/س|12");
    expect(parcelNumberText({ parcel: "1588/2" })).toBe("1588 / 2");
  });

  it("writes nothing on the map for MOMRAH's «لا يوجد رقم» or an empty number", () => {
    expect(parcelNumberText({ parcel: "لا يوجد رقم" })).toBe("");
    expect(parcelNumberText({ parcel: "  " })).toBe("");
  });

  it("draws faint thin lines far out and firm ones close in — white on imagery, navy on streets", () => {
    expect(parcelLineStyle(13, true)).toEqual({ color: [255, 255, 255, 90], width: 0.4 });
    expect(parcelLineStyle(16, false)).toEqual({ color: [18, 40, 76, 160], width: 0.7 });
    expect(parcelLineStyle(19, false)).toEqual({ color: [18, 40, 76, 255], width: 1.4 });
  });

  it("fills the clicked parcel navy on imagery (gold is lost on the desert) and gold on a street map", () => {
    expect(parcelHighlightColor(true)).toEqual([18, 40, 76, 170]);
    expect(parcelHighlightColor(false)).toEqual([200, 181, 145, 170]);
  });
});

// deck.gl draws label characters one by one, left to right, unjoined (seen 2026-11-16).
describe("arabicForMap", () => {
  it("leaves text without Arabic letters as it is", () => {
    expect(arabicForMap("1588 / 2")).toBe("1588 / 2");
  });

  it("joins a word's letters and reverses them so the map reads them right", () => {
    // «رقم»: ر isolated (joins nothing after it), ق initial, م final — drawn م ق ر.
    expect(arabicForMap("رقم")).toBe("ﻢﻗﺭ");
  });

  it("keeps the numbers' left-to-right order around an Arabic letter, as on the deed page", () => {
    expect(arabicForMap("م / 1")).toBe("ﻡ / 1");
    expect(arabicForMap("12 / أ")).toBe("12 / ﺃ");
  });

  it("draws lam-alef as one glyph and reverses a run of several words as a whole", () => {
    // «لا يوجد»: ﻻ, then ي initial, و final, ج initial, د final — reversed for the map.
    expect(arabicForMap("لا يوجد")).toBe("ﺪﺟﻮﻳ ﻻ");
  });
});

// Omar 2026-11-16: plans, parcel outlines and parcel numbers — three switches in the top bar.
describe("landLayerHint", () => {
  it("says nothing while no land layer is on, or every one that is on is drawn", () => {
    expect(landLayerHint(LAND_LAYERS_OFF, 6)).toBeNull();
    expect(landLayerHint({ plans: true, parcels: true, numbers: false }, 13)).toBeNull();
  });

  it("names the switched-on layers that need a closer zoom", () => {
    expect(landLayerHint({ plans: true, parcels: false, numbers: false }, 6)).toBe("قرّب الخريطة لتظهر المخططات");
    expect(landLayerHint({ plans: true, parcels: true, numbers: true }, 12)).toBe(
      "قرّب الخريطة لتظهر حدود القطع وأرقام القطع",
    );
  });
});

describe("planNumberText", () => {
  it("writes a plan number for the map, and nothing for MOMRAH's 9999, «بدون» or an empty one", () => {
    expect(planNumberText("2347")).toBe("2347");
    expect(planNumberText("1637/ك")).toBe("1637 / ﻙ");
    expect(planNumberText("9999")).toBe("");
    expect(planNumberText(" بدون ")).toBe("");
    expect(planNumberText(null)).toBe("");
  });
});
