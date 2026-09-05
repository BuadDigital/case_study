import { describe, expect, it } from "vitest";
import {
  contactsSectionTitle,
  derivedIdentifierType,
  enfathFormVisibility,
  fallbackPatchEntries,
  isPriorHitExcluded,
  mergeClonedDocumentNames,
  priorApplyKey,
  priorFillStatusText,
  priorPoNotice,
  requestNumberMatchesDeed,
  resolveAttachPo,
  resolvePriorExclusion,
  stageNoteText,
  withoutFileName,
} from "../po-property-enfath-form-state";
import type { PoPropertyIntake } from "../../../lib/app-data/po-intake-data";

describe("enfathFormVisibility", () => {
  const base = {
    fieldsMode: "all" as const,
    assignmentType: "تنفيذ" as const,
    identifierType: "deed" as const,
    realEstateRegNumber: "",
    hasRequestNumber: undefined,
  };

  it("shows the deed sections, delegation and other docs for a court deed in mode all", () => {
    const v = enfathFormVisibility(base);
    expect(v.isBourseId).toBe(false);
    expect(v.showDeedFields).toBe(true);
    expect(v.showBoursePrimary).toBe(false);
    expect(v.showExtended).toBe(true);
    expect(v.showCourt).toBe(true);
    expect(v.showRequestNumber).toBe(true);
    expect(v.contactsRequired).toBe(true);
    expect(v.showDelegationDoc).toBe(true);
    expect(v.showRegistryDoc).toBe(false);
    expect(v.showOtherDocs).toBe(true);
    expect(v.hasRequestNumber).toBe(true);
  });

  it("switches to the bourse primary sections for a bourse identifier", () => {
    const v = enfathFormVisibility({ ...base, identifierType: "bourse_inquiry" });
    expect(v.isBourseId).toBe(true);
    expect(v.showBoursePrimary).toBe(true);
    expect(v.showDeedFields).toBe(false);
    expect(v.showDelegationDoc).toBe(false);
  });

  it("hides everything but the identifier in identifier-only mode", () => {
    const v = enfathFormVisibility({ ...base, fieldsMode: "identifier-only" });
    expect(v.isIdentifierOnly).toBe(true);
    expect(v.showExtended).toBe(false);
    expect(v.showDeedFields).toBe(false);
    expect(v.showBoursePrimary).toBe(false);
    expect(v.showDelegationDoc).toBe(false);
    expect(v.showRegistryDoc).toBe(false);
    expect(v.showOtherDocs).toBe(false);
  });

  it("keeps extended sections but no deed fields in bourse-inquiry-primary mode", () => {
    const v = enfathFormVisibility({
      ...base,
      fieldsMode: "bourse-inquiry-primary",
      identifierType: "bourse_inquiry",
    });
    expect(v.isPrimaryOnly).toBe(true);
    expect(v.showExtended).toBe(true);
    expect(v.showBoursePrimary).toBe(true);
    expect(v.showDeedFields).toBe(false);
    expect(v.showOtherDocs).toBe(true);
    expect(v.showDelegationDoc).toBe(false);
  });

  it("shows the registry attachment once a real-estate registration number is entered", () => {
    const v = enfathFormVisibility({ ...base, realEstateRegNumber: " 123 " });
    expect(v.hasRealEstateReg).toBe(true);
    expect(v.showRegistryDoc).toBe(true);
  });

  it("drops court, request number and required contacts for the private sector", () => {
    const v = enfathFormVisibility({ ...base, assignmentType: "قطاع خاص" });
    expect(v.showCourt).toBe(false);
    expect(v.showRequestNumber).toBe(false);
    expect(v.contactsRequired).toBe(false);
  });

  it("treats only an explicit false as no request number", () => {
    expect(enfathFormVisibility({ ...base, hasRequestNumber: false }).hasRequestNumber).toBe(false);
    expect(enfathFormVisibility({ ...base, hasRequestNumber: null }).hasRequestNumber).toBe(true);
  });
});

describe("PO resolution", () => {
  it("caches attachments under the current PO, then the excluded one", () => {
    expect(resolveAttachPo(" 036680 ", "0001")).toBe("036680");
    expect(resolveAttachPo("", " 0001 ")).toBe("0001");
    expect(resolveAttachPo(undefined, undefined)).toBe("");
  });

  it("excludes the explicit PO first, then the current one, from prior lookups", () => {
    expect(resolvePriorExclusion({ poNumber: "A", excludePoNumber: "B", propertyId: "p" })).toEqual({
      priorExcludePo: "B",
      priorExcludePropertyId: "p",
    });
    expect(resolvePriorExclusion({ poNumber: "A", propertyId: " " })).toEqual({
      priorExcludePo: "A",
      priorExcludePropertyId: undefined,
    });
    expect(resolvePriorExclusion({})).toEqual({
      priorExcludePo: undefined,
      priorExcludePropertyId: undefined,
    });
  });

  it("flags a hit on the excluded PO as the current transaction", () => {
    expect(isPriorHitExcluded("A", "A")).toBe(true);
    expect(isPriorHitExcluded("A", "B")).toBe(false);
    expect(isPriorHitExcluded(null, "A")).toBe(false);
    expect(isPriorHitExcluded("A", undefined)).toBe(false);
  });
});

describe("texts and keys", () => {
  it("derives the identifier type from the registration number", () => {
    expect(derivedIdentifierType("")).toBe("deed");
    expect(derivedIdentifierType("  ")).toBe("deed");
    expect(derivedIdentifierType("9")).toBe("real_estate_reg");
  });

  it("picks the stage note per path", () => {
    expect(stageNoteText(true, false)).toContain("استعلام البورصة");
    expect(stageNoteText(false, true)).toContain("التسجيل العيني يمكن تجاوز");
    expect(stageNoteText(false, false)).toContain("يلزم رقم الصك");
  });

  it("marks the contacts section required or optional", () => {
    expect(contactsSectionTitle(true)).toBe("ضباط الاتصال *");
    expect(contactsSectionTitle(false)).toBe("ضباط الاتصال (اختياري)");
  });

  it("shows the prior PO only while a deed is entered", () => {
    expect(priorPoNotice("123", "A")).toBe("A");
    expect(priorPoNotice("  ", "A")).toBeNull();
    expect(priorPoNotice("123", null)).toBeNull();
  });

  it("describes the fill status", () => {
    expect(priorFillStatusText(false)).toContain("جاري");
    expect(priorFillStatusText(true)).toContain("تم نسخ");
  });

  it("keys one autofill per property, deed and prior PO", () => {
    expect(priorApplyKey("p1", "123", "A")).toBe("p1|123|A");
  });

  it("warns only on a literal request/deed match", () => {
    expect(requestNumberMatchesDeed(" 55 ", "55")).toBe(true);
    expect(requestNumberMatchesDeed("", "")).toBe(false);
    expect(requestNumberMatchesDeed("55", "56")).toBe(false);
  });

  it("removes one file name", () => {
    expect(withoutFileName(["a", "b", "a"], "a")).toEqual(["b"]);
  });
});

describe("mergeClonedDocumentNames", () => {
  const next = {
    assignmentDocFileNames: ["old-decree.pdf"],
    delegationLetterFileNames: ["old-delegation.pdf"],
    otherDocumentFileNames: [],
    realEstateRegFileName: "old-reg.pdf",
    deedOwnershipFileName: "",
    bourseDeedImageFileName: "old-bourse.png",
    extra: 1,
  };

  it("prefers cloned names and keeps hints where nothing was cloned", () => {
    const merged = mergeClonedDocumentNames(next, {
      assignmentDocFileNames: ["new-decree.pdf"],
      delegationLetterFileNames: [],
      otherDocumentFileNames: ["x.pdf"],
      realEstateRegFileName: "",
      deedOwnershipFileName: "new-deed.pdf",
      bourseDeedImageFileName: "",
    });
    expect(merged).toEqual({
      assignmentDocFileNames: ["new-decree.pdf"],
      delegationLetterFileNames: ["old-delegation.pdf"],
      otherDocumentFileNames: ["x.pdf"],
      realEstateRegFileName: "old-reg.pdf",
      deedOwnershipFileName: "new-deed.pdf",
      bourseDeedImageFileName: "old-bourse.png",
      extra: 1,
    });
    expect(next.assignmentDocFileNames).toEqual(["old-decree.pdf"]);
  });
});

describe("fallbackPatchEntries", () => {
  it("lists every field except the id", () => {
    const property = { id: "p1", deedNumber: "1", ownerName: "x" } as PoPropertyIntake;
    expect(fallbackPatchEntries(property)).toEqual([
      ["deedNumber", "1"],
      ["ownerName", "x"],
    ]);
  });
});
