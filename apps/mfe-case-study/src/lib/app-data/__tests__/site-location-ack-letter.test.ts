import { describe, expect, it } from "vitest";
import { createInspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import { emptyProperty } from "../po-intake-property-model";
import {
  buildSiteLocationAckLetter,
  canPrintSiteLocationAck,
} from "../site-location-ack-letter";
import { siteLocationAckLetterHtml } from "../site-location-ack-letter-html";

describe("site location ack letter", () => {
  it("blocks print on draft until the map is pinned", () => {
    expect(
      canPrintSiteLocationAck({
        mapPinned: false,
        mapLatitude: "21.5",
        mapLongitude: "39.2",
        status: "draft",
      }),
    ).toBe(false);
    expect(canPrintSiteLocationAck({ mapPinned: true, status: "draft" })).toBe(
      true,
    );
  });

  it("allows print on submitted packages with placed GPS even without mapPinned", () => {
    expect(
      canPrintSiteLocationAck({
        mapPinned: false,
        mapLatitude: "21.5",
        mapLongitude: "39.2",
        status: "submitted",
      }),
    ).toBe(true);
    expect(
      canPrintSiteLocationAck({
        mapPinned: false,
        mapLatitude: "0",
        mapLongitude: "0",
        status: "submitted",
      }),
    ).toBe(false);
  });

  it("fills the letter from draft + property", () => {
    const draft = createInspectorWorkspaceDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
      propertyDisplayId: "1",
    });
    draft.mapLatitude = "21.5433";
    draft.mapLongitude = "39.1728";
    draft.accessContactName = "أحمد";
    draft.accessContactPhone = "0500000000";
    draft.accessContactRole = "ضابط اتصال";
    draft.accessContactNationalId = "1098765432";
    draft.inspectionDate = "2026-09-13";

    const property = emptyProperty();
    property.deedNumber = "123456";
    property.requestNumber = "REQ-9";
    property.city = "جدة";
    property.district = "الشاطئ";
    property.planNumber = "250";
    property.plotNumber = "44";

    const letter = buildSiteLocationAckLetter(draft, property);
    expect(letter.deedNumber).toBe("123456");
    expect(letter.contactName).toBe("أحمد");
    expect(letter.civilId).toBe("1098765432");
    expect(letter.capacity).toBe("ضابط اتصال");
    expect(letter.north).toBe("21.5433");
    expect(letter.east).toBe("39.1728");
    expect(letter.coords).toBe("21.5433, 39.1728");
    expect(letter.city).toBe("جدة");
    expect(letter.dateGreg).toContain("2026");
  });

  it("renders branded HTML with acknowledgment copy", () => {
    const html = siteLocationAckLetterHtml({
      deedNumber: "123",
      dateHijri: "1/1/1447 هـ",
      dateGreg: "2026/9/13 م",
      contactName: "أحمد",
      civilId: "1098765432",
      contactPhone: "0500000000",
      capacity: "ضابط اتصال",
      requestNumber: "REQ-1",
      city: "جدة",
      district: "الشاطئ",
      planNumber: "250",
      plotNumber: "44",
      north: "21.5",
      east: "39.1",
      coords: "21.5, 39.1",
    });
    expect(html).toContain("إقرار صحة الموقع");
    expect(html).toContain("سجل مدني رقم");
    expect(html).toContain("1098765432");
    expect(html).toContain("ref-meta");
    expect(html).toContain("letter-body");
    expect(html).toContain("prop-table");
    expect(html).toContain("sign-block");
    expect(html).toContain("شماليات 21.5");
    expect(html).toContain("شرقيات 39.1");
    expect(html).toContain("background-image");
    expect(html).toContain("window.print()");
    expect(html).not.toContain('<table class="facts-table"');
    expect(html).not.toContain("lh-slice");

    // Empty client signature box sits between the signature and the company stamp.
    const at = (needle: string) => html.indexOf(needle, html.indexOf('class="sign-block"'));
    expect(at("توقيع العميل")).toBeGreaterThan(at(">التوقيع<"));
    expect(at("توقيع العميل")).toBeLessThan(at(">ختم الشركة<"));
    expect(html).toContain('<div class="client-signature-slot"></div>');
  });
});
