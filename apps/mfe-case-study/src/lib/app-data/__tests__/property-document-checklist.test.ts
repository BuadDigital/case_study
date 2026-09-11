import { describe, expect, it } from "vitest";
import type { ValuationListItemDto } from "@platform/api-client";
import type { PropertyDetailDocumentEntry } from "@platform/app-shared/app-data/property-detail-document-types";
import {
  buildPropertyDocumentChecklist,
  dedupeDocumentEntries,
  propertyDocumentUploadOptions,
} from "../property-document-checklist";

function doc(
  id: string,
  documentTypeKey: string,
  extra: Partial<PropertyDetailDocumentEntry> = {},
): PropertyDetailDocumentEntry {
  return {
    id,
    name: id,
    fileName: `${id}.pdf`,
    source: "البيانات الأولية",
    kind: "pdf",
    attachmentId: `att-${id}`,
    documentTypeKey,
    ...extra,
  };
}

function setting(
  key: string,
  overrides: Partial<ValuationListItemDto> = {},
): ValuationListItemDto {
  return {
    id: key,
    key,
    name: key,
    cells: [],
    isEnabled: true,
    defaultName: key,
    usage: 0,
    sortOrder: 1,
    isSystemDefault: true,
    isRequired: false,
    propertyTypeKeys: [],
    ...overrides,
  };
}

const rowKeys = (checklist: ReturnType<typeof buildPropertyDocumentChecklist>) =>
  checklist.groups.flatMap((g) => g.rows.map((r) => r.type.key));

describe("buildPropertyDocumentChecklist", () => {
  it("lists built-property documents for a villa and flags the missing deed", () => {
    const checklist = buildPropertyDocumentChecklist({ entries: [], propertyType: "فيلا" });

    expect(rowKeys(checklist)).toContain("lease-contract");
    expect(rowKeys(checklist)).toContain("building-permit");
    expect(rowKeys(checklist)).not.toContain("survey");
    expect(checklist.missingRequired).toEqual(["صك الملكية"]);
  });

  it("hides built-only documents for land and requires the survey there", () => {
    const checklist = buildPropertyDocumentChecklist({ entries: [], propertyType: "أرض" });

    expect(rowKeys(checklist)).not.toContain("lease-contract");
    expect(checklist.missingRequired).toEqual(["صك الملكية", "التقرير المساحي"]);
  });

  it("accepts the bourse deed image for the deed but not the delegation letter", () => {
    const withDelegation = buildPropertyDocumentChecklist({
      entries: [doc("d", "delegation-letter")],
      propertyType: "فيلا",
    });
    expect(withDelegation.missingRequired).toContain("صك الملكية");

    const withBourse = buildPropertyDocumentChecklist({
      entries: [doc("b", "bourse-deed")],
      propertyType: "فيلا",
    });
    const deedRow = withBourse.groups[0]!.rows.find((r) => r.type.key === "deed")!;
    expect(deedRow.satisfiedBy).toBe("صورة الصك من البورصة");
    expect(deedRow.missing).toBe(false);
    expect(withBourse.missingRequired).toEqual([]);
  });

  it("applies admin settings: label, requiredness with the built alias, and disabling", () => {
    const checklist = buildPropertyDocumentChecklist({
      entries: [],
      propertyType: "عمارة",
      attachmentsList: [
        setting("deed", { name: "صك التملك", isRequired: true }),
        setting("building-permit", { isRequired: true, propertyTypeKeys: ["مبني"] }),
        setting("utility-bills", { isEnabled: false }),
      ],
    });

    expect(checklist.missingRequired).toEqual(["صك التملك", "building-permit"]);
    expect(rowKeys(checklist)).not.toContain("utility-bills");
  });

  it("routes the inspector permit photo to its row and other photos to the photo strip", () => {
    const checklist = buildPropertyDocumentChecklist({
      entries: [
        doc("permit", "building-permit", { kind: "image", source: "المعاين الميداني" }),
        doc("facade", "inspection-photo", { kind: "image" }),
      ],
      propertyType: "فيلا",
    });

    const permitRow = checklist.groups
      .flatMap((g) => g.rows)
      .find((r) => r.type.key === "building-permit")!;
    expect(permitRow.documents.map((d) => d.id)).toEqual(["permit"]);
    expect(checklist.photos.map((d) => d.id)).toEqual(["facade"]);
  });

  it("puts unlisted documents in review order, pending first", () => {
    const unlisted = (id: string, reviewStatus: "pending" | "approved" | "rejected") =>
      doc(id, "unlisted", {
        unlisted: { customLabel: id, customReason: "سبب كافٍ للرفع", reviewStatus },
      });

    const checklist = buildPropertyDocumentChecklist({
      entries: [unlisted("a", "approved"), unlisted("r", "rejected"), unlisted("p", "pending")],
      propertyType: "فيلا",
    });

    expect(checklist.unlisted.map((d) => d.id)).toEqual(["p", "r", "a"]);
    // An unlisted document never satisfies a requirement.
    expect(checklist.missingRequired).toEqual(["صك الملكية"]);
  });

  it("shows outputs even before they are issued", () => {
    const checklist = buildPropertyDocumentChecklist({ entries: [] });

    expect(checklist.outputs.map((r) => r.type.key)).toEqual([
      "valuation-report",
      "deposit-certificate",
    ]);
  });
});

describe("dedupeDocumentEntries", () => {
  it("keeps the governed row for a file seen twice, with the hydrated preview", () => {
    const intake = doc("intake-other-0", "unlisted", { dataUrl: "data:preview" });
    const governed = doc("governed-att", "lease-contract", {
      attachmentId: "att-intake-other-0",
      governed: false,
      unlisted: undefined,
      source: "البيانات الأولية",
    });
    governed.governed = true;

    const [only, ...rest] = dedupeDocumentEntries([intake, governed]);

    expect(rest).toEqual([]);
    expect(only!.documentTypeKey).toBe("lease-contract");
    expect(only!.dataUrl).toBe("data:preview");
  });
});

describe("propertyDocumentUploadOptions", () => {
  it("offers only tab-uploadable enabled types and ends with the unlisted option", () => {
    const options = propertyDocumentUploadOptions([setting("owner-identity", { isEnabled: false })]);
    const keys = options.map((o) => o.key);

    expect(keys).toContain("lease-contract");
    expect(keys).not.toContain("survey");
    expect(keys).not.toContain("owner-identity");
    expect(keys.at(-1)).toBe("unlisted");
  });
});
