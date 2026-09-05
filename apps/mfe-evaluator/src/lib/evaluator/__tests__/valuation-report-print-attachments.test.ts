import { describe, expect, it } from "vitest";
import {
  attachmentTypeKeyFromScope,
  collectInspectorPhotoAttachmentIds,
  pairsFromOrgLines,
  photoBudget,
  propertyAttachmentScopeKey,
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

  it("builds the for-property needle as the property library's compound key", () => {
    // `assignment-doc-attachments.ts` keys property documents `<po>:<propertyId>`.
    expect(propertyAttachmentScopeKey("PO-2026-001", "prop-1")).toBe(
      "PO-2026-001:prop-1",
    );
    expect(propertyAttachmentScopeKey("  PO-2026-001 ", " prop-1 ")).toBe(
      "PO-2026-001:prop-1",
    );
    // No PO number — the bare id is the only needle available.
    expect(propertyAttachmentScopeKey("", "prop-1")).toBe("prop-1");
    expect(propertyAttachmentScopeKey(null, "prop-1")).toBe("prop-1");
    expect(propertyAttachmentScopeKey(undefined, "prop-1")).toBe("prop-1");
    // No property — nothing to ask for.
    expect(propertyAttachmentScopeKey("PO-2026-001", "  ")).toBe("");
  });

  it("uses 12 photos for buildings and 6 for land", () => {
    expect(photoBudget(true)).toBe(12);
    expect(photoBudget(false)).toBe(6);
  });

  it("collects task-scoped inspector photo ids for the §34 budget", () => {
    expect(collectInspectorPhotoAttachmentIds(null)).toEqual([]);

    const ids = collectInspectorPhotoAttachmentIds({
      featurePhotoAttachments: {
        kitchen: { fileName: "k.jpg", mimeType: "image/jpeg", attachmentId: "f-kitchen" },
        facade: { fileName: "f.jpg", mimeType: "image/jpeg", attachmentId: "f-facade" },
      },
      definedPhotos: {
        "service:كهرباء": {
          none: false,
          photos: [
            { id: 1, approved: true, fileName: "e.jpg", mimeType: "image/jpeg", attachmentId: "slot-elec" },
            { id: 2, approved: false, fileName: "x.jpg", mimeType: "image/jpeg", attachmentId: "slot-rejected" },
          ],
        },
        "amenity:مساجد": { none: true, photos: [
          { id: 1, approved: true, fileName: "m.jpg", mimeType: "image/jpeg", attachmentId: "slot-none" },
        ] },
      },
      freePhotos: [
        { id: 3, category: null, approved: true, fileName: "free.png", mimeType: "image/png", attachmentId: "free-1" },
        // Duplicate — must not appear twice in the output
        { id: 4, category: null, approved: true, fileName: "f.jpg", mimeType: "image/jpeg", attachmentId: "f-facade" },
      ],
      observations: [
        { id: "o1", category: "عيوب", text: "تشقق", photo: { fileName: "obs.jpg", mimeType: "image/jpeg", attachmentId: "obs-1" } },
      ],
    } as never);

    // Facade first (feature order), then other features, then approved slots, then free, then notes.
    expect(ids).toEqual(["f-facade", "f-kitchen", "slot-elec", "free-1", "obs-1"]);
    expect(ids).not.toContain("slot-rejected");
    expect(ids).not.toContain("slot-none");
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
    const photoFig = dom.querySelector("figure.attach-fig");
    const photoImg = dom.querySelector('img[alt="صور العقار — 2026/06/02"]');
    expect(photoImg).toBeTruthy();
    // Caption must sit outside the image height box (not clipped under the next grid row).
    expect(photoFig?.getAttribute("style") ?? "").not.toMatch(/height\s*:\s*100px/i);
    expect(photoImg?.getAttribute("style") ?? "").toMatch(/height\s*:\s*100px/i);
    expect(photoFig?.querySelector("figcaption")?.textContent).toContain("صور العقار");
    expect(dom.querySelector("#photo-2")?.textContent).toBe("—");
    expect(dom.querySelector("iframe.attach-pdf")).toBeNull();
    expect(dom.querySelector(".attach-pdf-note")?.textContent).toContain(
      "survey.pdf",
    );
    expect(dom.querySelector(".attach-pdf-note")?.textContent).toContain(
      "لا يُضمَّن داخل الطباعة",
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
