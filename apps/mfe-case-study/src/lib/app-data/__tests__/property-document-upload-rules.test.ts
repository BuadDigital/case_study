import { describe, expect, it } from "vitest";
import {
  contentTypeForUpload,
  validatePropertyDocumentFile,
  validateUnlistedDocumentFields,
} from "../property-document-upload-rules";
import { governedEntryFromMeta } from "../governed-property-documents-reads";

describe("validateUnlistedDocumentFields", () => {
  it("needs a name and a reason of at least ten characters", () => {
    expect(validateUnlistedDocumentFields("", "سبب طويل بما يكفي")).not.toBeNull();
    expect(validateUnlistedDocumentFields("محضر لجنة", "قصير")).not.toBeNull();
    expect(validateUnlistedDocumentFields("محضر لجنة", "طلبه العميل للمعاملة")).toBeNull();
  });
});

describe("validatePropertyDocumentFile", () => {
  const file = (name: string, type: string, size = 1024) => ({ name, type, size });

  it("accepts PDFs and supported images", () => {
    expect(validatePropertyDocumentFile(file("a.pdf", "application/pdf"), false)).toBeNull();
    expect(validatePropertyDocumentFile(file("a.jpg", "image/jpeg"), false)).toBeNull();
  });

  it("rejects HEIC, images on PDF-only types, and oversize images", () => {
    expect(validatePropertyDocumentFile(file("a.heic", "image/heic"), false)).not.toBeNull();
    expect(validatePropertyDocumentFile(file("a.png", "image/png"), true)).not.toBeNull();
    expect(
      validatePropertyDocumentFile(file("a.png", "image/png", 9 * 1024 * 1024), false),
    ).not.toBeNull();
  });

  it("derives a content type when the browser gives none", () => {
    expect(contentTypeForUpload({ name: "scan.PDF", type: "" })).toBe("application/pdf");
  });
});

describe("governedEntryFromMeta", () => {
  const base = {
    id: "a1",
    scopeKey: "PO-1:p1",
    fileName: "x.pdf",
    contentType: "application/pdf",
    sizeBytes: 10,
    createdAtUtc: "2026-09-10T00:00:00Z",
  };

  it("labels a tab upload by its registry type", () => {
    const entry = governedEntryFromMeta({
      ...base,
      scope: "property-document",
      documentTypeKey: "lease-contract",
    });

    expect(entry.name).toBe("عقد الإيجار");
    expect(entry.documentTypeKey).toBe("lease-contract");
    expect(entry.governed).toBe(true);
    expect(entry.unlisted).toBeUndefined();
  });

  it("carries the uploader's name, reason and review state for unlisted documents", () => {
    const entry = governedEntryFromMeta({
      ...base,
      scope: "property-other",
      documentTypeKey: "unlisted",
      customDocumentLabel: "محضر لجنة",
      customDocumentReason: "طلبه العميل للمعاملة",
      reviewStatus: "rejected",
      reviewNote: "ليس للعقار",
    });

    expect(entry.name).toBe("محضر لجنة");
    expect(entry.governed).toBe(false);
    expect(entry.unlisted).toEqual({
      customLabel: "محضر لجنة",
      customReason: "طلبه العميل للمعاملة",
      reviewStatus: "rejected",
      reviewNote: "ليس للعقار",
    });
  });
});
