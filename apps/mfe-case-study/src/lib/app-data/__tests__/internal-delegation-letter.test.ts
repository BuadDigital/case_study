import { describe, expect, it } from "vitest";
import { BRAND_IDENTITY_DEFAULTS } from "@platform/api-client";
import { internalDelegationLetterHtml } from "../internal-delegation-letter-html";
import {
  orgLetterheadLayout,
  orgLetterheadUrl,
} from "../org-letterhead-slices";

describe("org letterhead slices", () => {
  it("uses branding margins and image", () => {
    const layout = orgLetterheadLayout({
      letterheadHeadMm: 40,
      letterheadFootTopMm: 270,
      letterheadPadMm: 18,
      letterheadPadStartMm: 14,
    });
    expect(layout.headMm).toBe(40);
    expect(layout.footMm).toBe(27);
    expect(layout.endMm).toBe(18);
    expect(layout.startMm).toBe(14);
    expect(orgLetterheadUrl(null)).toBe(BRAND_IDENTITY_DEFAULTS.letterheadUrl);
  });
});

describe("internal delegation letter", () => {
  it("renders official letter layout like authorization_letter.html", () => {
    const html = internalDelegationLetterHtml({
      id: "l1",
      city: "جدة",
      court: "محكمة التنفيذ بجدة",
      circuit: "الدائرة الأولى",
      selectedProperties: [],
      poNumbers: [],
      reference: "REF-1",
      createdAt: "2026-09-13",
      dateHijri: "1/1/1447 هـ",
      dateGreg: "2026/9/13 م",
      issuedProperties: [
        {
          propertyId: "p1",
          workOrder: "PO-1",
          deedNo: "123",
          owner: "مالك",
          requestNo: "REQ-1",
        },
      ],
      issuedAt: "2026-09-13",
      agent: {
        name: "وكيل",
        nationality: "سعودي",
        nationalId: "1",
        mobile: "0500000000",
      },
    });
    expect(html).toContain("ref-meta");
    expect(html).toContain("letter-body");
    expect(html).toContain("prop-table");
    expect(html).toContain("sign-block");
    expect(html).toContain("background-image");
    expect(html).toContain("تكليف");
    expect(html).toContain("window.print()");
    expect(html).not.toContain("lh-slice");
  });
});
