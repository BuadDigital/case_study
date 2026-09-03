import { describe, expect, it } from "vitest";
import type { PriorDeedRegistrationDto } from "@platform/api-client";
import { deedsMatch, normalizeDeedNumber } from "../deed-number";
import { engineeringOfficeAvailable, engineeringOfficeUnavailableReason } from "../tasks-storage";
import { emptyProperty } from "../po-intake-data";
import { buildPropertyFromPriorDeed } from "../po-intake-model";

describe("normalizeDeedNumber", () => {
  it("maps arabic digits and strips separators", () => {
    expect(normalizeDeedNumber("١٢٣-٤٥٦")).toBe("123456");
    expect(normalizeDeedNumber(" 72 / 01 ")).toBe("7201");
  });

  it("deedsMatch equates latin and arabic forms", () => {
    expect(deedsMatch("١٢٣", "123")).toBe(true);
    expect(deedsMatch("123", "124")).toBe(false);
  });
});

describe("engineeringOfficeAvailable with prior survey", () => {
  it("hides engineering office when prior survey exists", () => {
    const prop = { ...emptyProperty(), classification: "أرض", deedNumber: "1" };
    expect(engineeringOfficeAvailable(prop, true)).toBe(false);
  });

  it("allows engineering office when no prior and survey required", () => {
    const prop = { ...emptyProperty(), classification: "أرض", deedNumber: "1" };
    expect(engineeringOfficeAvailable(prop, false)).toBe(true);
  });

  it("hides engineering office for unit-inside-building", () => {
    const prop = {
      ...emptyProperty(),
      classification: "وحدة داخل مبنى",
      deedNumber: "1",
    };
    expect(engineeringOfficeAvailable(prop, false)).toBe(false);
  });

  it("hides engineering office for registered title (سجل عيني)", () => {
    const prop = {
      ...emptyProperty(),
      classification: "أرض",
      deedNumber: "1",
      identifierType: "real_estate_reg" as const,
    };
    expect(engineeringOfficeAvailable(prop, false)).toBe(false);
    expect(engineeringOfficeUnavailableReason(prop, false)).toContain("سجل عيني");
  });
});

describe("buildPropertyFromPriorDeed", () => {
  const priorBase = (): PriorDeedRegistrationDto =>
    ({
      poNumber: "PO-OLD",
      propertyId: "prop-old",
      deedNumber: "1234567890",
      requestNumber: "REQ-1",
      ownerName: "مالك سابق",
      planNumber: "P-9",
      plotNumber: "42",
      city: "الرياض",
      region: "الوسطى",
      district: "حي",
      classification: "أرض",
      propertyType: "سكني",
      area: "500",
      deedStatus: "ساري",
      contacts: [{ name: "جهة", role: "مالك", phone: "0500000000" }],
    }) as PriorDeedRegistrationDto;

  it("fills all prior fields including request, mandate, and document names", () => {
    const existing = {
      ...emptyProperty(),
      id: "slot-new",
      deedNumber: "1234567890",
    };
    const next = buildPropertyFromPriorDeed(existing, {
      ...priorBase(),
      requestNumber: "REQ-PRIOR",
      assignmentMandateNumber: "MAND-1",
      assignmentMandateDate: "2020-01-01",
      assignmentDocFileNames: ["decree.pdf"],
      delegationLetterFileNames: ["letter.pdf"],
      otherDocumentFileNames: ["other.pdf"],
      realEstateRegFileName: "reg.pdf",
    });
    expect(next.id).toBe("slot-new");
    expect(next.ownerName).toBe("مالك سابق");
    expect(next.city).toBe("الرياض");
    expect(next.area).toBe("500");
    expect(next.requestNumber).toBe("REQ-PRIOR");
    expect(next.assignmentMandateNumber).toBe("MAND-1");
    expect(next.assignmentMandateDate).toBe("2020-01-01");
    expect(next.assignmentDocFileNames).toEqual(["decree.pdf"]);
    expect(next.delegationLetterFileNames).toEqual(["letter.pdf"]);
    expect(next.otherDocumentFileNames).toEqual(["other.pdf"]);
    expect(next.realEstateRegFileName).toBe("reg.pdf");
    expect(next.bourseDataCompleted).toBe(false);
  });

  it("keeps soft-delete state on the current slot", () => {
    const existing = {
      ...emptyProperty(),
      id: "slot-x",
      deedNumber: "1234567890",
      isRemoved: true,
      removalReason: "اختبار",
    };
    const next = buildPropertyFromPriorDeed(existing, {
      ...priorBase(),
      otherDocumentFileNames: ["o.docx"],
    });
    expect(next.isRemoved).toBe(true);
    expect(next.removalReason).toBe("اختبار");
    expect(next.otherDocumentFileNames).toEqual(["o.docx"]);
  });
});
