import { describe, expect, it } from "vitest";
import {
  auditActorLabel,
  auditDetailSummary,
  auditEntityTypeLabel,
} from "../audit-log-labels";

describe("auditDetailSummary", () => {
  it("describes party submission with kind and PO", () => {
    expect(
      auditDetailSummary(
        "case-study.party-submission.submitted",
        { status: "Draft" },
        {
          status: "Submitted",
          kind: "FieldInspection",
          poNumber: "PO-100",
        },
      ),
    ).toBe(
      "معاينة ميدانية: الطرف أنهى العمل وسلّمه للمراجعة — أمر العمل PO-100",
    );
  });

  it("describes party acceptance with reviewer name", () => {
    expect(
      auditDetailSummary(
        "case-study.party-submission.accepted",
        { status: "Submitted" },
        {
          status: "Accepted",
          kind: "FieldInspection",
          poNumber: "PO-100",
          acceptedBy: "أحمد",
        },
      ),
    ).toBe(
      "معاينة ميدانية: المسؤول راجع العمل واعتمده — أمر العمل PO-100 — اعتمده أحمد",
    );
  });

  it("describes distribution with child kinds", () => {
    expect(
      auditDetailSummary(
        "case-study.workflow-task.distribution-confirmed",
        { phase: "Distribution" },
        {
          phase: "CaseStudy",
          poNumber: "PO-9",
          childCount: 2,
          childKinds: ["FieldInspection", "PropertyAppraisal"],
        },
      ),
    ).toContain("معاينة ميدانية");
  });

  it("names changed organization settings sections", () => {
    expect(
      auditDetailSummary(
        "ORGANIZATION_SETTINGS_SAVED",
        { company: { nameAr: "أ" }, branding: { logoUrl: null } },
        { company: { nameAr: "ب" }, branding: { logoUrl: null } },
      ),
    ).toBe("حفظ إعدادات المنشأة — تغيّر: بيانات المنشأة");
  });

  it("counts valuation alert overrides", () => {
    expect(
      auditDetailSummary(
        "valuation.alert-overrides.updated",
        {},
        { alert_a: true, alert_b: true },
      ),
    ).toBe("تحديث تجاوزات تنبيهات التقييم (2 بند)");
  });
});

describe("auditActorLabel", () => {
  it("prefers API actorDisplayName over truncated ids", () => {
    expect(
      auditActorLabel(
        "001f71cb-aaaa-bbbb-cccc-dddddddddddd",
        undefined,
        "سليمان الصالحي",
      ),
    ).toBe("سليمان الصالحي");
  });
});

describe("auditEntityTypeLabel", () => {
  it("localizes ValuationReconciliation", () => {
    expect(auditEntityTypeLabel("ValuationReconciliation")).toBe(
      "تسوية التقييم",
    );
  });
});
