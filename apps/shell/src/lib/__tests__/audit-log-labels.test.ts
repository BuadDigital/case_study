import { describe, expect, it } from "vitest";
import {
  auditActionLabel,
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
      "تسليم معاينة ميدانية للمراجعة — أمر العمل PO-100",
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
      "اعتماد معاينة ميدانية بعد المراجعة — أمر العمل PO-100 — بواسطة أحمد",
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
    ).toBe("تعديل إعدادات الشركة — القسم: بيانات المنشأة");
  });

  it("counts valuation alert overrides", () => {
    expect(
      auditDetailSummary(
        "valuation.alert-overrides.updated",
        {},
        { alert_a: true, alert_b: true },
      ),
    ).toBe("تخطّي 2 تنبيه على التقييم");
  });
});

describe("batch 2C audit codes", () => {
  it("labels every new action", () => {
    for (const code of [
      "case-study.enfaz-handover.cleared",
      "case-study.report.issued",
      "case-study.report.reopened",
      "case-study.party-submission.returned-with-impact",
      "failures.survey-freeze.lifted",
    ]) {
      expect(auditActionLabel(code)).not.toContain("إجراء غير معروف");
    }
  });

  it("describes clearing the Enfaz handover with what was reopened", () => {
    expect(
      auditDetailSummary(
        "case-study.enfaz-handover.cleared",
        { handedOver: true },
        { reason: "ملاحظة جديدة من إنفاذ", reopenedStudy: true, reopenedValuation: false },
      ),
    ).toBe(
      "إلغاء تسليم الملف لإنفاذ — أُعيد فتح: تقرير الدراسة — السبب: ملاحظة جديدة من إنفاذ",
    );
  });

  it("describes a return with its sections and affected parties", () => {
    expect(
      auditDetailSummary(
        "case-study.party-submission.returned-with-impact",
        { status: "Submitted" },
        {
          status: "Reopened",
          poNumber: "PO-7",
          returnNote: "تصحيح المساحة",
          sections: ["area", "components"],
          affected: [{ taskId: "t1" }],
        },
      ),
    ).toBe(
      "إرجاع المعاينة للمعاين — أمر العمل PO-7 — 2 قسم للتصحيح — 1 طرف متأثر — السبب: تصحيح المساحة",
    );
  });

  it("describes lifting the survey freeze with its reason", () => {
    expect(
      auditDetailSummary(
        "failures.survey-freeze.lifted",
        null,
        { poNumber: "PO-8", reason: "عاد المالك للتعاون" },
      ),
    ).toBe("رفع إيقاف الرفع المساحي — أمر العمل PO-8 — السبب: عاد المالك للتعاون");
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
      "ترجيح التقييم",
    );
  });
});
