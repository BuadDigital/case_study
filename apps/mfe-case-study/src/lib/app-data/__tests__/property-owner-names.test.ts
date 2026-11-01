import { describe, expect, it } from "vitest";
import { propertyOwnerNames } from "@platform/app-shared/app-data/po-intake-property-model";

describe("the owners of a property", () => {
  it("takes the deed's owners list first", () => {
    const ownersJson = JSON.stringify([{ name: "فيصل الشهري" }, { name: " " }, { name: "مطره الندوي" }]);
    expect(propertyOwnerNames({ ownerName: "اسم آخر", ownersJson })).toEqual(["فيصل الشهري", "مطره الندوي"]);
  });

  it("reads several names typed into the owner field", () => {
    expect(propertyOwnerNames({ ownerName: "فيصل الشهري - مطره الندوي - عاتق الندوي", ownersJson: "" })).toHaveLength(3);
    expect(propertyOwnerNames({ ownerName: "فيصل الشهري، مطره الندوي", ownersJson: "" })).toHaveLength(2);
  });

  it("keeps one name whole, a hyphen inside it included", () => {
    expect(propertyOwnerNames({ ownerName: "شركة آل-سعيد", ownersJson: "" })).toEqual(["شركة آل-سعيد"]);
  });

  it("finds none in a blank property or a broken list", () => {
    expect(propertyOwnerNames({ ownerName: " ", ownersJson: "" })).toEqual([]);
    expect(propertyOwnerNames({ ownerName: "مالك", ownersJson: "{broken" })).toEqual(["مالك"]);
  });
});
