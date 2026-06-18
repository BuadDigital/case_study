"use client";

import {
  EmptyState,
  FieldBox,
  FieldsGrid,
  InfoBox,
  SectionHeader,
} from "./PropertyDetailFields";
import type { PropertyDetailPartySubmission } from "../../lib/prototype/property-detail-party-submissions";
import type { PropertyDetailPartyCard } from "../../lib/prototype/property-detail-parties";
import type { PoPropertyIntake } from "../../lib/prototype/po-intake-data";
import { Badge, InlineLoadingSkeleton, type BadgeTone } from "@platform/design-system";

function keysStatusBadgeTone(
  submission: PropertyDetailPartySubmission | null,
): BadgeTone {
  const statusField = submission?.fields.find((f) => f.label === "حالة المفاتيح");
  const value = statusField?.value ?? "";
  if (value.includes("استلام")) return "primary";
  if (value.includes("لم")) return "warning";
  return "default";
}

export function PropertyDetailPropertyKeys({
  property,
  governmentCard,
  submission,
  loading,
}: {
  property: PoPropertyIntake;
  governmentCard: PropertyDetailPartyCard | null;
  submission: PropertyDetailPartySubmission | null;
  loading: boolean;
}) {
  const court =
    submission?.fields.find((f) => f.label === "المحكمة")?.value?.trim() ||
    property.court?.trim() ||
    "";

  const keysStatus =
    submission?.fields.find((f) => f.label === "حالة المفاتيح")?.value ?? "";
  const keysDescription =
    submission?.remarks.find((r) => r.label === "المفاتيح / موقع الحفظ")
      ?.value ?? "";
  const accessNote =
    submission?.remarks.find((r) => r.label === "سبب التعذر / المتابعة")
      ?.value ?? "";

  const visitStatus =
    submission?.fields.find((f) => f.label === "حالة الزيارة")?.value ?? "";
  const visitDate =
    submission?.fields.find((f) => f.label === "تاريخ الزيارة")?.value ?? "";

  const hasKeysData =
    Boolean(keysStatus) ||
    Boolean(keysDescription.trim()) ||
    Boolean(court);

  return (
    <>
      <SectionHeader>مفاتيح العقار</SectionHeader>

      {loading ? (
        <InlineLoadingSkeleton />
      ) : !governmentCard?.enabled ? (
        <EmptyState
          icon="🔑"
          title="لم يُعيَّن مراجع حكومي"
          sub="يظهر سجل المفاتيح بعد توزيع المراجع الحكومي على هذا العقار."
        />
      ) : !submission || !hasKeysData ? (
        <>
          <InfoBox icon="ℹ">
            {governmentCard.unassigned
              ? "لم يُعيَّن مراجع حكومي بعد."
              : `المراجع: ${governmentCard.name} — لم تُسجَّل بيانات المفاتيح بعد.`}
          </InfoBox>
          <FieldsGrid>
            <FieldBox label="المحكمة" value={court} emptyLabel="—" />
            <FieldBox label="حالة المفاتيح" emptyLabel="لم تُحدَّد بعد" />
            <FieldBox label="حالة الزيارة" emptyLabel="—" />
            <FieldBox label="تاريخ الزيارة" emptyLabel="—" ltr />
          </FieldsGrid>
        </>
      ) : (
        <>
          <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
            <Badge tone={keysStatusBadgeTone(submission)}>
              {keysStatus || "—"}
            </Badge>
            {governmentCard.name && !governmentCard.unassigned ? (
              <span className="text-xs text-text-2">
                المراجع الحكومي: {governmentCard.name}
              </span>
            ) : null}
          </div>

          <FieldsGrid>
            <FieldBox label="المحكمة" value={court} emptyLabel="—" />
            <FieldBox label="حالة المفاتيح" value={keysStatus} emptyLabel="—" />
            <FieldBox label="حالة الزيارة" value={visitStatus} emptyLabel="—" />
            <FieldBox label="تاريخ الزيارة" value={visitDate} emptyLabel="—" ltr />
            <FieldBox
              label="المفاتيح / موقع الحفظ"
              value={keysDescription}
              span={2}
              emptyLabel="—"
            />
            {accessNote ? (
              <FieldBox
                label="سبب التعذر / المتابعة"
                value={accessNote}
                span={2}
              />
            ) : null}
          </FieldsGrid>
        </>
      )}
    </>
  );
}
