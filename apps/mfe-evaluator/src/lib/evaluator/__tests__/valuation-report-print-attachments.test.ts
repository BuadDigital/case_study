import { describe, expect, it } from "vitest";
import {
  attachmentTypeKeyFromScope,
  pairsFromOrgLines,
  photoBudget,
} from "../valuation-report-print-attachments";
import {
  applyValuationReportLiveFill,
  buildValuationReportLiveFill,
} from "../valuation-report-live-fill";
import { createEvaluatorDraft } from "../evaluator-window-data";

describe("valuation-report-print-attachments", () => {
  it("maps scopes like AttachmentPrintRules", () => {
    expect(attachmentTypeKeyFromScope("field-inspection-photo")).toBe("photo");
    expect(attachmentTypeKeyFromScope("engineering-survey-report")).toBe(
      "survey",
    );
    expect(attachmentTypeKeyFromScope("property-deed-ownership")).toBe("deed");
    expect(attachmentTypeKeyFromScope("engineering-site-letter")).toBe(
      "site-map",
    );
    expect(attachmentTypeKeyFromScope("other")).toBeNull();
  });

  it("uses 12 photos for buildings and 6 for land", () => {
    expect(photoBudget(true)).toBe(12);
    expect(photoBudget(false)).toBe(6);
  });

  it("parses org glossary / IVS lines as term: text pairs", () => {
    expect(
      pairsFromOrgLines("المعيار 100: إطار التقييم\nالمقيم: شخص مرخص"),
    ).toEqual([
      { term: "المعيار 100", text: "إطار التقييم" },
      { term: "المقيم", text: "شخص مرخص" },
    ]);
  });
});

describe("valuation report live fill attachments and glossary", () => {
  const draft = () =>
    createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });

  it("fills photo / survey / deed slots and rebuilds IVS + glossary tables", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      photoSlots: [
        {
          attachmentId: "a1",
          url: "data:image/png;base64,aaa",
          contentType: "image/png",
          fileName: "front.png",
          labelAr: "صور العقار — 2026/06/02",
          isImage: true,
        },
      ],
      surveySlot: {
        attachmentId: "s1",
        url: "data:application/pdf;base64,bbb",
        contentType: "application/pdf",
        fileName: "survey.pdf",
        labelAr: "الرفع المساحي",
        isImage: false,
      },
      deedSlot: {
        attachmentId: "d1",
        url: "data:image/jpeg;base64,ccc",
        contentType: "image/jpeg",
        fileName: "deed.jpg",
        labelAr: "الصك",
        isImage: true,
      },
      ivsStandardsText: "المعيار 100 – إطار التقييم: نص مخصص من الإعدادات",
      glossaryText:
        "المنشأة: تعريف مخصص\nالمقيم: تعريف ثانٍ\nالعضو: تعريف ثالث",
    });

    expect(fill.photoSlots).toHaveLength(1);
    expect(fill.surveySlot?.fileName).toBe("survey.pdf");
    expect(fill.deedSlot?.isImage).toBe(true);
    expect(fill.ivsPairs).toEqual([
      { term: "المعيار 100 – إطار التقييم", text: "نص مخصص من الإعدادات" },
    ]);
    expect(fill.glossaryPairs).toHaveLength(3);

    const dom = new DOMParser().parseFromString(
      `<!DOCTYPE html><html><body>
        <section data-sec="34">
          <div id="photo-1" class="image-ph" style="height:100px">ph</div>
          <div id="photo-2" class="image-ph">ph</div>
        </section>
        <section data-sec="35">
          <div id="survey-report" class="image-ph">survey ph</div>
        </section>
        <section data-sec="36">
          <div id="deed" class="image-ph">deed ph</div>
        </section>
        <section data-sec="37">
          <table class="def"><tr><td class="k">قديم</td><td>نص</td></tr></table>
        </section>
        <section data-sec="38">
          <table class="tight"><tr><td class="k">قديم</td><td>نص</td></tr></table>
        </section>
        <section data-sec="38ب">
          <table class="tight"><tr><td class="k">قديم</td><td>نص</td></tr></table>
        </section>
      </body></html>`,
      "text/html",
    );

    applyValuationReportLiveFill(dom, fill);

    expect(dom.querySelector("#photo-1")).toBeNull();
    expect(dom.querySelector('img[alt="صور العقار — 2026/06/02"]')).toBeTruthy();
    expect(dom.querySelector("#photo-2")?.textContent).toBe("—");
    expect(dom.querySelector("iframe.attach-pdf")?.getAttribute("src")).toContain(
      "data:application/pdf",
    );
    expect(dom.querySelector('[data-sec="36"] img')).toBeTruthy();
    expect(dom.querySelector('[data-sec="37"] td.k')?.textContent).toBe(
      "المعيار 100 – إطار التقييم",
    );
    const glossTerms = [...dom.querySelectorAll('[data-sec="38"] td.k')].map(
      (td) => td.textContent,
    );
    const glossB = [...dom.querySelectorAll('[data-sec="38ب"] td.k')].map(
      (td) => td.textContent,
    );
    expect([...glossTerms, ...glossB].join("|")).toContain("المنشأة");
    expect([...glossTerms, ...glossB].join("|")).toContain("العضو");
  });

  it("keeps IVS template when org text is empty", () => {
    const fill = buildValuationReportLiveFill({ draft: draft() });
    expect(fill.ivsPairs).toEqual([]);
    expect(fill.glossaryPairs).toEqual([]);

    const dom = new DOMParser().parseFromString(
      `<!DOCTYPE html><html><body>
        <section data-sec="37">
          <table><tr><td class="k">المعيار 100</td><td>قالب</td></tr></table>
        </section>
      </body></html>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);
    expect(dom.querySelector('[data-sec="37"] td.k')?.textContent).toBe(
      "المعيار 100",
    );
    expect(dom.querySelector('[data-sec="37"] td:last-child')?.textContent).toBe(
      "قالب",
    );
  });
});
