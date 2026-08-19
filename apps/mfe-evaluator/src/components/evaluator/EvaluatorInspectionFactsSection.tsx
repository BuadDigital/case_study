"use client";

import { useEffect, useState } from "react";
import {
  INSPECTOR_FEATURE_FIELDS,
  type InspectorWorkspaceDraft,
} from "@case-study/mfe/lib/prototype/inspector-workspace-data";
import { fetchInspectorWorkspace } from "@case-study/mfe/lib/prototype/inspector-workspace-storage";
import { EvaluatorCopyField } from "./EvaluatorChecklistTab";
import { EngInfo, EngSection } from "./EvaluatorHtmlPrimitives";

function filled(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function EvaluatorInspectionFactsSection({
  inspectionTaskId,
}: {
  inspectionTaskId?: string | null;
}) {
  const [workspace, setWorkspace] = useState<InspectorWorkspaceDraft | null>(
    null,
  );
  const [loading, setLoading] = useState(Boolean(inspectionTaskId));

  useEffect(() => {
    let cancelled = false;
    if (!inspectionTaskId) {
      setWorkspace(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchInspectorWorkspace(inspectionTaskId)
      .then((draft) => {
        if (!cancelled) {
          setWorkspace(draft);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [inspectionTaskId]);

  const features = INSPECTOR_FEATURE_FIELDS.map((field) => ({
    label: field.label,
    value: filled(workspace?.featureValues[field.key]),
  })).filter((row) => row.value);

  const extras = [
    { label: "تاريخ معاينة العقار", value: filled(workspace?.inspectionDate) },
    { label: "عمر العقار (سنة)", value: filled(workspace?.propertyAgeYears) },
    { label: "مساحة البناء", value: filled(workspace?.builtArea) },
    { label: "عدد الأدوار", value: filled(workspace?.buildingFloors) },
    { label: "الخدمات", value: workspace?.services?.filter(Boolean).join("، ") || null },
  ].filter((row) => row.value);

  return (
    <>
      <EngSection>معاينة العقار</EngSection>
      <EngInfo>
        معاينة العقار عمل ميداني يدخل بياناته المعاين. تظهر هنا للمقيم ليبني
        عليها تقرير التقييم — وليست استعراض تقرير التقييم.
      </EngInfo>
      {!inspectionTaskId ? (
        <p className="rounded-lg border border-dashed border-border-md bg-surface px-3 py-4 text-center text-[12px] text-text-3">
          لم تُنشأ مهمة معاينة عقار لهذه المعاملة بعد.
        </p>
      ) : loading ? (
        <p className="text-[12px] text-text-3">جاري تحميل بيانات معاينة العقار…</p>
      ) : !workspace || (features.length === 0 && extras.length === 0) ? (
        <p className="rounded-lg border border-dashed border-border-md bg-surface px-3 py-4 text-center text-[12px] text-text-3">
          لم يُدخل المعاين بيانات معاينة العقار بعد — ستظهر هنا فور إرسالها.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {extras.map((row) => (
            <EvaluatorCopyField
              key={row.label}
              label={row.label}
              value={row.value ?? "—"}
            />
          ))}
          {features.map((row) => (
            <EvaluatorCopyField
              key={row.label}
              label={row.label}
              value={row.value ?? "—"}
            />
          ))}
        </div>
      )}
    </>
  );
}
