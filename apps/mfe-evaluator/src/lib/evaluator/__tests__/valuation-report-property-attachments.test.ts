import { describe, expect, it } from "vitest";
import type { PropertyDetailDocumentEntry } from "@platform/app-shared/app-data/property-detail-document-types";
import { buildValuationPrintAttachmentRows } from "../valuation-report-property-attachments";

function doc(
  id: string,
  documentTypeKey: string,
  source = "مستندات العقار",
): PropertyDetailDocumentEntry {
  return {
    id,
    name: id,
    fileName: `${id}.pdf`,
    source,
    kind: "pdf",
    attachmentId: `att-${id}`,
    documentTypeKey,
    governed: source === "مستندات العقار",
  };
}

const catalog = [
  { key: "deed", name: "صك الملكية", isRequired: true },
  { key: "survey", name: "التقرير المساحي", isRequired: false },
  { key: "zoning-sketch", name: "الكروكي التنظيمي", isRequired: false },
  { key: "building-permit", name: "رخصة البناء", isRequired: false },
  { key: "lease-contract", name: "عقد الإيجار", isRequired: false },
  { key: "owner-identity", name: "هوية المالك / الوكالة", isRequired: false },
];

describe("buildValuationPrintAttachmentRows", () => {
  it("shows documents uploaded from the documents tab under their report attachment", () => {
    const rows = buildValuationPrintAttachmentRows({
      catalog,
      documents: [doc("bourse", "bourse-deed"), doc("permit", "building-permit")],
    });

    const deed = rows.find((r) => r.key === "deed")!;
    expect(deed.available).toBe(true);
    expect(deed.docs.map((d) => d.id)).toEqual(["bourse"]);
    expect(rows.find((r) => r.key === "building-permit")!.available).toBe(true);
  });

  it("does not count a delegation letter as the deed", () => {
    const rows = buildValuationPrintAttachmentRows({
      catalog,
      documents: [doc("delegation", "delegation-letter", "البيانات الأولية")],
    });

    expect(rows.find((r) => r.key === "deed")!.available).toBe(false);
  });

  it("lists other document types read-only, and only once one is on file", () => {
    const rows = buildValuationPrintAttachmentRows({
      catalog,
      documents: [doc("lease", "lease-contract")],
      selectedKeys: ["lease-contract"],
    });

    const lease = rows.find((r) => r.key === "lease-contract")!;
    expect(lease.printable).toBe(false);
    expect(lease.selected).toBe(false);
    expect(lease.docs.map((d) => d.id)).toEqual(["lease"]);
    expect(rows.some((r) => r.key === "owner-identity")).toBe(false);
    expect(rows.filter((r) => r.printable).map((r) => r.key)).toEqual([
      "deed",
      "survey",
      "zoning-sketch",
      "building-permit",
    ]);
  });
});
