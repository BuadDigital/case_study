// The 30 A→Z scenarios of the 2026-11-04 overnight campaign (see e2e/.az30-run.mjs).
// Each one is a full transaction with every field filled; values vary per scenario (tag).

const c = (type, prices, areas, extra = {}) => prices.map((price, i) => ({ type, price, area: areas[i], ...extra, ...(i === 2 && extra.offerThird ? { kind: "offer" } : {}) }));
const inv = (...lines) => lines.map(([itemKey, label, areaSqm, structureKind, unit = "sqm"], i) => ({ sortOrder: i, structureKind, label, areaSqm: String(areaSqm), itemKey, unit, notes: `${label} — بند ${i + 1}` }));

function base(tag, o) {
  const n = Number(tag);
  return {
    tag, district: "النرجس", lat: 24.70 + n * 0.007, lng: 46.60 + n * 0.006, sides: [25, 24.5], age: 6 + (n % 10),
    classification: "مبنى مفرد", kind: "building", usage: "سكني", movables: false, restrictions: n % 2 === 1,
    ...o,
  };
}

const VILLA_INV = inv(["ground_floor", "الدور الأرضي", 300, "floor"], ["first_floor", "الدور الأول", 280, "floor"], ["upper_annex", "الملحق العلوي", 60, "annex"], ["fence", "السور", 98, "fence", "lm"], ["pool", "المسبح", 1, "other", "lump"]);
const villaVal = (o = {}) => ({
  scope: "land_and_building",
  market: { subjectArea: 640, basis: "whole_property", comps: c("فيلا", [3150000, 3290000, 3080000], [600, 610, 620]), manualWeights: [40, 35, 25] },
  cost: { landComps: c("أرض", [2100000, 2210000, 2050000], [600, 615, 630]), unitCost: 1800, profit: 12 },
  weights: [60, 40], basis: "liquidation", premise: "orderly", liq: 10,
  ...o,
});

export const SCENARIOS = {
  // ── 12 property types ───────────────────────────────────────────────────────────────────────
  "01": base("01", {
    name: "land-residential", title: "أرض سكنية — مقارنة، نطاق أرض فقط", typeAr: "أرض سكنية", classification: "أرض", kind: "land", area: 750, sides: [30, 25],
    valuation: { scope: "land_only", market: { subjectArea: 750, basis: "price_per_sqm", comps: c("أرض", [2250000, 2400000, 2310000], [720, 780, 760]) }, basis: "market", premise: "hau", round: 3 },
  }),
  "02": base("02", {
    name: "land-commercial", title: "أرض تجارية — مقارنة + تكلفة (أرض ومنشآت قائمة)", typeAr: "أرض تجارية", classification: "أرض", kind: "land", usage: "تجاري", area: 1200, sides: [40, 30],
    landStructures: true, inventory: inv(["fence", "السور", 140, "fence", "lm"], ["custom", "مستودع مؤقت من الصاج", 120, "other"]),
    valuation: {
      scope: "land_and_building",
      market: { subjectArea: 1200, basis: "price_per_sqm", comps: c("أرض", [5400000, 5900000, 5650000], [1150, 1250, 1210], { usage: "تجاري" }) },
      cost: { landComps: c("أرض", [5300000, 5800000, 5500000], [1180, 1260, 1190], { usage: "تجاري" }), unitCost: 450, profit: 10, life: 20 },
      weights: [70, 30], basis: "market", premise: "hau",
    },
  }),
  "03": base("03", {
    name: "land-agricultural", title: "أرض زراعية — مقارنة", typeAr: "أرض زراعية", classification: "أرض", kind: "land", usage: "زراعي", area: 5000, sides: [100, 50], district: "العمارية",
    valuation: { scope: "land_only", market: { subjectArea: 5000, basis: "price_per_sqm", comps: c("أرض", [1500000, 1650000, 1420000], [4800, 5200, 5100], { usage: "زراعي", offerThird: true }) }, basis: "market", premise: "hau" },
  }),
  "04": base("04", {
    name: "villa", title: "فيلا — مقارنة 60 + تكلفة 40، تصفية منظمة، مستند ذو قيمة", typeAr: "فيلا", area: 612.5, movables: true, builtArea: 640, rooms: 6,
    inventory: VILLA_INV, valuedDocument: 150000, valuation: villaVal(),
  }),
  "05": base("05", {
    name: "apartment", title: "شقة — مقارنة + تكلفة بحصة الأرض", typeAr: "شقة سكنية", classification: "وحدة داخل مبنى", kind: "apartment", area: 180, builtArea: 180, rooms: 4, floors: 1,
    inventory: inv(["apartment_area", "مساحة الشقة", 180, "floor"], ["shared_portion", "حصة المشترك من المبنى", 22, "other"]),
    valuation: {
      scope: "land_and_building",
      market: { subjectArea: 180, basis: "whole_property", comps: c("شقة", [820000, 870000, 845000], [175, 185, 182]) },
      cost: { landComps: c("أرض", [1800000, 1950000, 1880000], [880, 920, 900]), plotArea: 900, landShare: 45, unitCost: 2200, profit: 15, life: 40 },
      weights: [70, 30], basis: "market", premise: "current",
    },
  }),
  "06": base("06", {
    name: "residential-building", title: "عمارة — تكلفة + مقارنة كعقار كامل (مسطح البناء)", typeAr: "عمارة", area: 900, sides: [30, 30], builtArea: 2100, units: 8, floors: 3, rooms: 24,
    inventory: inv(["ground_floor", "الدور الأرضي", 650, "floor"], ["first_floor", "الدور الأول", 650, "floor"], ["custom", "الدور الثاني", 650, "floor"], ["upper_annex", "الملحق العلوي", 150, "annex"], ["elevator", "المصعد", 2, "other", "count"], ["parking", "المواقف", 10, "other", "count"]),
    valuation: {
      scope: "land_and_building",
      market: { subjectArea: 2100, basis: "whole_property", comps: c("عمارة", [6900000, 7300000, 7100000], [2000, 2150, 2080]) },
      cost: { landComps: c("أرض", [2600000, 2800000, 2700000], [880, 940, 910]), unitCost: 1650, profit: 18, life: 50 },
      weights: [40, 60], basis: "market", premise: "hau",
    },
  }),
  "07": base("07", {
    name: "duplex", title: "دوبلكس — مقارنة، تصفية قسرية", typeAr: "دوبلكس", assetSubject: "فيلا", inspectorDescription: "دوبلكس دورين متلاصق — الأصل «فيلا» لعدم وجود «دوبلكس» في القائمة — 07", area: 300, builtArea: 360, rooms: 5,
    inventory: inv(["ground_floor", "الدور الأرضي", 180, "floor"], ["first_floor", "الدور الأول", 180, "floor"]),
    valuation: { scope: "land_and_building", market: { subjectArea: 360, basis: "whole_property", comps: c("فيلا", [1650000, 1720000, 1590000], [350, 370, 340]) }, basis: "liquidation", premise: "forced", liq: 20 },
  }),
  "08": base("08", {
    name: "shop-leased-land", title: "محل تجاري — تكلفة مبانٍ فقط، أرض مستأجرة (مدة متبقية)", typeAr: "محل تجاري", classification: "وحدة داخل مبنى", kind: "building", usage: "تجاري", area: 96, builtArea: 96, rooms: 1, floors: 1,
    inventory: inv(["custom", "مساحة المحل", 96, "floor"], ["central_ac", "التكييف المركزي", 1, "other", "lump"]),
    valuation: { scope: "building_only", ownership: "leased_land", leaseYears: 12, cost: { unitCost: 1500, profit: 11, life: 40 }, basis: "market", premise: "current" },
  }),
  "09": base("09", {
    name: "warehouse", title: "مستودع — تكلفة مبانٍ فقط", typeAr: "مستودع", usage: "صناعي", area: 2000, sides: [50, 40], builtArea: 1600, rooms: 2, floors: 1, district: "السلي",
    inventory: inv(["ground_floor", "صالة المستودع", 1500, "floor"], ["custom", "مكاتب إدارية", 100, "floor"], ["fence", "السور", 180, "fence", "lm"]),
    valuation: { scope: "building_only", cost: { unitCost: 900, profit: 10, life: 35 }, basis: "market", premise: "current" },
  }),
  "10": base("10", {
    name: "farm", title: "مزرعة — مقارنة", typeAr: "مزرعة", usage: "زراعي", area: 20000, sides: [200, 100], builtArea: 250, rooms: 3, floors: 1, district: "العمارية",
    inventory: inv(["ground_floor", "بيت المزرعة", 250, "floor"], ["fence", "السور", 600, "fence", "lm"], ["tanks_pumps", "خزانات ومضخات", 1, "other", "lump"]),
    valuation: { scope: "land_and_building", market: { subjectArea: 20000, basis: "whole_property", comps: c("مزرعة", [4200000, 4550000, 4380000], [19000, 21000, 20500], { usage: "زراعي" }) }, basis: "market", premise: "hau" },
  }),
  "11": base("11", {
    name: "istiraha-retro", title: "استراحة — تكلفة، تاريخ تقييم سابق بمبرر", typeAr: "استراحة", classification: "مرفق عام", area: 1500, sides: [50, 30], builtArea: 220, rooms: 2, floors: 1,
    inventory: inv(["ground_floor", "مبنى الاستراحة", 220, "floor"], ["pool", "المسبح", 1, "other", "lump"], ["fence", "السور", 160, "fence", "lm"], ["landscaping", "تشجير وتنسيق الموقع", 1, "other", "lump"]),
    valuation: {
      scope: "land_and_building", retro: { date: "2026-06-30", why: "تاريخ الحجز التنفيذي وفق قرار الدائرة" },
      cost: { landComps: c("أرض", [1900000, 2050000, 1980000], [1450, 1550, 1500], { date: "2026-05-20" }), unitCost: 1400, profit: 22, life: 40 },
      basis: "market", premise: "hau",
    },
  }),
  "12": base("12", {
    name: "villa-compound", title: "مجمع فلل — مقارنة + تكلفة، أساس القيمة السوقية", typeAr: "مجمع فلل", classification: "مجمع", area: 4000, sides: [80, 50], builtArea: 3200, units: 8, buildings: 8, rooms: 40, floors: 2,
    inventory: inv(["ground_floor", "الأدوار الأرضية (8 فلل)", 1600, "floor"], ["first_floor", "الأدوار الأولى (8 فلل)", 1600, "floor"], ["fence", "السور", 260, "fence", "lm"], ["landscaping", "تنسيق الموقع", 1, "other", "lump"]),
    valuation: {
      scope: "land_and_building",
      market: { subjectArea: 3200, basis: "whole_property", comps: c("مجمع فلل", [21000000, 22500000, 21800000], [3900, 4100, 4050]) },
      cost: { landComps: c("أرض", [11500000, 12300000, 11900000], [3900, 4100, 4000]), unitCost: 1900, profit: 16, life: 50 },
      weights: [50, 50], basis: "market", premise: "hau",
    },
  }),
};

import { addMore } from "./.az30-scenarios-more.mjs";
addMore(SCENARIOS);
