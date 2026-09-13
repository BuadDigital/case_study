import { describe, expect, it } from "vitest";
import { createInspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import { emptyProperty } from "../po-intake-property-model";
import {
  buildSiteLocationAckLetter,
  canPrintSiteLocationAck,
} from "../site-location-ack-letter";
import { siteLocationAckLetterHtml } from "../site-location-ack-letter-html";

describe("site location ack letter", () => {
  it("blocks print until the map is pinned", () => {
    expect(canPrintSiteLocationAck(false)).toBe(false);
    expect(canPrintSiteLocationAck(true)).toBe(true);
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
      civilId: "—",
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
    expect(html).toContain("خطاب إقرار صحة الموقع");
    expect(html).toContain("إقرار بتحمل المسؤولية");
    expect(html).toContain("شماليات 21.5");
    expect(html).toContain("شرقيات 39.1");
    expect(html).toContain("lh-slice");
    expect(html).toContain("lh-head");
    expect(html).toContain("window.print()");
  });
});
