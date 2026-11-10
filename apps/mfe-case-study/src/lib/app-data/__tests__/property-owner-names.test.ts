import { describe, expect, it } from "vitest";
import { propertyOwnerNames } from "@platform/app-shared/app-data/po-intake-property-model";

describe("the owners of a property", () => {
  it("reads the owner field alone — the bourse owners list is retired (2026-11-10)", () => {
    expect(propertyOwnerNames({ ownerName: "فيصل الشهري" })).toEqual(["فيصل الشهري"]);
  });

  it("reads several names typed into the owner field", () => {
    expect(propertyOwnerNames({ ownerName: "فيصل الشهري - مطره الندوي - عاتق الندوي" })).toHaveLength(3);
    expect(propertyOwnerNames({ ownerName: "فيصل الشهري، مطره الندوي" })).toHaveLength(2);
  });

  it("keeps one name whole, a hyphen inside it included", () => {
    expect(propertyOwnerNames({ ownerName: "شركة آل-سعيد" })).toEqual(["شركة آل-سعيد"]);
  });

  it("finds none in a blank owner field", () => {
    expect(propertyOwnerNames({ ownerName: " " })).toEqual([]);
  });
});
