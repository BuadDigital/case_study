import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createEvaluatorDraft } from "../evaluator-window-data";
import {
  buildValuationReportLiveFill,
  type ValuationReportLiveFill,
} from "../valuation-report-live-fill";
import {
  cellsForMissingKey,
  markReportMissingFields,
  missingCellKey,
  readMissingCell,
} from "../valuation-report-missing-fields";
import { prepareValuationReportV3Html } from "../valuation-report-v3-preview";

const draft = () =>
  createEvaluatorDraft({ taskId: "t1", propertyId: "p1", poNumber: "PO-1" });

function doc(body: string): Document {
  return new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${body}</body></html>`,
    "text/html",
  );
}

function missing(dom: ParentNode) {
  return [...dom.querySelectorAll("[data-rpt-missing]")].map((el) => ({
    label: el.getAttribute("data-rpt-missing-label"),
    source: el.getAttribute("data-rpt-missing-source"),
  }));
}

function fillWith(over: Partial<ValuationReportLiveFill> = {}): ValuationReportLiveFill {
  return { ...buildValuationReportLiveFill({ draft: draft() }), ...over };
}

describe("markReportMissingFields — keyed cells", () => {
  it("marks empty sourced cells by who supplies them and leaves filled cells alone", () => {
    const dom = doc(`
      <section data-sec="2"><table>
        <tr><td class="k">اسم المالك</td><td class="v">صالح</td><td class="k">رقم الطلب</td><td class="v num">—</td></tr>
        <tr><td class="k">تاريخ المعاينة</td><td class="v num">—</td><td class="k">تاريخ التقييم</td><td class="v num"></td></tr>
      </table></section>
      <section data-sec="7"><table>
        <tr><td class="k">اسم المالك</td><td class="v">—</td><td class="k">حقل غير معروف</td><td class="v">—</td></tr>
      </table></section>`);

    const fields = markReportMissingFields(dom, fillWith());

    expect(missing(dom)).toEqual([
      { label: "رقم الطلب", source: "intake" },
      { label: "تاريخ المعاينة", source: "inspector" },
      { label: "تاريخ التقييم", source: "appraiser" },
      { label: "اسم المالك", source: "intake" },
    ]);
    expect(dom.querySelector("td.v:not([data-rpt-missing])")?.textContent).toBe("صالح");
    expect(dom.getElementById(fields[0]!.targetId)?.getAttribute("title")).toBe(
      "ناقص — اضغط لإشعار المسؤول (البيانات الأولية)",
    );
    const valuationDate = fields.find((f) => f.label === "تاريخ التقييم");
    expect(valuationDate?.tab).toBe("basic");
    expect(dom.getElementById(valuationDate!.targetId)?.getAttribute("title")).toBe(
      "ناقص — اضغط للانتقال إلى «البيانات الأساسية»",
    );
  });

  it("counts a label printed in two sections once and finds every copy for the notified mark", () => {
    const dom = doc(`
      <section data-sec="2"><table><tr><td class="k">اسم المالك</td><td class="v">—</td></tr></table></section>
      <section data-sec="7"><table><tr><td class="k">اسم المالك</td><td class="v">—</td></tr></table></section>`);
    const [owner] = markReportMissingFields(dom, fillWith());
    expect(owner).toMatchObject({ label: "اسم المالك", count: 2 });
    expect(dom.getElementById(owner!.targetId)?.closest("[data-sec]")?.getAttribute("data-sec")).toBe("2");
    expect(cellsForMissingKey(dom, missingCellKey(owner!))).toHaveLength(2);
  });

  it("tags organization gaps with the settings section that holds them", () => {
    const dom = doc(`
      <section data-sec="1"><table>
        <tr><td class="k">رقم ترخيص مزاولة المهنة</td><td class="v num">—</td><td class="k">فرع التقييم</td><td class="v">—</td></tr>
      </table></section>`);
    const fields = markReportMissingFields(dom, fillWith());
    expect(fields.map((f) => [f.source, f.section])).toEqual([
      ["org", "company"],
      ["org", "report"],
    ]);
  });

  it("marks the liquidation discount only when it is printed", () => {
    const html = `<section data-sec="25"><table>
      <tr><td class="k">نسبة خصم التصفية المنظمة</td><td class="v num">—</td><td class="k">مبرر معامل التصفية</td><td class="v">—</td></tr>
    </table></section>`;
    const off = doc(html);
    markReportMissingFields(off, fillWith({ isLiquidation: false, liquidationDiscountOn: false }));
    expect(missing(off)).toEqual([]);

    const on = doc(html);
    markReportMissingFields(on, fillWith({ liquidationDiscountOn: true }));
    expect(missing(on).map((m) => m.label)).toEqual([
      "نسبة خصم التصفية المنظمة",
      "مبرر معامل التصفية",
    ]);
  });
});

describe("markReportMissingFields — tables", () => {
  const boundaries = `
    <section data-sec="8"><table>
      <tr><th>الجهة</th><th>الحد</th><th>طول الضلع</th><th>الواجهات</th></tr>
      <tr><td class="v">الشمالية</td><td class="v">شارع</td><td class="num">—</td><td class="v"></td></tr>
    </table></section>`;

  it("marks meters only for services on site and boundaries with their side", () => {
    const dom = doc(`${boundaries}
      <section data-sec="14"><table>
        <tr><th>الخدمة</th><th>التوفر</th><th>عدد العدادات</th><th>أرقام العدادات</th></tr>
        <tr><td class="k">كهرباء</td><td class="v">متوفر</td><td class="num">—</td><td class="num">123</td></tr>
        <tr><td class="k">ماء</td><td class="v">غير متوفر</td><td class="num">—</td><td class="num">—</td></tr>
        <tr><td class="k">صرف صحي</td><td class="v" colspan="3">متوفر</td></tr>
      </table></section>`);
    markReportMissingFields(dom, fillWith({ boundariesSource: "intake" }));
    // Facades are not marked: sides next to a neighbour have none.
    expect(missing(dom)).toEqual([
      { label: "طول الضلع (الجهة الشمالية)", source: "intake" },
      { label: "عدد العدادات (كهرباء)", source: "inspector" },
    ]);
  });

  it("sends boundary gaps to the engineering office when a survey exists", () => {
    const dom = doc(boundaries);
    markReportMissingFields(dom, fillWith({ boundariesSource: "survey" }));
    expect(missing(dom)).toEqual([{ label: "طول الضلع (الجهة الشمالية)", source: "survey" }]);
  });

  it("marks comparable and adjustment gaps but not factors that were not applied", () => {
    const dom = doc(`
      <section data-sec="17"><table>
        <tr><th>#</th><th>العقار المقارن</th><th>تاريخ العملية</th></tr>
        <tr><td class="num">1</td><td class="v">فيلا</td><td class="num">—</td></tr>
      </table></section>
      <section data-sec="19"><table class="mx">
        <tr><th>عناصر المقارنة</th><th>العقار المقارن (1)</th></tr>
        <tr><td class="v">قيمة العقارات المقارنة</td><td class="num">—</td></tr>
        <tr><td class="v">تسوية عامل الوقت</td><td class="num">—</td></tr>
        <tr><td class="v">تسوية ظروف السوق</td><td class="num">—</td></tr>
        <tr class="total"><td class="v">القيمة بطريقة المقارنة</td><td class="num" colspan="1">—</td></tr>
      </table></section>`);
    const fields = markReportMissingFields(
      dom,
      fillWith({
        methodRow: ["طريقة المقارنة", "غير مستخدم", "غير مستخدم"],
        comparableRows: [{ key: "1", values: ["فيلا", "—"] }],
      }),
    );
    expect(fields.map((f) => [f.label, f.tab])).toEqual([
      ["تاريخ العملية (المقارن 1)", "market"],
      ["قيمة العقارات المقارنة (المقارن 1)", "market"],
      ["القيمة بطريقة المقارنة", "market"],
    ]);
  });

  it("names the participant whose roster data is missing and lists the branch once", () => {
    const dom = doc(`
      <section data-sec="26">
        <table class="ctr">
          <tr><td class="k">الاسم</td><td class="v">سالم</td><td class="v">أيمن</td></tr>
          <tr><td class="k">رقم العضوية</td><td class="num">77</td><td class="num">—</td></tr>
          <tr><td class="k">فرع التقييم</td><td class="v">—</td><td class="v">—</td></tr>
          <tr><td class="k">التوقيع</td><td class="v"></td><td class="v"></td></tr>
        </table>
        <h2>إعتماد تقرير التقييم</h2>
        <table><tr><td class="k">الاسم</td><td class="v">—</td><td class="k">ختم المنشأة</td><td class="v"></td></tr></table>
      </section>`);
    const fields = markReportMissingFields(dom, fillWith());
    expect(fields.map((f) => [f.label, f.count, f.section])).toEqual([
      ["رقم العضوية (أيمن)", 1, "evaluator"],
      ["فرع التقييم", 2, "report"],
      ["الاسم", 1, "evaluator"],
    ]);
  });
});

describe("clicking a marked cell", () => {
  it("reads the gap from the cell or any element inside it", () => {
    const dom = doc(`
      <section data-sec="30"><table>
        <tr><td class="k">التأثيرات البيئية</td><td class="v"><span>—</span></td></tr>
        <tr><td class="k">غير معروف</td><td class="v">—</td></tr>
      </table></section>`);
    markReportMissingFields(dom, fillWith());
    const inner = dom.querySelector("[data-rpt-missing] span");
    expect(readMissingCell(inner)?.cell).toEqual({
      label: "التأثيرات البيئية",
      source: "appraiser",
      tab: "review",
      section: undefined,
    });
    expect(readMissingCell(dom.querySelectorAll("td.v")[1] ?? null)).toBeNull();
  });
});

describe("real template", () => {
  it("marks the empty report without touching template text or removed sections", () => {
    const raw = fs.readFileSync(
      path.resolve(process.cwd(), "apps/shell/public/ejadah/valuation-report-v3.html"),
      "utf8",
    );
    const live = buildValuationReportLiveFill({
      draft: draft(),
      property: {
        classification: "أرض",
        propertyType: "أرض سكنية",
        city: "",
        deedNumber: "",
      } as never,
    });
    const html = prepareValuationReportV3Html(raw, { live }, "screen");
    const dom = new DOMParser().parseFromString(html, "text/html");
    const marked = [...dom.querySelectorAll("[data-rpt-missing]")];

    expect(marked.length).toBeGreaterThan(20);
    for (const cell of marked) {
      expect(["", "—", "-"]).toContain((cell.textContent ?? "").trim());
      const sec = cell.closest("[data-sec]")?.getAttribute("data-sec") ?? "";
      expect(["3", "4", "5", "12", "16", "28", "29", "31", "32", "37", "38", "38ب"]).not.toContain(sec);
      if (cell.getAttribute("data-rpt-missing-source") === "appraiser") {
        expect(cell.getAttribute("data-rpt-missing-tab")).toBeTruthy();
      }
    }
    const labels = new Set(marked.map((c) => c.getAttribute("data-rpt-missing-label")));
    expect(labels.has("رقم الطلب")).toBe(true);
    // Land: building rows are removed from the report, so they are never marked.
    expect(labels.has("عمر البناء")).toBe(false);
    expect(labels.has("سور")).toBe(false);
    expect(new Set(marked.map((c) => c.id)).size).toBe(marked.length);

    // Read-only embed (property page): same report, no red marks.
    const embed = prepareValuationReportV3Html(raw, { live, markMissingFields: false }, "screen");
    expect(embed).not.toContain('data-rpt-missing="1"');
    expect(embed).toContain("تقرير تقييم عقار");
  });
});
