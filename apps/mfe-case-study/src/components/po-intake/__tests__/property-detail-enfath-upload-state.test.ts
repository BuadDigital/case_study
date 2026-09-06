import { describe, expect, it } from "vitest";
import {
  appraisalFieldValue,
  areaCopyKey,
  attachmentIcon,
  attachmentReady,
  attachmentStatusLabel,
  collapsedSectionIds,
  copyToastPreview,
  courtVisitOpsFields,
  fieldCopyKey,
  findInfathDocumentByName,
  infathFieldAction,
  infathFieldHasValue,
  initialCollapsedSectionIds,
  readyAttachments,
  toggledSet,
  withCopiedKey,
} from "../property-detail-enfath-upload-state";
import type { PropertyDetailDocumentEntry } from "../../../lib/app-data/property-detail-documents";

function doc(overrides: Partial<PropertyDetailDocumentEntry>): PropertyDetailDocumentEntry {
  return {
    id: "d",
    name: "name",
    fileName: "file.pdf",
    source: "s",
    kind: "pdf",
    ...overrides,
  };
}

describe("attachments", () => {
  it("maps known attachment ids to icons and falls back to file", () => {
    expect(attachmentIcon({ id: "case-study" })).toBe("file");
    expect(attachmentIcon({ id: "appraisal" })).toBe("appraisal");
    expect(attachmentIcon({ id: "survey" })).toBe("map");
    expect(attachmentIcon({ id: "interior-photos" })).toBe("photo");
    expect(attachmentIcon({ id: "exterior-photos" })).toBe("photo");
    expect(attachmentIcon({ id: "plan" })).toBe("plan");
    expect(attachmentIcon({ id: "deed" })).toBe("deed");
    expect(attachmentIcon({ id: "keys-proof" })).toBe("key");
    expect(attachmentIcon({ id: "whatever" })).toBe("file");
  });

  it("is ready only with document bytes", () => {
    expect(attachmentReady({ document: null })).toBe(false);
    expect(attachmentReady({ document: doc({}) })).toBe(false);
    expect(attachmentReady({ document: doc({ dataUrl: "data:x" }) })).toBe(true);
  });

  it("labels the status", () => {
    expect(attachmentStatusLabel(true)).toBe("جاهز");
    expect(attachmentStatusLabel(true, true)).toBe("جاهز");
    expect(attachmentStatusLabel(false, true)).toBe("عند الحاجة");
    expect(attachmentStatusLabel(false)).toBe("غير متوفر");
  });

  it("keeps only ready attachments", () => {
    const ready = { document: doc({ dataUrl: "data:x" }) };
    expect(readyAttachments([{ document: null }, ready])).toEqual([ready]);
  });

  it("finds a document by stored name in attachments before the sections", () => {
    const fromAttachment = doc({ id: "a", fileName: "a.pdf", dataUrl: "data:a" });
    const fromSection = doc({ id: "b", fileName: "a.pdf" });
    expect(
      findInfathDocumentByName(
        [{ document: null }, { document: fromAttachment }],
        [{ id: "s", title: "t", documents: [fromSection] }],
        "a.pdf",
      ),
    ).toBe(fromAttachment);
  });

  it("falls back to the document sections and matches display names too", () => {
    const fromSection = doc({ id: "b", name: "عرض", fileName: "b.pdf" });
    const sections = [{ id: "s", title: "t", documents: [fromSection] }];
    expect(findInfathDocumentByName([], sections, "عرض")).toBe(fromSection);
    expect(findInfathDocumentByName([], sections, "b.pdf")).toBe(fromSection);
    expect(findInfathDocumentByName([], sections, "zzz")).toBeUndefined();
  });
});

describe("fields", () => {
  it("treats blank and the dash placeholder as empty", () => {
    expect(infathFieldHasValue("")).toBe(false);
    expect(infathFieldHasValue("  ")).toBe(false);
    expect(infathFieldHasValue("—")).toBe(false);
    expect(infathFieldHasValue(undefined)).toBe(false);
    expect(infathFieldHasValue("x")).toBe(true);
  });

  it("offers download for files, copy for text, nothing for sel/auto/ref or empty", () => {
    expect(infathFieldAction({ type: "file", value: "a.pdf" })).toBe("download");
    expect(infathFieldAction({ type: "text", value: "abc" })).toBe("copy");
    expect(infathFieldAction({ type: "area", value: "abc" })).toBe("copy");
    expect(infathFieldAction({ type: "sel", value: "abc" })).toBeNull();
    expect(infathFieldAction({ type: "auto", value: "abc" })).toBeNull();
    expect(infathFieldAction({ type: "ref", value: "abc" })).toBeNull();
    expect(infathFieldAction({ type: "file", value: "" })).toBeNull();
    expect(infathFieldAction({ type: "text", value: "—" })).toBeNull();
  });

  it("namespaces copy keys per section", () => {
    expect(fieldCopyKey("s1", "f1")).toBe("f:s1:f1");
    expect(areaCopyKey("s1", "f1")).toBe("a:s1:f1");
    expect(fieldCopyKey("s1", "f1")).not.toBe(areaCopyKey("s1", "f1"));
  });

  it("truncates long previews with an ellipsis", () => {
    expect(copyToastPreview("short")).toBe("short");
    const long = "x".repeat(40);
    expect(copyToastPreview(long)).toBe(`${"x".repeat(34)}…`);
    expect(copyToastPreview("x".repeat(34))).toBe("x".repeat(34));
  });
});

describe("collapse and copied sets", () => {
  const sections = [
    { id: "a", conditional: false },
    { id: "b", conditional: true },
    { id: "c" },
  ];

  it("starts with the conditional sections folded", () => {
    expect([...initialCollapsedSectionIds(sections)]).toEqual(["b"]);
  });

  it("expand-all keeps conditional sections folded", () => {
    expect([...collapsedSectionIds(sections, false)]).toEqual(["b"]);
  });

  it("collapse-all folds the unconditional sections", () => {
    expect([...collapsedSectionIds(sections, true)]).toEqual(["a", "c"]);
  });

  it("toggles one id without mutating the source", () => {
    const source = new Set(["a"]);
    expect([...toggledSet(source, "a")]).toEqual([]);
    expect([...toggledSet(source, "b")]).toEqual(["a", "b"]);
    expect([...source]).toEqual(["a"]);
  });

  it("returns the same set when the key is already copied", () => {
    const source = new Set(["k"]);
    expect(withCopiedKey(source, "k")).toBe(source);
    const next = withCopiedKey(source, "j");
    expect(next).not.toBe(source);
    expect([...next]).toEqual(["k", "j"]);
  });
});

describe("ops context inputs", () => {
  it("reports the court visit only once completed", () => {
    expect(courtVisitOpsFields(null)).toEqual({
      courtVisitCompletedAt: null,
      courtVisitResultKind: null,
      courtVisitAssigneeName: null,
    });
    expect(
      courtVisitOpsFields({
        status: "in_progress",
        updatedAt: "2026-01-01",
        courtVisitResult: { kind: "keys" },
        assigneeName: "فراس",
      }),
    ).toEqual({
      courtVisitCompletedAt: null,
      courtVisitResultKind: "keys",
      courtVisitAssigneeName: "فراس",
    });
    expect(
      courtVisitOpsFields({ status: "completed", updatedAt: "2026-01-01" }),
    ).toEqual({
      courtVisitCompletedAt: "2026-01-01",
      courtVisitResultKind: null,
      courtVisitAssigneeName: null,
    });
  });

  it("reads an appraisal field by label", () => {
    const fields = [{ label: "رمز إيداع التقرير", value: "DEP-1" }];
    expect(appraisalFieldValue(fields, "رمز إيداع التقرير")).toBe("DEP-1");
    expect(appraisalFieldValue(fields, "غير موجود")).toBeUndefined();
    expect(appraisalFieldValue(undefined, "x")).toBeUndefined();
  });
});
