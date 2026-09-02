"use client";

import {
  opsEmptyHint,
} from "@platform/ui-kit";

import { useEffect, useState } from "react";
import {
  isCommercialShopInspectionContext,
  isLandInspectionContext,
  type InspectorWorkspaceDraft,
  visibleInspectorFeatureFields,
} from "@case-study/mfe/lib/app-data/inspector-workspace-data";
import { fetchInspectorWorkspace } from "@case-study/mfe/lib/app-data/inspector-workspace-reads";
import { EvaluatorCopyField } from "./EvaluatorChecklistTab";
import { EngInfo, EngSection } from "./EvaluatorHtmlPrimitives";

export function inspectionFactChips(
  workspace: InspectorWorkspaceDraft | null | undefined,
): string[] {
  if (!workspace) return [];
  const chips: string[] = [];
  const add = (text: string | null | undefined) => {
    const t = (text ?? "").trim();
    if (t) chips.push(t);
  };
  const land = isLandInspectionContext({
    vacantLand: workspace.vacantLand,
    assetSubject: workspace.featureValues?.assetSubject,
  });
  const shop = isCommercialShopInspectionContext({
    vacantLand: workspace.vacantLand,
    assetSubject: workspace.featureValues?.assetSubject,
  });
  if (!land) {
  if (!shop) {
  add((workspace.roomCount ?? "").trim() ? `${workspace.roomCount.trim()} غرف` : "");
  add((workspace.hallCount ?? "").trim() ? `${workspace.hallCount.trim()} صالات` : "");
  }
  add(
    (workspace.bathroomCount ?? "").trim()
      ? `${workspace.bathroomCount.trim()} دورات مياه`
      : "",
  );
  add(
    workspace.featureValues?.hasElevator === "نعم"
      ? "مصعد"
      : workspace.featureValues?.hasElevator === "لا"
        ? "بدون مصعد"
        : "",
  );
  add(
    workspace.featureValues?.hasPool === "نعم"
      ? "مسبح"
      : workspace.featureValues?.hasPool === "لا"
        ? "بدون مسبح"
        : "",
  );
  if (!shop) {
  add(
    workspace.hasAnnex === "نعم"
      ? (workspace.annexTotal ?? "").trim()
        ? `ملاحق ${workspace.annexTotal.trim()} م²`
        : "ملاحق"
      : workspace.hasAnnex === "لا"
        ? "بدون ملاحق"
        : "",
  );
  }
  }
  add(
    workspace.hasViolations === "نعم"
      ? "مخالفات ظاهرة"
      : workspace.hasViolations === "لا"
        ? "لا مخالفات"
        : "",
  );
  add(
    (workspace.electricityMeterCount ?? "").trim()
      ? `${workspace.electricityMeterCount.trim()} عداد كهرباء`
      : "",
  );
  add(
    (workspace.waterMeterCount ?? "").trim()
      ? `${workspace.waterMeterCount.trim()} عداد ماء`
      : "",
  );
  return chips;
}

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

  const isLand = isLandInspectionContext({
    vacantLand: workspace?.vacantLand,
    assetSubject: workspace?.featureValues?.assetSubject,
  });
  const isShop = isCommercialShopInspectionContext({
    vacantLand: workspace?.vacantLand,
    assetSubject: workspace?.featureValues?.assetSubject,
  });
  const features = visibleInspectorFeatureFields(isLand).flatMap((field) => {
    const rows = [
      {
        label: field.label,
        value: filled(workspace?.featureValues[field.key]),
      },
    ];
    if (
      field.key === "movables" &&
      filled(workspace?.featureValues[field.key]) === "نعم"
    ) {
      rows.push({
        label: "وصف المنقولات",
        value: filled(workspace?.featureValues.movablesDescription),
      });
    }
    return rows;
  }).filter((row) => row.value);

  const extras = [
    { label: "تاريخ معاينة العقار", value: filled(workspace?.inspectionDate) },
    ...(isLand
      ? []
      : [
          { label: "عمر العقار (سنة)", value: filled(workspace?.propertyAgeYears) },
          { label: "مساحة البناء", value: filled(workspace?.builtArea) },
          { label: "عدد الأدوار", value: filled(workspace?.buildingFloors) },
          ...(isShop
            ? []
            : [
                { label: "عدد الغرف", value: filled(workspace?.roomCount) },
                { label: "عدد الصالات", value: filled(workspace?.hallCount) },
              ]),
          { label: "دورات المياه", value: filled(workspace?.bathroomCount) },
          ...(isShop
            ? []
            : [
                {
                  label: "ملاحق",
                  value: filled(workspace?.hasAnnex),
                },
                {
                  label: "ملحق علوي (عدد)",
                  value: filled(workspace?.annexUpperCount),
                },
                {
                  label: "ملحق أرضي (عدد)",
                  value: filled(workspace?.annexGroundCount),
                },
              ]),
        ]),
    { label: "عدادات الكهرباء", value: filled(workspace?.electricityMeterCount) },
    { label: "عدادات الماء", value: filled(workspace?.waterMeterCount) },
    {
      label: "مخالفات ظاهرة",
      value:
        workspace?.hasViolations === "نعم"
          ? [workspace.violationsCount, workspace.violationsDescription]
              .map((x) => (x ?? "").trim())
              .filter(Boolean)
              .join(" — ") || "نعم"
          : filled(workspace?.hasViolations),
    },
    { label: "الخدمات", value: workspace?.services?.filter(Boolean).join("، ") || null },
    { label: "المرافق", value: workspace?.amenities?.filter(Boolean).join("، ") || null },
  ].filter((row) => row.value);

  return (
    <>
      <EngSection>معاينة العقار</EngSection>
      <EngInfo>
        معاينة العقار عمل ميداني يدخل بياناته المعاين. تظهر هنا للمقيم ليبني
        عليها تقرير التقييم — وليست استعراض تقرير التقييم.
      </EngInfo>
      {!inspectionTaskId ? (
        <p className={opsEmptyHint}>
          لم تُنشأ مهمة معاينة عقار لهذه المعاملة بعد.
        </p>
      ) : loading ? (
        <p className="text-[12px] text-text-3">جاري تحميل بيانات معاينة العقار…</p>
      ) : !workspace || (features.length === 0 && extras.length === 0) ? (
        <p className={opsEmptyHint}>
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
