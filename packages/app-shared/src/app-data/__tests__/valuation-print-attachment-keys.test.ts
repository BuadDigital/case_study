import { describe, expect, it } from "vitest";
import { printKeyForPropertyDocument } from "../valuation-print-attachment-keys";

describe("printKeyForPropertyDocument", () => {
  it("maps the field-inspection build-license photo to building-permit", () => {
    expect(
      printKeyForPropertyDocument({
        id: "inspection-component-buildLicense",
        name: "رخصة البناء",
        fileName: "license.jpg",
        source: "المعاين الميداني",
      }),
    ).toBe("building-permit");
  });

  it("maps the engineering-office site letter to zoning-sketch, not survey", () => {
    expect(
      printKeyForPropertyDocument({
        id: "siteLetter",
        name: "خطاب إقرار صحة الموقع",
        fileName: "site-letter.pdf",
        source: "المكتب الهندسي",
      }),
    ).toBe("zoning-sketch");
  });

  it("maps the engineering-office survey report to survey", () => {
    expect(
      printKeyForPropertyDocument({
        id: "surveyReport",
        name: "تقرير الرفع المساحي",
        fileName: "survey.pdf",
        source: "المكتب الهندسي",
      }),
    ).toBe("survey");
  });

  it("maps the bourse deed image to deed", () => {
    expect(
      printKeyForPropertyDocument({
        id: "intake-bourse-deed",
        name: "صورة الصك من البورصة",
        fileName: "bourse-deed.jpg",
        source: "استعلام البورصة",
      }),
    ).toBe("deed");
  });

  it("maps the four intake deed-family fields to deed", () => {
    expect(
      printKeyForPropertyDocument({
        id: "intake-assignment-0-x",
        name: "خطاب الإسناد",
        fileName: "x.pdf",
        source: "البيانات الأولية",
      }),
    ).toBe("deed");
    expect(
      printKeyForPropertyDocument({
        id: "intake-reg",
        name: "السجل العقاري",
        fileName: "x.pdf",
        source: "البيانات الأولية",
      }),
    ).toBe("deed");
    expect(
      printKeyForPropertyDocument({
        id: "intake-delegation-0-x",
        name: "خطاب التفويض",
        fileName: "x.pdf",
        source: "البيانات الأولية",
      }),
    ).toBe("deed");
    expect(
      printKeyForPropertyDocument({
        id: "intake-deed-ownership",
        name: "صورة وثيقة التملك (الصك)",
        fileName: "x.pdf",
        source: "البيانات الأولية",
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
