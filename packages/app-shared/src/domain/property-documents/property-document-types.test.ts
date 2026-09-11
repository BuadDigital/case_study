import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROPERTY_DOCUMENT_GOVERNED_SCOPE,
  PROPERTY_DOCUMENT_GROUPS,
  PROPERTY_DOCUMENT_REVIEW_STATUSES,
  PROPERTY_DOCUMENT_TYPES,
  UNLISTED_DOCUMENT_KEY,
  normalizePropertyTypeKeys,
  propertyDocumentRequirementKey,
  resolvePropertyDocumentType,
} from "./property-document-types";

type ContractType = {
  key: string;
  labelAr: string;
  group: string;
  appliesTo: string;
  defaultRequired: boolean;
  uploadableFromTab: boolean;
  pdfOnly: boolean;
  countsAs: string | null;
  legacyScopes: string[];
};

// Vitest runs from the repository root (vitest.config.ts).
const contract = JSON.parse(
  readFileSync(
    path.resolve(process.cwd(), "docs/architecture/property-document-types.json"),
    "utf8",
  ),
) as {
  governedScope: string;
  unlistedKey: string;
  reviewStatuses: string[];
  groups: string[];
  types: ContractType[];
};

describe("property document registry", () => {
  it("matches the shared contract with the backend", () => {
    expect(PROPERTY_DOCUMENT_GOVERNED_SCOPE).toBe(contract.governedScope);
    expect(UNLISTED_DOCUMENT_KEY).toBe(contract.unlistedKey);
    expect([...PROPERTY_DOCUMENT_REVIEW_STATUSES]).toEqual(contract.reviewStatuses);
    expect(PROPERTY_DOCUMENT_GROUPS.map((g) => g.key)).toEqual(contract.groups);
    expect(
      PROPERTY_DOCUMENT_TYPES.map((type) => ({
        ...type,
        legacyScopes: [...type.legacyScopes],
      })),
    ).toEqual(contract.types);
  });

  it("classifies the inspector's building-permit photo as the permit", () => {
    expect(
      resolvePropertyDocumentType(null, "field-inspection-photo", "t-1:component:buildLicense")?.key,
    ).toBe("building-permit");
    expect(
      resolvePropertyDocumentType(null, "field-inspection-photo", "t-1:feature:facade")?.key,
    ).toBe("inspection-photo");
  });

  it("counts the bourse deed as the deed but never the delegation letter", () => {
    const byKey = (key: string) => PROPERTY_DOCUMENT_TYPES.find((t) => t.key === key)!;
    expect(propertyDocumentRequirementKey(byKey("bourse-deed"))).toBe("deed");
    expect(propertyDocumentRequirementKey(byKey("delegation-letter"))).toBe(
      "delegation-letter",
    );
  });

  it("expands the free-text built alias to the real property types", () => {
    expect(normalizePropertyTypeKeys(["الكل", " مبني ", "أرض"])).toEqual([
      "فيلا",
      "شقة",
      "عمارة",
      "محل تجاري",
      "مستودع",
      "أرض",
    ]);
  });
});
