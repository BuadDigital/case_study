/**
 * The printed valuation report matches what the appraiser entered (VR-739 on dev data): the cost
 * table line for line with inherited prices and rationales, the exact indirect factor, whole-riyal
 * money, one «قيمة المباني بعد الإهلاك», the subject column and factor rationales of the adjustments
 * table, and each approach's weight rationale — in the screen preview and the print copy alike.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createEvaluatorDraft } from "../evaluator-window-data";
import { buildValuationReportLiveFill } from "../valuation-report-live-fill";
import { prepareValuationReportV3Html } from "../valuation-report-v3-preview";

const TEMPLATE = fs.readFileSync(
  path.resolve(process.cwd(), "apps/shell/public/ejadah/valuation-report-v3.html"),
  "utf8",
);

const draft = () => createEvaluatorDraft({ taskId: "t1", propertyId: "p1", poNumber: "PO-1" });

function line(
  factorKey: string,
  percent: number,
  descriptionAr: string,
  sortOrder: number,
  labelAr = "",
) {
  return { id: `${factorKey}-${sortOrder}`, factorKey, labelAr, percent, rationale: "", descriptionAr, isIncluded: true, sortOrder };
}

function comp(n: number, ppsmSeq: number, ppsmDiff: number, weight: number) {
  return {
    id: `c${n}`,
    sortOrder: n,
    isAdopted: true,
    comparable: { comparablePropertyType: "فيلا سكنية", district: "النرجس", price: 1_250_000, areaSqm: 500, pricePerSqm: 2500 },
    effectivePriceSar: 1_250_000,
    effectiveAreaSqm: 500,
    effectivePricePerSqm: 2500,
    market: {
      adjustmentLines: [
        line("market", 2, "", 1),
        line("area", 0, "", 2),
        line("location", 0, "النرجس", 3),
        line("attraction", 1, "قريب من مسجد", 4, "عامل الجذب للموقع"),
        line("access", n === 2 ? -2 : 0, "على شارع 20 م", 5, "سهولة الوصول"),
        line("street_count", n === 3 ? 3 : 0, "واجهة واحدة", 6, "عدد الشوارع"),
      ],
      pricePerSqmAfterSequential: ppsmSeq,
      pricePerSqmAfterDifference: ppsmDiff,
      sumDifferencePct: 1,
      effectiveWeightPct: weight,
    },
  };
}

const market = {
  items: [comp(1, 2494.09, 2506.56, 40), comp(2, 2369.35, 3113.69, 30), comp(3, 2730.54, 2730.54, 30)],
  subjectAreaSqm: 500,
  weightedPricePerSqm: 2730.54,
  marketOpinionValueRaw: 1_365_270,
  marketOpinionValue: 1_365_270,
  subjectSpecs: { attraction: "قريب من مسجد وحديقة", access: "على شارع 15 م", street_count: "واجهتان" },
  factorRationales: [
    { selectionContext: "market", factorKey: "access", rationaleAr: "المقارن الثاني على شارع أعرض فيُخصم ٢٪" },
    { selectionContext: "market", factorKey: "area", rationaleAr: "المساحات متطابقة (500 م²) فلا تسوية" },
    { selectionContext: "market", factorKey: "attraction", rationaleAr: "القرب من المسجد والحديقة يرفع الطلب" },
    { selectionContext: "market", factorKey: "location", rationaleAr: "" },
    { selectionContext: "market", factorKey: "market", rationaleAr: "ارتفاع طفيف في أسعار الفلل بالنرجس" },
    { selectionContext: "market", factorKey: "street_count", rationaleAr: "الواجهة الإضافية ترفع القيمة ٣٪" },
  ],
} as never;

const costLine = (over: Record<string, unknown>) => ({
  unit: "sqm",
  isIncluded: true,
  rationale: "",
  structureKind: "floor",
  ...over,
});

const cost = {
  isSaved: true,
  directCostTotal: 4_434_000,
  indirectItems: [{ itemKey: "design_supervision", labelAr: "التصميم", pct: 33.75, amount: 1_496_475, sortOrder: 0 }],
  indirectRatesSumPct: 33.75,
  totalCostWithIndirect: 5_930_475,
  depreciationValue: 1_482_618.75,
  buildingsValueAfterDepreciation: 4_447_856.25,
  costOpinionWithLand: 4_447_856.25,
  landValueFromMarket: 0,
  landUnitRateFromMarket: 0,
  lines: [
    // Saved out of screen order on purpose: the fence (an extra) sorts before the repeated floors.
    costLine({ id: "fence", itemKey: "fence", itemLabelAr: "السور", label: "السور", structureKind: "fence", unit: "lm", areaSqm: 60, unitCostSar: 400, lineTotal: 24_000, sortOrder: 1, rationale: "سور بلوك مليس بارتفاع 3 م\nغير مضمّن في تكلفة المتر" }),
    costLine({ id: "g", itemKey: "ground_floor", itemLabelAr: "الدور الأرضي", label: "الدور الأرضي", areaSqm: 540, unitCostSar: 1500, lineTotal: 810_000, sortOrder: 0 }),
    costLine({ id: "f", itemKey: "first_floor", itemLabelAr: "الدور الأول", label: "الدور الأول", areaSqm: 600, unitCostSar: 1500, lineTotal: 900_000, sortOrder: 2 }),
    costLine({ id: "r", itemKey: "repeated_floors", itemLabelAr: "الأدوار المتكررة", label: "الأدوار المتكررة", areaSqm: 1800, repeatedFloorCount: 3, unitCostSar: 0, effectiveUnitCostSar: 1500, unitCostInherited: true, effectiveQuantity: 1800, lineTotal: 2_700_000, sortOrder: 3 }),
    costLine({ id: "x", itemKey: "pool", itemLabelAr: "المسبح", label: "المسبح", structureKind: "other", unit: "lump", areaSqm: 1, unitCostSar: 0, lineTotal: 0, sortOrder: 4, isIncluded: false }),
  ],
} as never;

const recon = {
  methods: [
    { approachKind: "market", labelAr: "أسلوب السوق", approachValue: 1_365_270, weightPct: 70, contributionValue: 955_689, rationale: "مقارنات فلل في الحي نفسه — المؤشر الأكثر موثوقية", isIncluded: true, sortOrder: 0, suggestedWeightPct: 70 },
    { approachKind: "cost", labelAr: "أسلوب التكلفة", approachValue: 4_447_856.25, weightPct: 20, contributionValue: 889_571.25, rationale: "مؤشر مساند — مسطحات التكلفة مرتفعة", isIncluded: true, sortOrder: 1, suggestedWeightPct: 20 },
    { approachKind: "doc:3402", labelAr: "مستند خارجي", approachValue: 1_100_000, weightPct: 10, contributionValue: 110_000, rationale: "", isIncluded: true, sortOrder: 2, suggestedWeightPct: 0, valueDocumentAttachmentId: "3402" },
  ],
  weightSumPct: 100,
  weightedValue: 1_955_260.25,
  finalRoundDecimals: 3,
  finalOpinionValue: 1_955_000,
  methodsRationale: "اعتُمد أسلوب السوق رئيسًا",
  liquidationDiscountPct: 0,
  liquidationDiscountApplied: false,
} as never;

function vr739() {
  return buildValuationReportLiveFill({
    draft: draft(),
    marketApproachEnabled: true,
    costApproachEnabled: true,
    property: { propertyType: "فيلا", district: "النرجس", city: "الرياض" } as never,
    // An inspector basement total must not slip into the cost table.
    inspector: { basementTotal: "120", annexTotal: "40" } as never,
    market,
    cost,
    recon,
  });
}

// The whole template renders once per mode (slow under a parallel run); tests only read it.
const rendered = new Map<string, Document>();
function render(mode: "screen" | "print") {
  let dom = rendered.get(mode);
  if (!dom) {
    const html = prepareValuationReportV3Html(TEMPLATE, { live: vr739() }, mode);
    dom = new DOMParser().parseFromString(html, "text/html");
    rendered.set(mode, dom);
  }
  return dom;
}

vi.setConfig({ testTimeout: 30_000 });

const rowsOf = (table: Element | null | undefined) =>
  [...(table?.querySelectorAll("tr") ?? [])].map((tr) =>
    [...tr.querySelectorAll("td")].map((td) => (td.textContent ?? "").trim()),
  );

describe("section 21 — the cost table, line for line", () => {
  it("prints only the appraiser's lines, in screen order, with the inherited repeated-floor price", () => {
    const fill = vr739();
    expect(fill.costRows.map((r) => [r.key, ...r.values])).toEqual([
      ["الدور الأرضي", "540", "1,500", "810,000"],
      ["الدور الأول", "600", "1,500", "900,000"],
      // Unit cost 0 inherits the first floor's 1,500 — 1,800 × 1,500 = 2,700,000.
      ["الأدوار المتكررة", "1,800", "1,500", "2,700,000"],
      ["السور", "60 م.ط", "400", "24,000"],
      ["مجموع التكلفة المباشرة", "4,434,000"],
    ]);
    const keys = fill.costRows.map((r) => r.key);
    for (const ghost of ["القبو", "مسطح الملحق العلوي", "المواقف", "خزانات ومضخات", "تشجير وتنسيق الموقع", "المسبح"]) {
      expect(keys).not.toContain(ghost);
    }
  });

  it("lists each line's «مبرر التقدير» under the table, in print and on screen", () => {
    for (const mode of ["screen", "print"] as const) {
      const sec = render(mode).querySelector('[data-sec="21"]');
      const notes = [...(sec?.querySelectorAll("td.k") ?? [])].find((td) => td.textContent === "مبررات التقدير");
      expect(notes, mode).toBeTruthy();
      expect([...notes!.nextElementSibling!.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
        "السور — سور بلوك مليس بارتفاع 3 م غير مضمّن في تكلفة المتر",
      ]);
      expect(sec?.textContent).not.toContain("القبو");
    }
  });

  it("prints no rationale list when no line has one", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      cost: { directCostTotal: 1, lines: [costLine({ id: "g", itemKey: "ground_floor", itemLabelAr: "الدور الأرضي", areaSqm: 1, unitCostSar: 1, lineTotal: 1, sortOrder: 0 })] } as never,
    });
    expect(fill.costNotes).toBe("");
    const html = prepareValuationReportV3Html(TEMPLATE, { live: fill }, "screen");
    expect(html).not.toContain("مبررات التقدير");
  });
});

describe("section 22 — the indirect factor", () => {
  it("prints the exact factor so direct × factor = the printed total", () => {
    const fill = vr739();
    expect(fill.indirectTotalLabel).toBe(
      "التكلفة الإجمالية — المباشرة × (1 + غير المباشرة) = 4,434,000 × 1.3375",
    );
    expect(4_434_000 * 1.3375).toBe(5_930_475);
    expect(fill.indirectRows.at(-1)?.values).toEqual(["5,930,475"]);
  });
});

describe("whole-riyal money, as on the screens", () => {
  it("never prints halalas for money or price per m²", () => {
    const text = render("print").body.textContent ?? "";
    for (const halalas of ["2,494.09", "2,369.35", "2,506.56", "3,113.69", "2,730.54", "1,482,618.75", "4,447,856.25", "1,955,260.25", "889,571.25"]) {
      expect(text).not.toContain(halalas);
    }
    const fill = vr739();
    expect(fill.cells["قيمة الإهلاك"]).toBe("1,482,619");
    expect(fill.cells["قيمة المباني بعد الإهلاك"]).toBe("4,447,856");
    expect(fill.finalValueRows[0]).toEqual({ key: "القيمة المرجّحة", value: "1,955,260" });
    expect(fill.finalValueRows.at(-1)?.value).toBe("1,955,000");
    const row = (k: string) => fill.adjustmentRows.find((r) => r.key.startsWith(k));
    expect(row("سعر البيع بعد تسوية")?.values).toEqual(["2,494", "2,369", "2,731"]);
    expect(row("المتوسط المرجح")?.values).toEqual(["2,731"]);
  });
});

describe("section 23 — one «قيمة المباني بعد الإهلاك»", () => {
  it("prints the buildings' value after depreciation once", () => {
    for (const mode of ["screen", "print"] as const) {
      const sec = render(mode).querySelector('[data-sec="23"]');
      const labels = [...(sec?.querySelectorAll("td.k") ?? [])].map((td) => td.textContent?.trim());
      expect(labels.filter((l) => l === "قيمة المباني بعد الإهلاك"), mode).toHaveLength(1);
    }
  });

  it("drops the repeated row of an older cached template", () => {
    const old = TEMPLATE.replace(
      '<tr><td class="k" colspan="3">قيمة الأرض</td>',
      '<tr><td class="k" colspan="3">قيمة المباني بعد الإهلاك</td><td class="v num">1</td></tr><tr><td class="k" colspan="3">قيمة الأرض</td>',
    );
    const dom = new DOMParser().parseFromString(prepareValuationReportV3Html(old, { live: vr739() }, "print"), "text/html");
    const labels = [...dom.querySelectorAll('[data-sec="23"] td.k')].map((td) => td.textContent?.trim());
    expect(labels.filter((l) => l === "قيمة المباني بعد الإهلاك")).toHaveLength(1);
  });
});

describe("section 19 — the subject column and the factor rationales", () => {
  it("prints «العقار محل التقييم» with the subject's per-factor descriptions", () => {
    const dom = render("print");
    const table = dom.querySelector('[data-sec="19"] table.mx');
    const header = [...(table?.querySelectorAll("th") ?? [])].map((th) => th.textContent);
    expect(header.slice(0, 3)).toEqual(["عناصر المقارنة", "العقار محل التقييم", "العقار المقارن (1)"]);
    const byLabel = new Map(rowsOf(table).filter((r) => r.length).map((r) => [r[0], r]));
    expect(byLabel.get("وصف العقار المقارن")?.[1]).toBe("فيلا");
    expect(byLabel.get("تسوية المساحة")?.[1]).toBe("500");
    expect(byLabel.get("الموقع العام")?.[1]).toBe("النرجس");
    expect(byLabel.get("عامل الجذب للموقع")?.[1]).toBe("قريب من مسجد وحديقة");
    expect(byLabel.get("سهولة الوصول")?.slice(1, 4)).toEqual(["على شارع 15 م", "على شارع 20 م", "0.00٪"]);
    expect(byLabel.get("عدد الشوارع")?.[1]).toBe("واجهتان");
    // The one-value rows span the subject column too.
    const total = [...(table?.querySelectorAll("tr") ?? [])].find((tr) => tr.className.includes("total"));
    expect(total?.querySelectorAll("td")[1]?.getAttribute("colspan")).toBe("7");
  });

  it("lists every factor's rationale under the table in row order, skipping empty ones", () => {
    const fill = vr739();
    expect(fill.adjustmentNotes.split("\n")).toEqual([
      "تسوية ظروف السوق (عامل الوقت) — ارتفاع طفيف في أسعار الفلل بالنرجس",
      "تسوية المساحة — المساحات متطابقة (500 م²) فلا تسوية",
      "عامل الجذب للموقع — القرب من المسجد والحديقة يرفع الطلب",
      "سهولة الوصول — المقارن الثاني على شارع أعرض فيُخصم ٢٪",
      "عدد الشوارع — الواجهة الإضافية ترفع القيمة ٣٪",
    ]);
    const sec = render("screen").querySelector('[data-sec="19"]');
    const notes = [...(sec?.querySelectorAll("td.k") ?? [])].find((td) => td.textContent === "مبررات التسويات");
    expect(notes?.nextElementSibling?.querySelectorAll("li")).toHaveLength(5);
  });

  it("never marks the subject column or the rationale lists as missing", () => {
    const empty = buildValuationReportLiveFill({
      draft: draft(),
      marketApproachEnabled: true,
      costApproachEnabled: true,
      market: { ...(market as object), subjectSpecs: {}, factorRationales: [] } as never,
      cost: { ...(cost as object), lines: [] } as never,
      recon: { ...(recon as object), methods: (recon as { methods: object[] }).methods.map((m) => ({ ...m, rationale: "" })) } as never,
    });
    const dom = new DOMParser().parseFromString(prepareValuationReportV3Html(TEMPLATE, { live: empty }, "screen"), "text/html");
    expect(dom.querySelectorAll("td.subj[data-rpt-missing]")).toHaveLength(0);
    const labels = [...dom.querySelectorAll("[data-rpt-missing]")].map((el) => el.getAttribute("data-rpt-missing-label") ?? "");
    expect(labels.some((l) => l.includes("مبرر"))).toBe(false);
    expect(dom.body.textContent).not.toContain("مبررات التسويات");
    expect(dom.body.textContent).not.toContain("مبررات نسب المشاركة");
  });
});

describe("section 24 — each approach's weight rationale", () => {
  it("lists «مبرر نسبة المشاركة» per approach under the weighting table", () => {
    const fill = vr739();
    expect(fill.reconNotes.split("\n")).toEqual([
      "أسلوب السوق — طريقة المقارنة — مقارنات فلل في الحي نفسه — المؤشر الأكثر موثوقية",
      "أسلوب التكلفة — طريقة المقاول — مؤشر مساند — مسطحات التكلفة مرتفعة",
    ]);
    for (const mode of ["screen", "print"] as const) {
      const sec = render(mode).querySelector('[data-sec="24"]');
      const notes = [...(sec?.querySelectorAll("td.k") ?? [])].find((td) => td.textContent === "مبررات نسب المشاركة");
      expect(notes?.nextElementSibling?.querySelectorAll("li"), mode).toHaveLength(2);
      // Right under the weighting table, before «مبرر استخدام طرق التقييم».
      expect(notes?.closest("table")?.previousElementSibling?.classList.contains("mx")).toBe(true);
    }
  });

  it("prints no weight rationales when one approach is used (no weighting table)", () => {
    const single = buildValuationReportLiveFill({
      draft: draft(),
      marketApproachEnabled: true,
      costApproachEnabled: false,
      market,
      recon: { ...(recon as object), methods: [(recon as { methods: object[] }).methods[0]] } as never,
    });
    const html = prepareValuationReportV3Html(TEMPLATE, { live: single }, "print");
    expect(html).not.toContain("مبررات نسب المشاركة");
  });
});
