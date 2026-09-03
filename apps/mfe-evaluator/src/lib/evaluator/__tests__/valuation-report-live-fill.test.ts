import { describe, expect, it } from "vitest";
import {
  INFATH_SEED_CLIENT_ID,
  NABR_SEED_CLIENT_ID,
} from "@platform/api-client";
import {
  createEvaluatorDraft,
  emptyReportChoices,
  seedReportChoicesFromAssignment,
} from "../evaluator-window-data";
import {
  applyValuationReportLiveFill,
  buildValuationReportLiveFill,
} from "../valuation-report-live-fill";

function poRecord(over: Record<string, unknown> = {}) {
  return {
    id: "wo1",
    poNumber: "PO-1",
    assignmentType: "قطاع خاص",
    promulgationDate: "",
    receivedFromEnfathAt: "2026-08-01",
    receivedFromEnfathTime: "",
    assignmentSpecialist: "",
    assignmentSpecialistEmail: "",
    expectedPropertyCount: 1,
    propertiesRegion: "",
    workOrderDescription: "",
    clientId: INFATH_SEED_CLIENT_ID,
    reportUserClientIds: [NABR_SEED_CLIENT_ID],
    clientNameAr: "مركز الإسناد والتصفية (إنفاذ)",
    dueDateAt: "",
    createdAtUtc: "",
    properties: [],
    ...over,
  };
}

describe("valuation report live fill from intake", () => {
  it("uses live PO sale/market even when the draft still has auction/equitable keys", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
      assignmentType: "تنفيذ",
    });
    draft.reportChoices = {
      ...emptyReportChoices(),
      purposeKey: "auction_liquidation",
      valueBasisKey: "equitable",
      premiseKey: "orderly",
    };
    const fill = buildValuationReportLiveFill({
      draft,
      record: poRecord() as never,
      property: {
        ownerName: "احمد",
        ownershipType: "absolute",
        city: "جدة",
      } as never,
      clients: [{ id: NABR_SEED_CLIENT_ID, nameAr: "شركة نبر العقارية" }],
    });

    expect(fill.cells["أساس القيمة"]).toBe("القيمة السوقية");
    expect(fill.cells["الغرض من التقييم"]).toBe("البيع");
    expect(fill.cells["فرضية القيمة"]).toBe("الاستخدام الحالي");
    expect(fill.cells["نوع الملكية"]).toBe("ملكية مطلقة");
    expect(fill.cells["اسم مستخدم تقرير التقييم"]).toContain("نبر");
    expect(fill.cells["نسبة خصم التصفية المنظمة"]).toBe("—");
  });

  it("prefers valuation lists API labels for the PO keys", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const empty = buildValuationReportLiveFill({ draft });
    expect(empty.cells["أساس القيمة"]).toBe("—");

    const fill = buildValuationReportLiveFill({
      draft,
      record: poRecord() as never,
      purposeLabel: "بيع (من القائمة)",
      basisLabel: "قيمة سوقية (من القائمة)",
      premiseLabel: "استخدام حالي (من القائمة)",
      basisDefinition: "تعريف أساس السوق من القائمة",
    });
    expect(fill.cells["الغرض من التقييم"]).toBe("بيع (من القائمة)");
    expect(fill.cells["أساس القيمة"]).toBe("قيمة سوقية (من القائمة)");
    expect(fill.cells["فرضية القيمة"]).toBe("استخدام حالي (من القائمة)");
    expect(fill.basisDefinition).toBe("تعريف أساس السوق من القائمة");
    expect(fill.basisDefinition).not.toMatch(/قيمة التصفية/);
  });

  it("falls back to static maps when list labels are absent", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      record: poRecord() as never,
    });
    expect(fill.cells["أساس القيمة"]).toBe("القيمة السوقية");
    expect(fill.cells["الغرض من التقييم"]).toBe("البيع");
  });

  it("joins build license number and date for §07", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      inspector: {
        buildLicenseNumber: "1441/2345",
        buildLicenseDate: "هـ1441/03/15",
      } as never,
    });
    expect(fill.cells["رقم رخصة البناء وتاريخها"]).toBe(
      "1441/2345 · هـ1441/03/15",
    );
  });

  it("overwrites previously seeded assignment keys from the current PO", () => {
    const next = seedReportChoicesFromAssignment("قطاع خاص", NABR_SEED_CLIENT_ID, {
      ...emptyReportChoices(),
      purposeKey: "auction_liquidation",
      valueBasisKey: "equitable",
      premiseKey: "orderly",
      marketMethodKey: "comparison",
    });
    expect(next.purposeKey).toBe("sale");
    expect(next.valueBasisKey).toBe("market");
    expect(next.premiseKey).toBe("current");
    expect(next.marketMethodKey).toBe("comparison");
  });

  it("does not force liquidation defaults when assignment type is unknown", () => {
    const existing = {
      ...emptyReportChoices(),
      purposeKey: "sale",
      valueBasisKey: "market",
      premiseKey: "current",
    };
    const next = seedReportChoicesFromAssignment("", null, existing);
    expect(next.valueBasisKey).toBe("market");
    expect(next.purposeKey).toBe("sale");
    expect(next.premiseKey).toBe("current");
  });

  it("keeps a compatible premise when reseeding the same basis", () => {
    const next = seedReportChoicesFromAssignment("تنفيذ", null, {
      ...emptyReportChoices(),
      purposeKey: "auction_liquidation",
      valueBasisKey: "liquidation",
      premiseKey: "forced",
    });
    expect(next.valueBasisKey).toBe("liquidation");
    expect(next.premiseKey).toBe("forced");
  });

  it("uses orderly premise when the PO is execution/liquidation", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      record: poRecord({ assignmentType: "تنفيذ" }) as never,
    });
    expect(fill.cells["أساس القيمة"]).toBe("قيمة التصفية");
    expect(fill.cells["فرضية القيمة"]).toBe("التصفية المنظمة");
  });

  it("blanks sample comparable cells and fills PO identity", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
      assignmentType: "قطاع خاص",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      record: poRecord({ clientNameAr: "عميل التجربة" }) as never,
      property: { ownerName: "مالك حي", city: "الدمام" } as never,
    });
    const dom = new DOMParser().parseFromString(
      `<section data-sec="2">
        <table>
          <tr><td class="k">اسم العميل</td><td class="v">مركز الإسناد والتصفية (إنفاذ)</td></tr>
          <tr><td class="k">أساس القيمة</td><td class="v">قيمة التصفية</td></tr>
          <tr><td class="k">اسم المالك</td><td class="v">شركة نبر للتنمية العقارية</td></tr>
          <tr><td class="k">اسم المدينة</td><td class="v">جدة</td></tr>
        </table>
        <p>يعتمد أساس التقييم على تحديد التصفية المنظمة</p>
        <ul><li>تعريف قديم</li><li>أُعد هذا التقرير لاستخدام العميل (إنفاذ)</li></ul>
      </section>
      <section data-sec="17">
        <table>
          <tr><th>#</th><th>العقار</th></tr>
          <tr><td class="num">1</td><td class="v">فيلا سكنية</td><td class="num">1,444,000.00</td></tr>
        </table>
      </section>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);
    expect(dom.body.textContent).toContain("القيمة السوقية");
    expect(dom.querySelector('[data-sec="2"]')?.textContent).not.toContain(
      "قيمة التصفية",
    );
    expect(dom.body.textContent).toContain("مالك حي");
    expect(dom.body.textContent).toContain("الدمام");
    expect(dom.querySelector('[data-sec="17"] td.num')?.textContent).toBe("1");
    expect(dom.querySelector('[data-sec="17"] td.v')?.textContent).toBe("—");
  });

  it("fills inspector counts, inventory areas, and amenities onto the sheet", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
      assignmentType: "قطاع خاص",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      record: poRecord() as never,
      inspector: {
        roomCount: "4",
        hallCount: "2",
        bathroomCount: "3",
        annexTotal: "40",
        annexUpperCount: "1",
        annexGroundCount: "2",
        playgroundCount: "1",
        showroomCount: "2",
        hasAnnex: "نعم",
        featureValues: { hasElevator: "نعم", hasPool: "لا", kitchen: "نعم" },
        amenities: ["مساجد", "مدارس"],
        services: ["كهرباء"],
        electricityMeterCount: "2",
        electricityMeterNumbers: "12, 14",
        observations: [{ category: "عيب ظاهر", text: "تشقق" }],
      } as never,
      inventoryLines: [
        {
          sortOrder: 1,
          structureKind: "floor",
          label: "الدور الأرضي",
          areaSqm: "180",
          notes: "مجلس ومطبخ",
        },
      ],
    });
    expect(fill.cells["غرف النوم"]).toBe("4");
    expect(fill.cells["ملاحق"]).toBe("3");
    expect(fill.cells["ملحق علوي (عدد)"]).toBe("1");
    expect(fill.cells["ملحق أرضي (عدد)"]).toBe("2");
    expect(fill.cells["ملاعب أطفال"]).toBe("1");
    expect(fill.cells["عدد المعارض"]).toBe("2");
    expect(fill.cells["مصعد"]).toBe("يوجد");
    expect(
      buildValuationReportLiveFill({
        draft,
        record: poRecord() as never,
        inspector: {
          featureValues: {
            hasFence: "نعم",
            hasCentralAc: "لا",
            hasTanks: "نعم",
            hasLandscaping: "لا",
          },
        } as never,
      }).cells,
    ).toMatchObject({
      سور: "يوجد",
      "تكييف مركزي": "لا يوجد",
      خزانات: "يوجد",
      تشجير: "لا يوجد",
    });
    expect(fill.cells["جامع"]).toBe("يوجد");
    expect(fill.cells["مرفق تعليمي"]).toBe("يوجد");
    expect(fill.cells["وصف العيوب الإنشائية"]).toContain("تشقق");
    expect(fill.areaRows[0]?.values[0]).toBe("180");
    expect(fill.cells["مجموع مسطحات البناء"]).toBe("180");
    expect(fill.serviceRows[0]?.values[0]).toBe("متوفر");
    expect(fill.serviceRows[0]?.values[1]).toBe("2");
  });

  it("resolves client name from the clients list when the WO name is blank", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      record: poRecord({
        clientNameAr: "",
        clientId: INFATH_SEED_CLIENT_ID,
        reportUserClientIds: [],
      }) as never,
      clients: [{ id: INFATH_SEED_CLIENT_ID, nameAr: "مركز الإسناد والتصفية (إنفاذ)" }],
    });
    expect(fill.cells["اسم العميل"]).toBe("مركز الإسناد والتصفية (إنفاذ)");
  });

  it("uses inspector asset type when property type is empty", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      inspector: {
        featureValues: { assetSubject: "أرض", propertyUsage: "سكني" },
      } as never,
    });
    expect(fill.cells["نوع العقار"]).toBe("أرض");
  });

  it("prefers survey boundaries and rebuilds extra inventory rows", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      property: {
        northBoundary: "قطعة قديمة",
        northBoundaryLengthM: "10",
      } as never,
      survey: {
        northBoundary: "شارع 20م",
        northBoundaryLengthM: "26",
      },
      inventoryLines: [
        {
          sortOrder: 1,
          structureKind: "floor",
          label: "الدور الأرضي",
          areaSqm: "100",
        },
        {
          sortOrder: 2,
          structureKind: "floor",
          label: "الدور الثاني",
          areaSqm: "80",
          notes: "غرف نوم",
        },
      ],
    });
    expect(fill.boundaries[0]?.bound).toBe("شارع 20م");
    expect(fill.boundaries[0]?.len).toBe("26");
    expect(fill.cells["مجموع مسطحات البناء"]).toBe("180");
    expect(fill.areaRows.some((r) => r.key === "الدور الثاني")).toBe(true);
    expect(fill.buildDescRows.some((r) => r.key === "الدور الثاني")).toBe(true);

    const dom = new DOMParser().parseFromString(
      `<section data-sec="9">
        <table><tr><td class="k">مساحة الأرض (حسب الصك)</td><td class="v num">1</td></tr></table>
        <table class="mx">
          <tr><th>البيان</th><th>م</th></tr>
          <tr><td class="v">الدور الأرضي</td><td class="num">1</td></tr>
          <tr class="total"><td class="v">مجموع مسطحات البناء</td><td class="num">400.00</td></tr>
        </table>
      </section>
      <section data-sec="2">
        <ul><li>old</li><li>أُعد هذا التقرير لاستخدام العميل (إنفاذ) فقط</li></ul>
      </section>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);
    expect(dom.querySelector('[data-sec="9"]')?.textContent).toContain("الدور الثاني");
    expect(dom.querySelector('[data-sec="9"]')?.textContent).toContain("180");
    expect(dom.querySelector('[data-sec="9"]')?.textContent).not.toContain("400.00");
    expect(dom.querySelector('[data-sec="2"] li:last-child')?.textContent).toContain("—");
  });

  it("uses inspection date when the appraisal draft has no valuation date", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      inspector: { inspectionDate: "2026-08-12" } as never,
    });
    expect(fill.cells["تاريخ التقييم"]).toBe("2026/08/12");
  });

  it("fills cost-approach land rate, area, and value on section 20", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      property: { area: "390" } as never,
      cost: {
        landUnitRateFromMarket: 2000,
        landAreaSqm: 400,
        landValueFromMarket: 800_000,
        landEstimateComplete: true,
      } as never,
    });
    expect(fill.cells["سعر متر الأرض من مقارنات الأراضي الفضاء"]).toBe("2,000");
    expect(fill.cells["سعر المتر المستورد من طريقة المقارنة"]).toBe("2,000");
    expect(fill.landAppendixNote).toContain("الملحق (أ)");
    expect(fill.cells["مساحة الأرض (م²)"]).toBe("400");
    expect(fill.cells["قيمة الأرض"]).toBe("800,000");

    const dom = new DOMParser().parseFromString(
      `<section data-sec="20">
        <table>
          <tr><td class="k">سعر المتر المستورد من طريقة المقارنة</td><td class="v num">9</td>
              <td class="k">مساحة الأرض (م²)</td><td class="v num">9</td></tr>
          <tr><td class="k">قيمة الأرض</td><td class="v num" colspan="3">9</td></tr>
        </table>
      </section>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);
    const nums = [...dom.querySelectorAll('[data-sec="20"] td.num')].map(
      (td) => td.textContent,
    );
    expect(nums).toEqual(["2,000", "400", "800,000"]);
  });

  it("rebuilds direct cost rows including lump fence and tanks", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      cost: {
        directCostTotal: 379_000,
        lines: [
          {
            id: "g",
            itemKey: "ground_floor",
            itemLabelAr: "الدور الأرضي",
            areaSqm: 180,
            unit: "sqm",
            unitCostSar: 1800,
            lineTotal: 324_000,
            isIncluded: true,
          },
          {
            id: "f",
            itemKey: "fence",
            itemLabelAr: "السور",
            unit: "lump",
            lineTotal: 40_000,
            isIncluded: true,
          },
          {
            id: "t",
            itemKey: "tanks_pumps",
            itemLabelAr: "خزانات ومضخات",
            unit: "lump",
            lineTotal: 15_000,
            isIncluded: true,
          },
        ],
      } as never,
    });
    expect(fill.costRows.find((r) => r.key === "السور")?.values).toEqual([
      "مقطوعية",
      "40,000",
    ]);
    expect(
      fill.costRows.find((r) => r.key === "خزانات ومضخات")?.values[1],
    ).toBe("15,000");

    const dom = new DOMParser().parseFromString(
      `<section data-sec="21">
        <table>
          <tr><th>البند</th><th>كمية</th><th>سعر</th><th>إجمالي</th></tr>
          <tr><td class="v">مسطح الدور الأرضي</td><td class="num">1</td><td class="num">1</td><td class="num">1</td></tr>
        </table>
      </section>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);
    const text = dom.querySelector('[data-sec="21"]')?.textContent ?? "";
    expect(text).toContain("324,000");
    expect(text).toContain("مقطوعية");
    expect(text).toContain("خزانات ومضخات");
    expect(text).toContain("379,000");
  });

  it("rebuilds indirect cost percents and the grand-total formula", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      cost: {
        directCostTotal: 800_000,
        indirectRatesSumPct: 15,
        totalCostWithIndirect: 920_000,
        indirectItems: [
          {
            itemKey: "design_supervision",
            labelAr: "التصميم والإشراف الهندسي",
            pct: 4,
          },
          { itemKey: "contingency", labelAr: "مخصص الطوارئ", pct: 2 },
          {
            itemKey: "developer_profit",
            labelAr: "أرباح المطور والمخاطرة",
            pct: 4,
          },
        ],
      } as never,
    });
    expect(
      fill.indirectRows.find((r) => r.key === "التصميم والإشراف الهندسي")
        ?.values[0],
    ).toBe("4.00٪");
    expect(fill.indirectTotalLabel).toContain("800,000");

    const dom = new DOMParser().parseFromString(
      `<section data-sec="22">
        <table>
          <tr><th>البند</th><th>النسبة</th></tr>
          <tr><td class="v">التصميم والإشراف الهندسي</td><td class="num">9٪</td></tr>
        </table>
      </section>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);
    const text = dom.querySelector('[data-sec="22"]')?.textContent ?? "";
    expect(text).toContain("4.00٪");
    expect(text).toContain("توصيل الخدمات");
    expect(text).toContain("920,000");
    expect(text).toContain("1.15");
  });

  it("fills depreciation percents and ages on section 23", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      inspector: { propertyAgeYears: "10" } as never,
      cost: {
        actualAgeYears: 10,
        economicAgeYears: 40,
        physicalObsolescencePct: 25,
        functionalObsolescencePct: 0,
        externalObsolescencePct: 0,
        totalObsolescencePct: 25,
        depreciationValue: 230_000,
        buildingsValueAfterDepreciation: 690_000,
        landValueFromMarket: 800_000,
        costOpinionWithLand: 1_490_000,
      } as never,
    });
    expect(fill.cells["العمر الفعلي"]).toBe("10 سنوات");
    expect(fill.cells["العمر الاقتصادي"]).toBe("40 سنة");
    expect(fill.cells["التقادم المادي"]).toBe("25.00٪");
    expect(fill.cells["مجموع التقادم"]).toBe("25.00٪");

    const dom = new DOMParser().parseFromString(
      `<section data-sec="23">
        <table>
          <tr><td class="k">التقادم المادي</td><td class="v num">9</td>
              <td class="k">التقادم الوظيفي</td><td class="v num">9</td></tr>
          <tr><td class="k">مجموع التقادم</td><td class="v num">9</td></tr>
          <tr><td class="k">قيمة الإهلاك</td><td class="v num">9</td></tr>
        </table>
      </section>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);
    expect(dom.querySelector('[data-sec="23"]')?.textContent).toContain("25.00٪");
    expect(dom.querySelector('[data-sec="23"]')?.textContent).toContain("230,000");
  });

  it("rebuilds reconciliation weights, contributions, and rationale", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    draft.reportChoices = {
      ...emptyReportChoices(),
      methodsRationale: "رُجّح السوق لتوفر مقارنات",
    };
    const fill = buildValuationReportLiveFill({
      draft,
      recon: {
        weightSumPct: 100,
        weightedValue: 1_514_000,
        methodsRationale: "رُجّح السوق لتوفر مقارنات",
        methods: [
          {
            approachKind: "market",
            isIncluded: true,
            approachValue: 1_530_000,
            weightPct: 60,
            contributionValue: 918_000,
          },
          {
            approachKind: "cost",
            isIncluded: true,
            approachValue: 1_490_000,
            weightPct: 40,
            contributionValue: 596_000,
          },
        ],
      } as never,
    });
    const marketRow = fill.reconRows.find((r) =>
      r.key.startsWith("أسلوب السوق"),
    );
    expect(marketRow?.values).toEqual(["1,530,000", "60.00٪", "918,000"]);

    const dom = new DOMParser().parseFromString(
      `<section data-sec="24">
        <table class="mx">
          <tr><th>الأسلوب</th><th>قيمة</th><th>نسبة</th><th>بعد</th></tr>
          <tr><td class="v">أسلوب السوق — طريقة المقارنة</td><td class="num">9</td><td class="num">9</td><td class="num">9</td></tr>
        </table>
        <table>
          <tr><td class="k">مبرر استخدام طرق التقييم</td><td class="v">عينة</td></tr>
        </table>
      </section>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);
    const text = dom.querySelector('[data-sec="24"]')?.textContent ?? "";
    expect(text).toContain("60.00٪");
    expect(text).toContain("1,514,000");
    expect(text).toContain("رُجّح السوق لتوفر مقارنات");
  });

  it("fills the final opinion banner and blanks liquidation when unused", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      record: poRecord() as never,
      recon: {
        weightedValue: 1_514_000,
        finalOpinionBeforeLiquidation: 1_514_000,
        finalOpinionValue: 1_514_000,
        liquidationDiscountApplied: false,
      } as never,
    });
    expect(fill.cells["القيمة المرجّحة"]).toBe("1,514,000");
    expect(fill.cells["قيمة العقار"]).toBe("1,514,000");
    expect(fill.cells["نسبة خصم التصفية المنظمة"]).toBe("—");
    expect(fill.finalDisplay).toContain("1,514,000");

    const liq = buildValuationReportLiveFill({
      draft,
      record: poRecord({ assignmentType: "تنفيذ" }) as never,
      recon: {
        weightedValue: 1_514_000,
        finalOpinionBeforeLiquidation: 1_514_000,
        finalOpinionValue: 1_211_200,
        liquidationDiscountApplied: true,
        liquidationDiscountPct: 20,
        liquidationDiscountRationale: "سيولة 90 يوم",
      } as never,
    });
    expect(liq.cells["نسبة خصم التصفية المنظمة"]).toBe("20٪");
    expect(liq.cells["مبرر معامل التصفية"]).toBe("سيولة 90 يوم");
    expect(liq.cells["قيمة العقار"]).toBe("1,211,200");

    const dom = new DOMParser().parseFromString(
      `<section data-sec="25">
        <table>
          <tr><td class="k">القيمة المرجّحة</td><td class="v num">9</td></tr>
          <tr><td class="k">نسبة خصم التصفية المنظمة</td><td class="v num">20٪</td>
              <td class="k">مبرر معامل التصفية</td><td class="v">عينة</td></tr>
          <tr><td class="k">قيمة العقار</td><td class="v num">9</td></tr>
        </table>
        <div style="background:#102b4e">
          <div><div>القيمة النهائية للعقار</div><div>9</div></div>
          <div>كلمات</div>
        </div>
      </section>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);
    expect(dom.querySelector('[data-sec="25"]')?.textContent).toContain("1,514,000");
    expect(
      [...dom.querySelectorAll('[data-sec="25"] td.k')]
        .find((td) => td.textContent?.includes("خصم"))
        ?.nextElementSibling?.textContent,
    ).toBe("—");
  });

  it("fills fixed roster participants plus assigned appraiser as fourth column", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      certifiedName: "عماد رشيد الرشيد",
      certifiedMembershipNumber: "1210000003",
      certifiedMembershipCategory: "fellow",
      certifiedTitle: "الرئيس التنفيذي",
      valuationBranch: "فرع العقار",
      assignedAppraiserName: "عبدالله الكثيري",
    });
    const dom = new DOMParser().parseFromString(
      `<section data-sec="26">
        <table class="ctr">
          <tr><td class="k">الاسم</td><td class="v">عينة1</td><td class="v">عينة2</td><td class="v">عينة3</td></tr>
          <tr><td class="k">المسمى الوظيفي</td><td class="v">x</td><td class="v">x</td><td class="v">x</td></tr>
          <tr><td class="k">فئة العضوية</td><td class="v">x</td><td class="v">x</td><td class="v">x</td></tr>
          <tr><td class="k">رقم العضوية</td><td class="num">x</td><td class="num">x</td><td class="num">x</td></tr>
          <tr><td class="k">فرع التقييم</td><td class="v">x</td><td class="v">x</td><td class="v">x</td></tr>
        </table>
        <h2>إعتماد تقرير التقييم</h2>
        <table>
          <tr><td class="k">الاسم</td><td class="v">عينة</td><td class="k">رقم العضوية</td><td class="v num">9</td></tr>
          <tr><td class="k">صفته</td><td class="v">x</td></tr>
        </table>
      </section>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill, {
      valuers: [
        {
          id: "v3",
          nameAr: "سليمان عبد الله الصالحي",
          membershipNumber: "1220000919",
          membershipCategory: "associate",
          membershipExpiresAt: "2026-12-31",
          role: "reviewer",
          isActive: true,
        },
        {
          id: "v4",
          nameAr: "سالم الغريب",
          membershipNumber: "1220000845",
          membershipCategory: "fellow",
          membershipExpiresAt: "2027-12-31",
          role: "reviewer",
          isActive: true,
        },
        {
          id: "v5",
          nameAr: "أيمن أحمد مجرشي",
          membershipNumber: "1210002040",
          membershipCategory: "associate",
          membershipExpiresAt: "2026-12-31",
          role: "assistant",
          isActive: true,
        },
        {
          id: "v2",
          nameAr: "عبدالله الكثيري",
          membershipNumber: "1220001583",
          membershipCategory: "associate",
          membershipExpiresAt: "2027-01-20",
          role: "valuer",
          isActive: true,
        },
      ],
      valuationBranch: "فرع العقار",
    });
    const names = [
      ...dom.querySelectorAll('[data-sec="26"] table.ctr tr')[0].querySelectorAll("td.v"),
    ].map((td) => td.textContent);
    expect(names).toEqual([
      "سليمان عبد الله الصالحي",
      "سالم الغريب",
      "أيمن أحمد مجرشي",
      "عبدالله الكثيري",
    ]);
    expect(dom.querySelector('[data-sec="26"] table.ctr')?.textContent).toContain(
      "1220001583",
    );
    expect(dom.querySelector('[data-sec="26"] table.ctr')?.textContent).toContain(
      "تاريخ انتهاء العضوية",
    );
    expect(dom.querySelector('[data-sec="26"] table.ctr')?.textContent).toContain(
      "2027/01/20",
    );
    const approve = [...dom.querySelectorAll('[data-sec="26"] h2')]
      .find((h) => h.textContent?.includes("إعتماد"))
      ?.nextElementSibling;
    expect(approve?.textContent).toContain("عماد رشيد الرشيد");
    expect(approve?.textContent).toContain("1210000003");
  });

  it("keeps only the three fixed participants when assignment is empty", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    draft.reportWorkers = [
      {
        id: "w1",
        role: "معد",
        name: "",
        licenseNumber: "",
        licenseDate: "",
        licenseFileName: null,
      },
    ];
    const fill = buildValuationReportLiveFill({
      draft,
      valuationBranch: "فرع العقار",
      assignedAppraiserName: "",
    });
    const dom = new DOMParser().parseFromString(
      `<section data-sec="26">
        <table class="ctr">
          <tr><td class="k">الاسم</td><td class="v">عبدالله الكثيري</td><td class="v">سليمان</td><td class="v">سالم</td></tr>
          <tr><td class="k">المسمى الوظيفي</td><td class="v">x</td><td class="v">x</td><td class="v">x</td></tr>
          <tr><td class="k">فئة العضوية</td><td class="v">x</td><td class="v">x</td><td class="v">x</td></tr>
          <tr><td class="k">رقم العضوية</td><td class="num">x</td><td class="num">x</td><td class="num">x</td></tr>
          <tr><td class="k">فرع التقييم</td><td class="v">x</td><td class="v">x</td><td class="v">x</td></tr>
          <tr><td class="k">التوقيع</td><td class="v"></td><td class="v"></td><td class="v"></td></tr>
        </table>
      </section>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill, {
      valuers: [
        {
          id: "v1",
          nameAr: "معتمد النظام",
          role: "certified",
          isActive: true,
          membershipNumber: "1",
        },
        {
          id: "v3",
          nameAr: "سليمان عبد الله الصالحي",
          role: "reviewer",
          isActive: true,
          membershipNumber: "200",
          membershipCategory: "fellow",
          membershipExpiresAt: "2026-12-31",
        },
        {
          id: "v4",
          nameAr: "سالم الغريب",
          role: "reviewer",
          isActive: true,
          membershipNumber: "300",
          membershipExpiresAt: "2027-06-15",
        },
        {
          id: "v5",
          nameAr: "أيمن أحمد مجرشي",
          role: "assistant",
          isActive: true,
          membershipNumber: "400",
          membershipExpiresAt: "2026-12-31",
        },
        {
          id: "v2",
          nameAr: "عبدالله الكثيري",
          role: "valuer",
          isActive: true,
          membershipNumber: "100",
          membershipCategory: "associate",
        },
      ],
      valuationBranch: "فرع العقار",
    });
    const names = [
      ...dom.querySelectorAll('[data-sec="26"] table.ctr tr')[0].querySelectorAll("td.v"),
    ].map((td) => td.textContent);
    expect(names).toEqual([
      "سليمان عبد الله الصالحي",
      "سالم الغريب",
      "أيمن أحمد مجرشي",
    ]);
    expect(dom.querySelector('[data-sec="26"] table.ctr')?.textContent).not.toContain(
      "عبدالله الكثيري",
    );
    expect(dom.querySelector('[data-sec="26"] table.ctr')?.textContent).not.toContain(
      "معتمد النظام",
    );
    expect(dom.querySelector('[data-sec="26"] table.ctr')?.textContent).toContain("400");
    expect(dom.querySelector('[data-sec="26"] table.ctr')?.textContent).toContain(
      "2027/06/15",
    );
    expect(dom.querySelector('[data-sec="26"] table.ctr')?.textContent).toContain(
      "2026/12/31",
    );
  });

  it("wires defects, deal type, and adjustment rows without sharing أخرى", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      inspector: {
        observations: [{ category: "عيب ظاهر", text: "تشقق" }],
        amenities: ["مساجد"],
        assetNotes: "ملاحظة أصل",
      } as never,
      market: {
        weightedPricePerSqm: 3800,
        subjectAreaSqm: 400,
        marketOpinionValue: 1_520_000,
        items: [
          {
            isAdopted: true,
            sortOrder: 1,
            comparable: {
              comparablePropertyType: "فيلا سكنية",
              transactionKind: "offer",
              transactionKindLabelAr: "عرض",
              priceDescriptionLabelAr: "حد",
              source: "listing_platform",
              listingNumber: "88231045",
              advertiserPhone: "0501234567",
              areaSqm: 420,
              transactionDate: "2026-04-12",
              price: 1_638_000,
              pricePerSqm: 3900,
              district: "الصوارى",
            },
            market: {
              sumDifferencePct: 2,
              pricePerSqmAfterSequential: 3783,
              pricePerSqmAfterDifference: 3858.66,
              effectiveWeightPct: 30,
              adjustmentLines: [
                {
                  factorKey: "financing",
                  labelAr: "تسوية شروط التمويل",
                  percent: 0,
                  rationale: "",
                  isIncluded: true,
                },
                {
                  factorKey: "market",
                  labelAr: "تسوية ظروف السوق",
                  percent: -3,
                  rationale: "الحد سقف أعلى من سعر الإتمام",
                  isIncluded: true,
                },
                {
                  factorKey: "area",
                  labelAr: "تسوية المساحة",
                  percent: 1,
                  rationale: "",
                  isIncluded: true,
                },
              ],
            },
          },
        ],
      } as never,
    });
    expect(fill.cells["أخرى"]).toBeUndefined();
    expect(fill.surroundingsOther).toBe("—");
    expect(fill.comparableRows[0]?.values[1]).toContain("عرض");
    expect(fill.comparableRows[0]?.values[1]).toContain("88231045");
    expect(fill.adjustmentNotes).toContain("الحد سقف أعلى");
    const marketRow = fill.adjustmentRows.find((r) => r.key === "تسوية ظروف السوق");
    expect(marketRow?.values[0]).toBe("-3.00٪");

    const dom = new DOMParser().parseFromString(
      `<section data-sec="11">
        <table><tr><td class="k">تشجير</td><td class="v">يوجد</td><td class="k">أخرى</td><td class="v">قديم</td></tr></table>
      </section>
      <section data-sec="13"><table><tr><td class="v">عينة</td></tr></table></section>
      <section data-sec="15">
        <table>
          <tr><td class="k">جامع</td><td class="v"></td></tr>
          <tr><td class="k">أخرى</td><td class="v" colspan="7">قديم</td></tr>
        </table>
      </section>
      <section data-sec="17">
        <table>
          <tr><th>#</th><th>العقار المقارن</th><th>نوع العملية</th><th>المساحة</th><th>تاريخ العملية</th><th>السعر</th><th>سعر المتر</th></tr>
          <tr><td class="num">1</td><td class="v">عينة</td><td class="v">عينة</td><td class="num">1</td><td class="num">1</td><td class="num">1</td><td class="num">1</td></tr>
        </table>
      </section>
      <section data-sec="19">
        <table>
          <tr><th>عناصر</th><th>1</th><th>2</th><th>3</th></tr>
          <tr><td class="v">تسوية ظروف السوق</td><td class="num">2.00٪</td><td class="num">x</td><td class="num">x</td></tr>
          <tr class="total"><td class="v">القيمة بطريقة المقارنة (3,825.00 × 400.00 م²)</td><td class="num" colspan="3">1</td></tr>
        </table>
        <table><tr><td class="k">مبررات التسويات</td><td class="v"><ul><li>قديم</li></ul></td></tr></table>
      </section>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);
    expect(dom.querySelector('[data-sec="13"] td.v')?.textContent).toContain("تشقق");
    expect(dom.querySelector('[data-sec="11"] td.k + td.v')?.textContent).not.toContain(
      "ملاحظة أصل",
    );
    const other11 = [...dom.querySelectorAll('[data-sec="11"] td.k')].find(
      (td) => td.textContent === "أخرى",
    )?.nextElementSibling;
    expect(other11?.textContent).toBe("—");
    expect(dom.querySelector('[data-sec="15"]')?.textContent).toContain("يوجد");
    const deal = [
      ...dom.querySelectorAll('[data-sec="17"] tr')[1].querySelectorAll("td"),
    ];
    expect(deal[1]?.textContent).toBe("فيلا سكنية");
    expect(deal[2]?.textContent).toContain("منصة عقارية");
    expect(dom.querySelector('[data-sec="19"]')?.textContent).toContain("-3.00٪");
    expect(dom.querySelector('[data-sec="19"]')?.textContent).toContain(
      "الحد سقف أعلى",
    );
    expect(dom.querySelector('[data-sec="19"]')?.textContent).toContain(
      "القيمة بطريقة المقارنة",
    );
  });
});

describe("report org texts and frozen template artifacts", () => {
  function domFor(html: string): Document {
    return new DOMParser().parseFromString(html, "text/html");
  }

  it("replaces sections 3/4/5/31/32 from org texts and fills §33 location", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    draft.appraisalDate = "2026-08-27";
    const fill = buildValuationReportLiveFill({
      draft,
      property: { city: "الجموم", district: "السنابل" } as never,
      keyInputsText: "مدخل أ\nمدخل ب",
      professionalStandardsText: "معايير سارية من {{ivsDate}}.",
      independenceText: "نص الاستقلالية من الإعدادات.",
      termsText: "بند شروط وحيد من الإعدادات.",
      restrictionsText: "بند قيود وحيد من الإعدادات.",
    });
    expect(fill.keyInputsBullets).toEqual(["مدخل أ", "مدخل ب"]);
    expect(fill.standardsParagraphs[0]).toContain("31 يناير 2025");
    expect(fill.reportDateSlash).toBe("2026/08/27");
    expect(fill.locationLabel).toBe("الجموم - السنابل");

    const dom = domFor(`
      <section class="sec" data-sec="3"><ul><li>نقطة عيّنة</li></ul></section>
      <section class="sec" data-sec="4"><p>نص عيّنة قديم</p></section>
      <section class="sec" data-sec="5"><p>نص عيّنة قديم</p></section>
      <section class="sec" data-sec="31"><ul><li>بند عيّنة بتاريخ (2026/06/03).</li></ul></section>
      <section class="sec" data-sec="32"><ul><li>بند عيّنة</li></ul></section>
      <section class="sec" data-sec="33"><table><tr><td class="k">الموقع</td><td class="v">جدة - الصوارى</td></tr></table></section>
    `);
    applyValuationReportLiveFill(dom, fill);
    expect(dom.querySelector('[data-sec="3"]')?.textContent).toContain("مدخل أ");
    expect(dom.querySelector('[data-sec="3"]')?.textContent).not.toContain("نقطة عيّنة");
    expect(dom.querySelector('[data-sec="4"]')?.textContent).toContain("31 يناير 2025");
    expect(dom.querySelector('[data-sec="5"]')?.textContent).toContain("الاستقلالية");
    expect(dom.querySelector('[data-sec="31"]')?.textContent).not.toContain("2026/06/03");
    expect(dom.querySelector('[data-sec="32"]')?.textContent).toContain("بند قيود وحيد");
    expect(dom.querySelector('[data-sec="33"]')?.textContent).toContain("الجموم - السنابل");
    expect(dom.querySelector('[data-sec="33"]')?.textContent).not.toContain("الصوارى");
  });

  it("scrubs the frozen 2026/06/03 date when org terms are empty", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    draft.appraisalDate = "2026-08-27";
    const fill = buildValuationReportLiveFill({ draft });
    const dom = domFor(
      `<section class="sec" data-sec="31"><ul><li>صالح لمدة (90) يومًا من تاريخ التقرير (2026/06/03).</li></ul></section>`,
    );
    applyValuationReportLiveFill(dom, fill);
    expect(dom.querySelector('[data-sec="31"]')?.textContent).toContain("2026/08/27");
    expect(dom.querySelector('[data-sec="31"]')?.textContent).not.toContain("2026/06/03");
  });
});
