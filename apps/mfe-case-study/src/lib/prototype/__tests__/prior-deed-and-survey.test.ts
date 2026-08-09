import { describe, expect, it } from "vitest";
import type { PriorDeedRegistrationDto } from "@platform/api-client";
import { deedsMatch, normalizeDeedNumber } from "../deed-number";
import { engineeringOfficeAvailable } from "../tasks-storage";
import { emptyProperty } from "../po-intake-data";
import { buildPropertyFromPriorDeed } from "../po-intake-storage";

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

  it("fills enfath and bourse fields from prior as editable baseline", () => {
    const existing = {
      ...emptyProperty(),
      id: "slot-new",
      deedNumber: "1234567890",
      assignmentDocFileNames: ["local.pdf"],
    };
    const next = buildPropertyFromPriorDeed(existing, priorBase());
    expect(next.id).toBe("slot-new");
    expect(next.ownerName).toBe("مالك سابق");
    expect(next.city).toBe("الرياض");
    expect(next.area).toBe("500");
    expect(next.assignmentDocFileNames).toEqual(["local.pdf"]);
    expect(next.bourseDataCompleted).toBe(false);
  });

  it("keeps current-slot files and soft-delete state", () => {
    const existing = {
      ...emptyProperty(),
      id: "slot-x",
      deedNumber: "1234567890",
      isRemoved: true,
      removalReason: "اختبار",
      otherDocumentFileNames: ["o.docx"],
    };
    const next = buildPropertyFromPriorDeed(existing, priorBase());
    expect(next.isRemoved).toBe(true);
    expect(next.removalReason).toBe("اختبار");
    expect(next.otherDocumentFileNames).toEqual(["o.docx"]);
  });
});
