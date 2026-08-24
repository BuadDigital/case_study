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

  it("ignores stale list labels and empty PO so it never falls back to liquidation", () => {
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
      basisLabel: "قيمة التصفية",
      purposeLabel: "البيع بالمزاد العلني لغرض التصفية",
    });
    expect(fill.cells["أساس القيمة"]).toBe("القيمة السوقية");
    expect(fill.cells["الغرض من التقييم"]).toBe("البيع");
    expect(fill.basisDefinition).not.toMatch(/قيمة التصفية/);
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
        <table><tr><td class="v">فيلا سكنية</td><td class="num">1,444,000.00</td></tr></table>
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
    expect(dom.querySelector('[data-sec="17"] td.v')?.textContent).toBe("—");
    expect(dom.querySelector('[data-sec="17"] td.num')?.textContent).toBe("—");
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
    expect(fill.cells["مصعد"]).toBe("نعم");
    expect(fill.cells["جامع"]).toBe("يوجد");
    expect(fill.cells["مرفق تعليمي"]).toBe("يوجد");
    expect(fill.cells["وصف العيوب الإنشائية"]).toContain("تشقق");
    expect(fill.areaRows[0]?.values[0]).toBe("180");
    expect(fill.serviceRows[0]?.values[0]).toBe("متوفر");
    expect(fill.serviceRows[0]?.values[1]).toBe("2");
  });
});
