import { describe, expect, it } from "vitest";
import {
  buildComparablesMapSvgDataUrl,
  collectComparablesMapPins,
} from "../valuation-report-comparables-map";
import {
  applyValuationReportLiveFill,
  buildValuationReportLiveFill,
} from "../valuation-report-live-fill";
import { createEvaluatorDraft } from "../evaluator-window-data";

describe("comparables map", () => {
  it("collects subject and adopted comparable pins", () => {
    const pins = collectComparablesMapPins({
      subjectLat: "21.8",
      subjectLng: "39.1",
      comps: [
        { latitude: 21.81, longitude: 39.11, label: "1" },
        { latitude: 0, longitude: 0, label: "skip" },
      ],
    });
    expect(pins).toHaveLength(2);
    expect(pins[0]?.kind).toBe("subject");
    expect(pins[1]?.label).toBe("1");
  });

  it("builds an svg data url when pins exist", () => {
    const url = buildComparablesMapSvgDataUrl([
      { lat: 21.8, lng: 39.1, label: "العقار", kind: "subject" },
      { lat: 21.81, lng: 39.12, label: "1", kind: "comp" },
    ]);
    expect(url).toMatch(/^data:image\/svg\+xml/);
    expect(decodeURIComponent(url!.slice(url!.indexOf(",") + 1))).toContain(
      "العقار محل التقييم",
    );
  });
});

describe("search notes and comparable map live fill", () => {
  const draft = () =>
    createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });

  it("fills §18 map and §28 notes + research bullets", () => {
    const d = draft();
    d.searchScopeNotes = "اعتمدنا على مكاتب الحي فقط";
    const fill = buildValuationReportLiveFill({
      draft: d,
      inspector: {
        mapLatitude: "21.800029",
        mapLongitude: "39.093016",
      } as never,
      market: {
        items: [
          {
            isAdopted: true,
            sortOrder: 1,
            comparable: {
              comparablePropertyType: "فيلا",
              latitude: 21.81,
              longitude: 39.1,
              areaSqm: 400,
              transactionDate: "2026-01-01",
              price: 1_000_000,
              pricePerSqm: 2500,
            },
          },
        ],
      } as never,
      researchScopeText: "مصدر أ\nمصدر ب",
    });

    expect(["image/svg+xml", "image/png"]).toContain(
      fill.comparableMapSlot?.contentType,
    );
    expect(fill.searchScopeNotes).toBe("اعتمدنا على مكاتب الحي فقط");
    expect(fill.researchScopeBullets).toEqual(["مصدر أ", "مصدر ب"]);

    const dom = new DOMParser().parseFromString(
      `<!DOCTYPE html><html><body>
        <section data-sec="18">
          <div id="map-comparables" class="image-ph">ph</div>
        </section>
        <section data-sec="28">
          <ul><li>قديم</li></ul>
        </section>
      </body></html>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);

    expect(dom.querySelector("#map-comparables")).toBeNull();
    const imgSrc = dom.querySelector('[data-sec="18"] img')?.getAttribute("src") ?? "";
    expect(
      imgSrc.startsWith("data:image/svg+xml") ||
        imgSrc.includes("maps.googleapis.com/maps/api/staticmap"),
    ).toBe(true);
    const lis = [...dom.querySelectorAll('[data-sec="28"] li')].map(
      (li) => li.textContent,
    );
    expect(lis).toEqual(["مصدر أ", "مصدر ب"]);
    expect(
      dom.querySelector(".search-scope-notes td.v")?.textContent,
    ).toBe("اعتمدنا على مكاتب الحي فقط");
  });

  it("prefers uploaded site map over generated svg", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      inspector: {
        mapLatitude: "21.8",
        mapLongitude: "39.1",
      } as never,
      siteMapSlot: {
        attachmentId: "site-1",
        url: "data:image/png;base64,xx",
        contentType: "image/png",
        fileName: "hybrid.png",
        labelAr: "خريطة الموقع",
        isImage: true,
      },
    });
    expect(fill.comparableMapSlot?.attachmentId).toBe("site-1");
    expect(fill.comparableMapSlot?.contentType).toBe("image/png");
  });

  it("highlights the selected finishing level column in §12", () => {
    const d = draft();
    d.reportChoices = {
      ...d.reportChoices!,
      finishingLevel: "medium",
    };
    const fill = buildValuationReportLiveFill({
      draft: d,
      finishingMediumText:
        "تشطيبات خارجية: نص متوسط\nتشطيبات داخلية: داخلي متوسط",
    });
    expect(fill.finishingLevel).toBe("medium");

    const dom = new DOMParser().parseFromString(
      `<!DOCTYPE html><html><body>
        <section data-sec="12">
          <table class="mx">
            <tr><th>تشطيب فاخر</th><th>تشطيب متوسط</th><th>تشطيب عادي</th></tr>
            <tr><td class="v">فاخر</td><td class="v">متوسط</td><td class="v">عادي</td></tr>
            <tr><th colspan="3">بدون تشطيب</th></tr>
          </table>
        </section>
      </body></html>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);

    const headers = [
      ...dom.querySelectorAll("[data-sec=\"12\"] tr:first-child th"),
    ];
    expect((headers[0] as HTMLElement)?.style.display).toBe("none");
    expect((headers[2] as HTMLElement)?.style.display).toBe("none");
    expect((headers[1] as HTMLElement)?.style.display).not.toBe("none");
    expect(headers[1]?.textContent).not.toContain("✓");
    const midCell = dom.querySelectorAll(
      "[data-sec=\"12\"] tr:nth-child(2) td",
    )[1];
    expect((midCell as HTMLElement)?.style.display).not.toBe("none");
    expect(midCell?.innerHTML).toContain("تشطيبات خارجية");
  });

  it("shows only بدون تشطيب when finishingLevel is none", () => {
    const d = draft();
    d.reportChoices = { ...d.reportChoices!, finishingLevel: "none" };
    const fill = buildValuationReportLiveFill({ draft: d });
    const dom = new DOMParser().parseFromString(
      `<!DOCTYPE html><html><body>
        <section data-sec="12">
          <table>
            <tr><th>تشطيب فاخر</th><th>تشطيب متوسط</th><th>تشطيب عادي</th></tr>
            <tr><td>a</td><td>b</td><td>c</td></tr>
            <tr><th colspan="3">بدون تشطيب</th></tr>
          </table>
        </section>
      </body></html>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);
    const none = [...dom.querySelectorAll("[data-sec=\"12\"] th")].find((th) =>
      (th.textContent ?? "").includes("بدون"),
    );
    expect(none?.textContent).not.toContain("✓");
    const headerRow = dom.querySelector("[data-sec=\"12\"] tr:first-child");
    expect((headerRow as HTMLElement)?.style.display).toBe("none");
  });
});
