import { describe, expect, it } from "vitest";
import { reportPhotoLimit } from "@platform/app-shared/app-data/property-detail-document-types";
import { applyValuationReportLiveFill, buildValuationReportLiveFill } from "../valuation-report-live-fill";
import { createEvaluatorDraft } from "../evaluator-window-data";
import type { ValuationReportSlotAttachment } from "../valuation-report-print-attachments";

const photo = (n: number): ValuationReportSlotAttachment => ({
  attachmentId: `a${n}`,
  url: `data:image/png;base64,${n}`,
  contentType: "image/png",
  fileName: `p${n}.png`,
  labelAr: `صورة ${n}`,
  isImage: true,
});

describe("how many photos the report prints («صفحات الصور»)", () => {
  it("is six to a page, land pages for land and building pages for the rest", () => {
    const pages = { photoPagesLand: 2, photoPagesBuilt: 4 };
    expect(reportPhotoLimit(pages, true)).toBe(12);
    expect(reportPhotoLimit(pages, false)).toBe(24);
  });

  it("takes the seeded pages until the settings load", () => {
    expect(reportPhotoLimit(null, true)).toBe(24);
    expect(reportPhotoLimit(undefined, false)).toBe(24);
  });
});

describe("the report's photo section", () => {
  const template = () =>
    new DOMParser().parseFromString(
      `<!DOCTYPE html><html><body><section data-sec="34"><div>${Array.from(
        { length: 12 },
        (_, i) => `<div id="photo-${i + 1}" class="image-ph">ph</div>`,
      ).join("")}</div></section></body></html>`,
      "text/html",
    );

  it("prints all twenty-four photos of a four-page building report", () => {
    const dom = template();
    const fill = buildValuationReportLiveFill({
      draft: createEvaluatorDraft({ taskId: "t1", propertyId: "p1", poNumber: "PO-1" }),
      photoSlots: Array.from({ length: 24 }, (_, i) => photo(i + 1)),
    });

    applyValuationReportLiveFill(dom, fill);

    const printed = [...dom.querySelectorAll('[data-sec="34"] img')].map((img) => img.getAttribute("src"));
    expect(printed).toHaveLength(24);
    expect(printed[23]).toBe("data:image/png;base64,24");
  });

  it("writes each photo's section under it", () => {
    const dom = template();
    const fill = buildValuationReportLiveFill({
      draft: createEvaluatorDraft({ taskId: "t1", propertyId: "p1", poNumber: "PO-1" }),
      photoSlots: [{ ...photo(1), sectionAr: "صور خارجية" }, photo(2)],
    });

    applyValuationReportLiveFill(dom, fill);

    const captions = [...dom.querySelectorAll("[data-photo-caption]")].map((cap) => cap.textContent);
    expect(captions).toEqual(["صور خارجية"]);
    expect(dom.querySelectorAll('[data-sec="34"] img')).toHaveLength(2);
  });

  it("leaves no empty slot when fewer photos print", () => {
    const dom = template();
    const fill = buildValuationReportLiveFill({
      draft: createEvaluatorDraft({ taskId: "t1", propertyId: "p1", poNumber: "PO-1" }),
      photoSlots: [photo(1), photo(2)],
    });

    applyValuationReportLiveFill(dom, fill);

    expect(dom.querySelectorAll('[data-sec="34"] img')).toHaveLength(2);
    expect(dom.querySelector('[id^="photo-"]')).toBeNull();
  });
});
