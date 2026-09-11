import { describe, expect, it } from "vitest";
import {
  printKeyForDocumentType,
  printKeyForPropertyDocument,
} from "../valuation-print-attachment-keys";

describe("printKeyForPropertyDocument", () => {
  const base = { id: "x", name: "", fileName: "x.pdf", source: "البيانات الأولية" };

  it("uses the stored document type before any name guessing", () => {
    expect(
      printKeyForPropertyDocument({
        ...base,
        id: "governed-1",
        name: "صورة الصك من البورصة",
        documentTypeKey: "bourse-deed",
      }),
    ).toBe("deed");
    expect(
      printKeyForPropertyDocument({
        ...base,
        id: "governed-2",
        name: "مستند فيه كلمة صك",
        documentTypeKey: "lease-contract",
      }),
    ).toBeNull();
  });

  it("never prints assignment or delegation letters as the deed", () => {
    expect(
      printKeyForPropertyDocument({
        ...base,
        id: "intake-assignment-0-x",
        name: "خطاب الإسناد",
        documentTypeKey: "assignment-letter",
      }),
    ).toBeNull();
    expect(
      printKeyForPropertyDocument({
        ...base,
        id: "intake-delegation-0-x",
        name: "خطاب التفويض",
      }),
    ).toBeNull();
  });

  it("maps the inspector build-license photo to building-permit", () => {
    expect(
      printKeyForPropertyDocument({
        id: "inspection-component-buildLicense",
        name: "رخصة البناء",
        fileName: "license.jpg",
        source: "المعاين الميداني",
        documentTypeKey: "building-permit",
      }),
    ).toBe("building-permit");
  });

  it("does not treat the engineering site letter as the zoning sketch once typed", () => {
    expect(
      printKeyForPropertyDocument({
        id: "eng-siteLetter",
        name: "خطاب إقرار صحة الموقع",
        fileName: "site-letter.pdf",
        source: "المكتب الهندسي",
        documentTypeKey: "site-letter",
      }),
    ).toBeNull();
  });

  it("maps the engineering-office survey report to survey", () => {
    expect(
      printKeyForPropertyDocument({
        id: "surveyReport",
        name: "تقرير الرفع المساحي",
        fileName: "survey.pdf",
        source: "المكتب الهندسي",
        documentTypeKey: "survey",
      }),
    ).toBe("survey");
  });

  it("still guesses untyped deed-family rows by name", () => {
    expect(
      printKeyForPropertyDocument({ ...base, id: "intake-reg", name: "السجل العقاري" }),
    ).toBe("deed");
    expect(
      printKeyForPropertyDocument({
        ...base,
        id: "intake-deed-ownership",
        name: "صورة وثيقة التملك (الصك)",
      }),
    ).toBe("deed");
  });

  it("returns null for documents that match no catalog key", () => {
    expect(
      printKeyForPropertyDocument({
        id: "inspection-free-1",
        name: "صورة إضافية",
        fileName: "x.jpg",
        source: "المعاين الميداني",
      }),
    ).toBeNull();
  });
});

describe("printKeyForDocumentType", () => {
  it("routes only the printable registry types", () => {
    expect(printKeyForDocumentType("real-estate-registry")).toBe("deed");
    expect(printKeyForDocumentType("zoning-sketch")).toBe("zoning-sketch");
    expect(printKeyForDocumentType("owner-identity")).toBeNull();
  });
});
