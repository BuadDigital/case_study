import { describe, expect, it } from "vitest";
import { INFATH_SEED_CLIENT_ID } from "@platform/api-client";
import { createEvaluatorDraft } from "../evaluator-window-data";
import {
  applyValuationReportLiveFill,
  buildValuationReportLiveFill,
  resolveReportParticipants,
  resolveReportValuationKeys,
} from "../valuation-report-live-fill";
import { reportValuationChoices } from "../../../components/evaluator/evaluator-report-output-helpers";

/** An Infath execution work order — its defaults are liquidation / auction sale. */
function executionPo() {
  return {
    id: "wo1",
    poNumber: "PO-1",
    assignmentType: "تنفيذ",
    receivedFromEnfathAt: "2026-10-25",
    clientId: INFATH_SEED_CLIENT_ID,
    reportUserClientIds: [],
    clientNameAr: "مركز الإسناد والتصفية (إنفاذ)",
    properties: [],
  };
}

const draft = () => createEvaluatorDraft({ taskId: "t1", propertyId: "p1", poNumber: "PO-1" });

function recon(over: Record<string, unknown>) {
  return {
    valuationRequestId: "vr",
    propertyId: "p1",
    marketOpinionValue: 0,
    costOpinionWithLand: 0,
    methods: [],
    weightSumPct: 100,
    weightsSumTo100: true,
    meetsMultiMethodGate: true,
    finalRoundDecimals: 4,
    methodsRationale: "",
    liquidationDiscountApplied: false,
    liquidationDiscountPct: 0,
    ...over,
  } as never;
}

function sec25Dom() {
  return new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>
      <section data-sec="2"><table>
        <tr><td class="k">الغرض من التقييم</td><td class="v">x</td><td class="k">تاريخ الطلب</td><td class="v num">x</td></tr>
        <tr><td class="k">أساس القيمة</td><td class="v">x</td><td class="k">فرضية القيمة (الاستخدام المفترض)</td><td class="v">x</td></tr>
      </table><p>x</p><ul><li>x</li><li>x</li></ul></section>
      <section data-sec="25"><table>
        <tr><td class="k">القيمة المرجّحة</td><td class="v num" colspan="3">—</td></tr>
        <tr><td class="k">نسبة خصم التصفية المنظمة</td><td class="v num">—</td><td class="k">مبرر خصم التصفية</td><td class="v">—</td></tr>
        <tr><td class="k">قيمة العقار</td><td class="v num" colspan="3">—</td></tr>
      </table>
      <div style="background:#102b4e;color:#fff"><div><div>القيمة النهائية للعقار</div><div>—</div></div><div>—</div></div>
      </section></body></html>`,
    "text/html",
  );
}

const sec25Rows = (dom: Document) =>
  [...dom.querySelectorAll('[data-sec="25"] tr')].map((tr) =>
    [...tr.querySelectorAll("td")].map((td) => td.textContent),
  );

describe("D1 — §2 prints the appraiser's saved basis / premise / purpose", () => {
  it("the reconciliation's market basis wins over the execution work order's liquidation default (r8b)", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      record: executionPo() as never,
      purposeKey: "estate_liquidation",
      recon: recon({
        basisOfValueKey: "market",
        valuePremiseKey: "hau",
        weightedValue: 9_217_969.74,
        finalOpinionValue: 9_220_000,
        // A discount left from before the basis was switched to market never prints.
        liquidationDiscountPct: 20,
      }),
    });
    expect(fill.cells["أساس القيمة"]).toBe("القيمة السوقية");
    expect(fill.cells["فرضية القيمة (الاستخدام المفترض)"]).toBe("أعلى وأفضل استخدام");
    expect(fill.cells["الغرض من التقييم"]).toBe("تصفية التركات");
    expect(fill.isLiquidation).toBe(false);
    expect(fill.liquidationDiscountOn).toBe(false);
    expect(fill.basisDefinition).toContain("القيمة السوقية");
    expect(fill.finalValueRows).toEqual([
      { key: "القيمة المرجّحة", value: "9,217,969.74" },
      { key: "قيمة العقار بعد التقريب (لأقرب 10,000 ر.س.)", value: "9,220,000", total: true },
    ]);

    const dom = sec25Dom();
    applyValuationReportLiveFill(dom, fill);
    expect(dom.querySelector('[data-sec="25"]')?.textContent).not.toContain("خصم");
    expect(sec25Rows(dom)).toEqual([
      ["القيمة المرجّحة", "9,217,969.74"],
      ["قيمة العقار بعد التقريب (لأقرب 10,000 ر.س.)", "9,220,000"],
    ]);
    expect(dom.querySelector('[data-sec="25"] [data-final-value]')?.getAttribute("data-final-value")).toBe("9220000");
    expect(dom.querySelector('[data-sec="2"]')?.textContent).toContain("القيمة السوقية");
    expect(dom.querySelector('[data-sec="2"]')?.textContent).not.toContain("قيمة التصفية");
  });

  it("the work order's defaults only when nothing was saved", () => {
    expect(resolveReportValuationKeys({ record: executionPo() as never })).toEqual({
      purposeKey: "auction_liquidation",
      valueBasisKey: "liquidation",
      premiseKey: "orderly",
    });
    // A saved basis without a premise takes that basis' own default premise.
    expect(
      resolveReportValuationKeys({ record: executionPo() as never, recon: { basisOfValueKey: "market" } }),
    ).toMatchObject({ valueBasisKey: "market", premiseKey: "current" });
  });

  it("the output tab reads purpose from approach settings and labels from the org lists", () => {
    const choices = reportValuationChoices({
      record: executionPo() as never,
      recon: recon({ basisOfValueKey: "market", valuePremiseKey: "hau" }),
      settings: {
        valuationPurposeKey: "litigation",
        valuationPurposeLabelAr: "التقاضي وفض النزاعات",
        valuationDateMode: "retrospective",
        retrospectiveDate: "2026-02-10",
        retrospectiveRationale: "تاريخ إبرام عقد البيع محل النزاع",
        ownershipInterestKey: "leased_land",
        ownershipInterestLabelAr: "أرض مستأجرة",
        remainingLeaseYears: 4,
      } as never,
      lists: {
        valueBases: [{ key: "market", name: "القيمة السوقية (قائمة)", isEnabled: true, cells: ["تعريف"] }],
        purposes: [],
        premises: [],
      },
    });
    expect(choices.purposeKey).toBe("litigation");
    expect(choices.purposeLabel).toBe("التقاضي وفض النزاعات");
    expect(choices.basisLabel).toBe("القيمة السوقية (قائمة)");
    expect(choices.basisDefinition).toBe("تعريف");
    expect(choices.retrospective).toEqual({ date: "2026-02-10", rationale: "تاريخ إبرام عقد البيع محل النزاع" });
    expect(choices.ownership).toEqual({ key: "leased_land", labelAr: "أرض مستأجرة", remainingLeaseYears: 4 });
  });
});

describe("§25 — numbers a reader can reproduce", () => {
  it("liquidation: unrounded weighted → discount → value after it → one rounding step (r6a)", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      record: executionPo() as never,
      recon: recon({
        basisOfValueKey: "liquidation",
        valuePremiseKey: "forced",
        weightedValue: 1_556_861.07,
        finalOpinionBeforeLiquidation: 1_560_000,
        propertyValueAfterLiquidation: 1_245_488.856,
        finalOpinionValue: 1_250_000,
        liquidationDiscountPct: 20,
        liquidationDiscountApplied: true,
        liquidationDiscountRationale: "بيع قسري بالمزاد خلال 30 يوماً",
      }),
    });
    expect(fill.cells["فرضية القيمة"]).toBe("البيع القسري");
    expect(fill.finalWords).toBe("فقط مليون ومائتان وخمسون ألف ريال سعودي لا غير");
    const dom = sec25Dom();
    applyValuationReportLiveFill(dom, fill);
    expect(sec25Rows(dom)).toEqual([
      ["القيمة المرجّحة", "1,556,861.07"],
      ["نسبة خصم التصفية المنظمة", "20٪", "مبرر خصم التصفية", "بيع قسري بالمزاد خلال 30 يوماً"],
      ["القيمة بعد خصم التصفية", "1,245,488.86"],
      ["قيمة العقار بعد التقريب (لأقرب 10,000 ر.س.)", "1,250,000"],
    ]);
  });

  it("no rounding line when the value is already round; two-million words in construct form", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      record: executionPo() as never,
      recon: recon({ basisOfValueKey: "market", weightedValue: 2_000_000, finalOpinionValue: 2_000_000 }),
    });
    expect(fill.finalValueRows.at(-1)).toEqual({ key: "قيمة العقار", value: "2,000,000", total: true });
    expect(fill.finalWords).toBe("فقط مليونا ريال سعودي لا غير");
  });
});

describe("§19 — every applied factor prints", () => {
  const line = (factorKey: string, labelAr: string, percent: number, sortOrder: number, descriptionAr = "") => ({
    id: factorKey,
    factorKey,
    labelAr,
    percent,
    rationale: "",
    descriptionAr,
    isIncluded: true,
    sortOrder,
  });
  const market = {
    weightedPricePerSqm: 10_826.71,
    subjectAreaSqm: 320,
    marketOpinionValueRaw: 3_464_547.2,
    marketOpinionValue: 3_464_547.2,
    items: [
      {
        isAdopted: true,
        sortOrder: 1,
        comparable: { comparablePropertyType: "معرض", district: "الوادي", price: 3_795_000, areaSqm: 330, pricePerSqm: 11_500 },
        market: {
          sumDifferencePct: 1.16,
          pricePerSqmAfterSequential: 10_601.16,
          pricePerSqmAfterDifference: 10_724.14,
          effectiveWeightPct: 100,
          adjustmentLines: [
            line("financing", "تسوية شروط التمويل", 0, 0),
            line("market", "تسوية ظروف السوق", 0.2, 1),
            line("transaction_type", "تسوية نوع المقارن", -8, 2),
            line("area", "تسوية المساحة", 0.16, 3),
            line("location", "الموقع", 0, 4),
            line("access", "سهولة الوصول", 3, 5, "طريق رئيسي"),
            line("c_1", "جودة التشطيب", 1, 6, "فاخر"),
            line("building_age", "عمر المبنى وحالة التشطيب", -3, 7, "أحدث"),
          ],
        },
      },
    ],
  } as never;

  it("offer −8%, access, custom and catalog factors each get a row; no empty time row", () => {
    const fill = buildValuationReportLiveFill({ draft: draft(), market });
    const keys = fill.adjustmentRows.map((r) => r.key);
    expect(keys).not.toContain("تسوية عامل الوقت");
    expect(keys).toContain("تسوية ظروف السوق (عامل الوقت)");
    const row = (k: string) => fill.adjustmentRows.find((r) => r.key === k);
    expect(row("تسوية نوع المقارن")?.values).toEqual(["-8.00٪"]);
    // 11,500 × 1.002 × 0.92 = 10,601.16 — the compounded chain, not the plain sum (−7.80).
    expect(row("إجمالي التسويات التسلسلية ٪ (مركّبة)")?.values).toEqual(["-7.82٪"]);
    expect(row("سعر البيع بعد التسويات التسلسلية")?.values).toEqual(["10,601.16"]);
    expect(row("سهولة الوصول")?.pairs).toEqual([["طريق رئيسي", "3.00٪"]]);
    expect(row("جودة التشطيب")?.pairs).toEqual([["فاخر", "1.00٪"]]);
    expect(row("عمر المبنى وحالة التشطيب")?.pairs).toEqual([["أحدث", "-3.00٪"]]);
    // The difference rows add up to the total: 0.16 + 0 + 3 + 1 − 3 = 1.16.
    expect(row("مجموع نسب التسويات (٪)")?.values).toEqual(["1.16٪"]);
    expect(row("القيمة بطريقة المقارنة")?.values).toEqual(["3,464,547.20"]);
    expect(keys.indexOf("سهولة الوصول")).toBeLessThan(keys.indexOf("جودة التشطيب"));
  });

  it("a land subject's comparison value is «قيمة الأرض قبل التقريب»", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      market,
      property: { propertyType: "أرض", classification: "أرض" } as never,
      inspector: { vacantLand: "نعم" } as never,
    });
    expect(fill.isLand).toBe(true);
    expect(fill.adjustmentComparisonLabel).toBe("قيمة الأرض قبل التقريب");
  });
});

describe("report facts printed as the inspector / roster recorded them", () => {
  it("the ground floor prints once — never again as «مسطح الملحق الأرضي» (O14)", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      inventoryLines: [
        { structureKind: "floor", itemKey: "ground_floor", label: "الدور الأرضي (معارض)", areaSqm: "600", sortOrder: 0 },
        { structureKind: "floor", itemKey: "first_floor", label: "الدور الأول", areaSqm: "600", sortOrder: 1 },
      ] as never,
      cost: {
        directCostTotal: 2_520_000,
        lines: [
          { id: "g", itemKey: "ground_floor", itemLabelAr: "الدور الأرضي", label: "الدور الأرضي", areaSqm: 600, unitCostSar: 2200, lineTotal: 1_320_000, unit: "sqm", isIncluded: true },
          { id: "f", itemKey: "first_floor", itemLabelAr: "الدور الأول", label: "الدور الأول", areaSqm: 600, unitCostSar: 2000, lineTotal: 1_200_000, unit: "sqm", isIncluded: true },
        ],
      } as never,
    });
    const keys = fill.costRows.map((r) => r.key);
    expect(keys).toContain("مسطح الدور الأرضي");
    expect(keys).not.toContain("مسطح الملحق الأرضي");
    expect(keys.filter((k) => k.includes("الأرضي"))).toHaveLength(1);
  });

  it("a real ground annex still prints on its own row", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      cost: {
        directCostTotal: 1,
        lines: [
          { id: "g", itemKey: "ground_floor", itemLabelAr: "الدور الأرضي", label: "الدور الأرضي", areaSqm: 200, unitCostSar: 1800, lineTotal: 360_000, unit: "sqm", isIncluded: true },
          { id: "a", itemKey: "custom", itemLabelAr: "", label: "الملحق الأرضي", areaSqm: 40, unitCostSar: 1500, lineTotal: 60_000, unit: "sqm", isIncluded: true },
        ],
      } as never,
    });
    const annex = fill.costRows.find((r) => r.key === "مسطح الملحق الأرضي");
    expect(annex?.values).toEqual(["40", "1,500", "60,000"]);
  });

  it("services: «غير متوفر» only when the inspector answered and left it out; no answer → «—»", () => {
    const none = buildValuationReportLiveFill({ draft: draft(), inspector: { services: [] } as never });
    expect(none.serviceRows.map((r) => r.values[0])).toEqual(["—", "—", "—", "—"]);
    const some = buildValuationReportLiveFill({ draft: draft(), inspector: { services: ["كهرباء"] } as never });
    expect(some.serviceRows.map((r) => r.values[0])).toEqual(["متوفر", "غير متوفر", "غير متوفر", "غير متوفر"]);
  });

  it("the membership number is never replaced by the practice licence number", () => {
    const noMembership = buildValuationReportLiveFill({ draft: draft(), certifiedLicense: "1302" });
    expect(noMembership.cells["رقم ترخيص مزاولة المهنة"]).toBe("1302");
    expect(noMembership.cells["رقم العضوية"]).toBe("—");
    const withMembership = buildValuationReportLiveFill({
      draft: draft(),
      certifiedLicense: "1302",
      certifiedMembershipNumber: "1210000003",
    });
    expect(withMembership.cells["رقم العضوية"]).toBe("1210000003");
  });
});

describe("§2 scope statements — D9 retrospective rationale, building-only scope, D11 ownership", () => {
  it("prints the retrospective date and rationale in the scope", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      retrospective: { date: "2026-02-25", rationale: "تاريخ وفاة المورث وفق صك حصر الورثة" },
    });
    expect(fill.scopeRows).toEqual([
      {
        label: "مبرر التقييم بأثر رجعي",
        value: "القيمة كما في تاريخ التقييم 2026/02/25 — تاريخ وفاة المورث وفق صك حصر الورثة",
      },
    ]);
    const dom = sec25Dom();
    applyValuationReportLiveFill(dom, fill);
    applyValuationReportLiveFill(dom, fill);
    const rows = [...dom.querySelectorAll('[data-sec="2"] tr[data-scope-row]')];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("تاريخ وفاة المورث");
  });

  it("a building on leased land: ownership with remaining years, and the scope says the land is not valued", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      costScopeKey: "building_only",
      property: { ownershipType: "absolute" } as never,
      ownership: { key: "leased_land", labelAr: "أرض مستأجرة", remainingLeaseYears: 4 },
    });
    expect(fill.cells["نوع الملكية"]).toBe("أرض مستأجرة — المدة المتبقية 4 سنوات");
    expect(fill.scopeRows).toEqual([
      {
        label: "نطاق التقييم",
        value: "يقتصر التقييم على المباني والتحسينات القائمة (أرض مستأجرة — المدة المتبقية 4 سنوات)، ولا تشمل القيمة الأرض.",
      },
    ]);
  });

  it("full ownership keeps the deed's own ownership type", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      property: { ownershipType: "shared" } as never,
      ownership: { key: "freehold", labelAr: "ملكية تامة" },
    });
    expect(fill.cells["نوع الملكية"]).toBe("مشاع");
    expect(fill.scopeRows).toEqual([]);
  });
});

describe("§23 — age rationales and the lease cap (cost handoff)", () => {
  it("prints both rationales and the lease cap under the ages row", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      costApproachEnabled: true,
      cost: {
        actualAgeYears: 18,
        economicAgeYears: 30,
        actualAgeRationale: "رخصة البناء 1429هـ",
        economicAgeRationale: "هيكل حديدي — دليل الهيئة",
        remainingLeaseYears: 4,
        lifeCappedByLease: true,
        effectiveLifeYears: 22,
        lines: [],
      } as never,
    });
    expect(fill.ageNotes.map((n) => n.label)).toEqual([
      "مبرر العمر الفعلي",
      "مبرر العمر الاقتصادي",
      "تحديد العمر بمدة الإيجار",
    ]);
    expect(fill.ageNotes[2]?.value).toContain("مدة الإيجار المتبقية (4 سنة)");
    const dom = new DOMParser().parseFromString(
      `<section data-sec="23"><table>
        <tr><td class="k">العمر الفعلي</td><td class="v num">—</td><td class="k">العمر الاقتصادي</td><td class="v num">—</td></tr>
        <tr><td class="k">التقادم المادي</td><td class="v num">—</td></tr>
      </table></section>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);
    applyValuationReportLiveFill(dom, fill);
    const labels = [...dom.querySelectorAll('[data-sec="23"] tr')].map((tr) => tr.querySelector("td")?.textContent);
    expect(labels).toEqual([
      "العمر الفعلي",
      "مبرر العمر الفعلي",
      "مبرر العمر الاقتصادي",
      "تحديد العمر بمدة الإيجار",
      "التقادم المادي",
    ]);
  });

  it("no notes when nothing was written and the life is not capped", () => {
    const fill = buildValuationReportLiveFill({ draft: draft(), cost: { lines: [] } as never });
    expect(fill.ageNotes).toEqual([]);
  });
});

describe("§26 participants — the people the issuance gate checks (D13), no fixed names", () => {
  const row = (id: string, nameAr: string, role: string, extra: Record<string, unknown> = {}) => ({
    id,
    nameAr,
    role,
    isActive: true,
    membershipNumber: id,
    ...extra,
  });
  it("roster reviewers and assistants, then the assigned appraiser; others and inactive rows stay out", () => {
    const people = resolveReportParticipants(
      [
        row("1", "مقيم معتمد", "certified"),
        row("2", "مراجعة جديدة", "reviewer"),
        row("3", "مساعد", "assistant"),
        row("4", "زميل آخر", "valuer"),
        row("5", "مراجع سابق", "reviewer", { isActive: false }),
        row("6", "المقيم المسند", "valuer", { staffUserId: "u6" }),
      ] as never,
      "المقيم المسند",
      "u6",
    );
    expect(people.map((p) => p.name)).toEqual(["مراجعة جديدة", "مساعد", "المقيم المسند"]);
  });

  it("an assigned appraiser who is also a reviewer prints once (alef / tā marbūṭa spelling aside)", () => {
    const people = resolveReportParticipants(
      [row("2", "أسامة الغامدي", "reviewer")] as never,
      "اسامه الغامدي",
      "",
    );
    expect(people.map((p) => p.name)).toEqual(["أسامة الغامدي"]);
  });
});
