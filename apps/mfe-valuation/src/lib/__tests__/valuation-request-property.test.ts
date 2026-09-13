import { describe, expect, it } from "vitest";
import {
  valuationRequestPropertiesById,
  valuationRequestSearchText,
  valuationRequestTypeLabel,
} from "../valuation-request-property";

const items = [
  {
    propertyId: "bb130b20-e9ea-4893-bb69-c3ec225c0e34",
    poNumber: "PO-068322",
    row: { id: "320110003654", po: "PO-068322", area: "مكة المكرمة", type: "سكني" },
  },
  {
    propertyId: "123856d5-dad8-4e78-8488-9a7544c98bd9",
    poNumber: "PO-068208",
    row: { id: "843702000192", po: "PO-068208", area: "المدينة المنورة", type: "ارض" },
  },
] as never;

describe("valuation request property label", () => {
  it("maps the stored property id to its deed number and work order", () => {
    const byId = valuationRequestPropertiesById(items);
    expect(byId.get("bb130b20-e9ea-4893-bb69-c3ec225c0e34")).toEqual({
      deed: "320110003654",
      poNumber: "PO-068322",
      type: "سكني",
    });
    expect(byId.has("58f6cdec-d552-4899-bd35-026bce125b65")).toBe(false);
  });

  it("falls back to the property's type only when the request saved none", () => {
    const byId = valuationRequestPropertiesById(items);
    expect(valuationRequestTypeLabel("—", byId.get("123856d5-dad8-4e78-8488-9a7544c98bd9"))).toBe("ارض");
    expect(valuationRequestTypeLabel("أرض", byId.get("123856d5-dad8-4e78-8488-9a7544c98bd9"))).toBe("أرض");
    expect(valuationRequestTypeLabel("", null)).toBe("—");
  });

  it("searches by deed and work order instead of the internal id", () => {
    const byId = valuationRequestPropertiesById(items);
    const text = valuationRequestSearchText(
      {
        id: "VR-737",
        propId: "bb130b20-e9ea-4893-bb69-c3ec225c0e34",
        area: "مكة المكرمة",
        type: "سكني",
        appraiser: "عبدالله الكثيري",
      },
      byId.get("bb130b20-e9ea-4893-bb69-c3ec225c0e34"),
    );
    expect(text).toContain("320110003654");
    expect(text).toContain("PO-068322");
    expect(text).not.toContain("bb130b20");
  });
});
