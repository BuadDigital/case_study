import { describe, expect, it } from "vitest";
import {
  missingFieldNoResponsibleText,
  missingFieldNotifiedToast,
  missingFieldNotifyError,
  missingFieldPromptText,
  responsibleForMissingCell,
} from "../valuation-report-missing-field-prompt";

const sources = {
  intake: { name: "أسامة الحربي", roleLabel: "أخصائي الإسناد", canNotify: true },
  inspector: { name: "أحمد سعيد", roleLabel: "المعاين", canNotify: true },
  survey: { name: "", roleLabel: "المكتب الهندسي", canNotify: false },
};
const editors = {
  company: { name: "سليمان الصالحي", canNotify: true, editedAtUtc: "2026-09-10T08:00:00Z" },
  evaluator: { name: "مسؤول إعدادات المنشأة", canNotify: true, editedAtUtc: null },
  report: { name: "", canNotify: false, editedAtUtc: null },
};

describe("report missing-field prompt", () => {
  it("names the person who supplies each kind of information", () => {
    const inspector = responsibleForMissingCell(
      { label: "وصف العقار", source: "inspector" },
      sources,
      null,
    );
    expect(inspector?.name).toBe("أحمد سعيد");
    expect(missingFieldPromptText({ label: "وصف العقار", source: "inspector" }, inspector!)).toBe(
      "إشعار أحمد سعيد (المعاين) بنقص «وصف العقار»؟",
    );

    const company = responsibleForMissingCell(
      { label: "رقم ترخيص مزاولة المهنة", source: "org", section: "company" },
      null,
      editors,
    );
    expect(company).toEqual({
      name: "سليمان الصالحي",
      roleLabel: "إعدادات المنشأة — بيانات المنشأة",
      canNotify: true,
    });
  });

  it("waits for the right lookup and never asks about the appraiser's own fields", () => {
    expect(responsibleForMissingCell({ label: "رقم الطلب", source: "intake" }, null, editors)).toBeNull();
    expect(
      responsibleForMissingCell({ label: "القيمة المرجّحة", source: "appraiser", tab: "final" }, sources, editors),
    ).toBeNull();
  });

  it("explains a source with nobody to ask and falls back to the role name", () => {
    const survey = responsibleForMissingCell({ label: "طول الضلع (الجهة الشمالية)", source: "survey" }, sources, null)!;
    expect(survey.canNotify).toBe(false);
    expect(missingFieldNoResponsibleText({ label: "طول الضلع (الجهة الشمالية)", source: "survey" })).toContain(
      "المكتب الهندسي",
    );
    expect(missingFieldPromptText({ label: "x", source: "survey" }, { ...survey, canNotify: true })).toBe(
      "إشعار المكتب الهندسي بنقص «x»؟",
    );
    expect(missingFieldNotifiedToast({ label: "x", source: "survey" }, "", "المكتب الهندسي")).toBe(
      "تم إشعار المكتب الهندسي بنقص «x»",
    );
  });

  it("turns API failures into Arabic messages", () => {
    expect(missingFieldNotifyError({ kind: "validation", errors: { _: "لا يوجد المعاين مسند" } })).toBe(
      "لا يوجد المعاين مسند",
    );
    expect(missingFieldNotifyError({ kind: "validation", message: "قسم الإعدادات غير معروف." })).toBe(
      "قسم الإعدادات غير معروف.",
    );
    expect(missingFieldNotifyError({ kind: "forbidden" })).toContain("صلاحية");
    expect(missingFieldNotifyError({ kind: "network" })).toContain("أعد المحاولة");
  });
});
