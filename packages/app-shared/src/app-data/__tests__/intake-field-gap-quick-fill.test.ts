import { describe, expect, it } from "vitest";
import {
  intakeQuickFillFieldFor,
  parseIntakeFieldGapSourceEvent,
  poNumberFromNotificationHref,
} from "../intake-field-gap-quick-fill";

describe("parseIntakeFieldGapSourceEvent", () => {
  it("reads the field label out of an intake field-gap sourceEvent", () => {
    expect(
      parseIntakeFieldGapSourceEvent(
        "intake-field-gap:3fa85f6457174562b3fc2c963f66afa6:رقم الطلب",
      ),
    ).toEqual({ fieldLabel: "رقم الطلب" });
  });

  it("ignores inspector / survey / non field-gap sourceEvents", () => {
    expect(
      parseIntakeFieldGapSourceEvent(
        "inspector-field-gap:3fa85f6457174562b3fc2c963f66afa6:هل يوجد منقولات",
      ),
    ).toBeNull();
    expect(parseIntakeFieldGapSourceEvent("distribution-assigned:abc")).toBeNull();
    expect(parseIntakeFieldGapSourceEvent(undefined)).toBeNull();
    expect(parseIntakeFieldGapSourceEvent("")).toBeNull();
  });
});

describe("poNumberFromNotificationHref", () => {
  it("extracts the PO number from the property deep link", () => {
    expect(
      poNumberFromNotificationHref(
        "/po/PO-LAND-21793304/property/3fa85f64-5717-4562-b3fc-2c963f66afa6",
      ),
    ).toBe("PO-LAND-21793304");
  });

  it("returns null for hrefs that aren't a property deep link", () => {
    expect(poNumberFromNotificationHref("/tasks/123")).toBeNull();
    expect(poNumberFromNotificationHref(undefined)).toBeNull();
  });
});

describe("intakeQuickFillFieldFor", () => {
  it("resolves the fields on the agreed quick-fill list", () => {
    for (const label of [
      "رقم الطلب",
      "اسم المنطقة",
      "اسم المدينة",
      "اسم الحي",
      "اسم المخطط",
      "رقم المخطط",
      "رقم البلك",
      "رقم القطعة",
      "مساحة الأرض (حسب الصك)",
      "استخدام العقار",
    ]) {
      const field = intakeQuickFillFieldFor(label);
      expect(field?.inputs).toHaveLength(1);
    }
  });

  it("uses two inputs (number + date) for محضر التجزئة", () => {
    const field = intakeQuickFillFieldFor("محضر التجزئة");
    expect(field?.inputs.map((i) => i.key)).toEqual([
      "partitionMinutesNumber",
      "partitionMinutesDate",
    ]);
  });

  it("does not resolve gated, computed, or inspector/survey fields", () => {
    expect(intakeQuickFillFieldFor("اسم المالك")).toBeNull();
    expect(intakeQuickFillFieldFor("رقم الصك")).toBeNull();
    expect(intakeQuickFillFieldFor("الغرض من التقييم")).toBeNull();
    expect(intakeQuickFillFieldFor("هل يوجد منقولات")).toBeNull();
  });
});
