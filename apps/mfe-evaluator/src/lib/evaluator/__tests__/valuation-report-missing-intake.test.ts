import { describe, expect, it } from "vitest";
import {
  markReportMissingIntakeFields,
  reportMissingIntakeLinksFromCells,
} from "../valuation-report-missing-intake";

describe("reportMissingIntakeLinksFromCells", () => {
  it("lists empty intake fields with jump targets", () => {
    const links = reportMissingIntakeLinksFromCells({
      "رقم الطلب": "—",
      "اسم المالك": "صالح",
      "تاريخ الطلب": "",
    });
    expect(links.map((l) => l.label)).toEqual(["رقم الطلب", "تاريخ الطلب"]);
    expect(links[0]?.targetId).toBe("rpt-field-request-number");
    expect(links[0]?.message).toContain("البيانات الأولية");
  });

  it("returns nothing when intake fields are filled", () => {
    expect(
      reportMissingIntakeLinksFromCells({
        "رقم الطلب": "REQ-1",
        "اسم المالك": "صالح",
        "تاريخ الطلب": "2026-01-01",
      }),
    ).toEqual([]);
  });
});

describe("markReportMissingIntakeFields", () => {
  it("marks empty value cells with id and data-rpt-missing", () => {
    const dom = new DOMParser().parseFromString(
      `<!DOCTYPE html><html><body>
        <table>
          <tr><td class="k">اسم المالك</td><td class="v">صالح</td>
              <td class="k">رقم الطلب</td><td class="v">—</td></tr>
        </table>
      </body></html>`,
      "text/html",
    );
    const links = markReportMissingIntakeFields(dom, {
      "رقم الطلب": "—",
      "اسم المالك": "صالح",
      "تاريخ الطلب": "2026-01-01",
    });
    const cell = dom.getElementById("rpt-field-request-number");
    expect(links).toHaveLength(1);
    expect(cell?.getAttribute("data-rpt-missing")).toBe("1");
    expect(cell?.textContent).toBe("—");
    expect(dom.querySelector('td.v:not([data-rpt-missing])')?.textContent).toBe(
      "صالح",
    );
  });
});
