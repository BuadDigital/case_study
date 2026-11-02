import { describe, expect, it } from "vitest";
import { PROPERTY_USAGE_OPTIONS, propertyUsageValue } from "../inspector-workspace-data";
import {
  listedPropertyUsage,
  looksLikeUsageName,
  similarPropertyUsages,
} from "../property-usage-names";

describe("a stored «استخدام العقار»", () => {
  it("reads a classification from before the field held uses as no answer", () => {
    expect(propertyUsageValue("مبنى مفرد")).toBe("");
    expect(propertyUsageValue(" وحدة داخل مبنى ")).toBe("");
    expect(propertyUsageValue("أرض")).toBe("");
  });

  it("keeps a real use, listed or not", () => {
    expect(propertyUsageValue("سكني تجاري")).toBe("سكني تجاري");
    expect(propertyUsageValue(" مصلى ")).toBe("مصلى");
    expect(propertyUsageValue(null)).toBe("");
  });

  it("offers no classification in its list", () => {
    for (const name of PROPERTY_USAGE_OPTIONS) expect(propertyUsageValue(name)).toBe(name);
  });
});

describe("a usage name the inspector typed", () => {
  it("takes the listed spelling when the list already has it", () => {
    expect(listedPropertyUsage(PROPERTY_USAGE_OPTIONS, "تجاري اداري")).toBe("تجاري إداري");
    expect(listedPropertyUsage(PROPERTY_USAGE_OPTIONS, "مصلى")).toBeNull();
  });

  it("asks about look-alikes before adding a new name", () => {
    expect(similarPropertyUsages(PROPERTY_USAGE_OPTIONS, "مستودعاات")).toEqual(["مستودعات"]);
    expect(similarPropertyUsages(PROPERTY_USAGE_OPTIONS, "مغسلة سيارات")).toEqual([]);
  });

  it("does not let a two-letter name resemble everything", () => {
    expect(similarPropertyUsages(PROPERTY_USAGE_OPTIONS, "حج")).toEqual([]);
  });

  it("follows the server's rule for a name", () => {
    expect(looksLikeUsageName("مغسلة سيارات")).toBe(true);
    expect(looksLikeUsageName("م")).toBe(false);
    expect(looksLikeUsageName("Shop")).toBe(false);
    expect(looksLikeUsageName("1 محل")).toBe(false);
  });
});
