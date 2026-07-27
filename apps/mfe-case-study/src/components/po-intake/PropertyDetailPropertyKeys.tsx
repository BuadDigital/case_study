"use client";

import {
  EmptyState,
  FieldBox,
  FieldsGrid,
  InfoBox,
  SectionHeader,
  DetailBadge,
  ltrValueClass,
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

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[10px] border border-border bg-surface-2 px-3.5 py-3">
      <div className="mb-1 text-[10.5px] text-text-3">{label}</div>
      <div className="text-[13px] font-bold text-heading">{value || "—"}</div>
      {hint ? (
        <div className="mt-1 text-[11px] text-text-3">{hint}</div>
      ) : null}
    </div>
  );
}

function GatewayPill({
  label,
  active,
  tone = "gray",
}: {
  label: string;
  active?: boolean;
  tone?: "gray" | "teal" | "amber" | "red";
}) {
  return (
    <span
      className={
        active
          ? undefined
          : "rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] text-text-3"
      }
    >
      {active ? <DetailBadge tone={tone}>{label}</DetailBadge> : label}
    </span>
  );
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

  const requestNumber = property.requestNumber.trim();
  const hasKeysData =
    Boolean(keysStatus) ||
    Boolean(keysDescription.trim()) ||
    Boolean(court);

  const fieldMatch = keysStatus.includes("مطابق")
    ? "مطابق"
    : keysStatus.includes("غير")
      ? "غير مطابق"
      : visitStatus
        ? "بانتظار"
        : "بانتظار";

  const gatewayNoKey = keysStatus.includes("بدون") || keysStatus.includes("تمكين");
  const gatewaySuspended =
    keysStatus.includes("محظر") || keysStatus.includes("إخلاء");
  const gatewayMissing =
    !keysStatus.trim() || keysStatus.includes("لا يوجد") || keysStatus.includes("لم");

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
      ) : !requestNumber ? (
        <EmptyState
          icon="🔑"
          title="لا يوجد ظرف مفاتيح مرتبط بهذا العقار بعد"
          sub="يظهر الظرف بعد تسجيل رقم الطلب وربط ظرف المفاتيح."
        />
      ) : !submission || !hasKeysData ? (
        <>
          <InfoBox icon="ℹ">
            {governmentCard.unassigned
              ? "لم يُعيَّن مراجع حكومي بعد."
              : `المراجع: ${governmentCard.name} — لم تُسجَّل بيانات المفاتيح بعد.`}
          </InfoBox>
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <SummaryCard
              label="الظرف التابع له"
              value={requestNumber || "—"}
              hint="برقم الطلب"
            />
            <SummaryCard
              label="العهدة الحالية"
              value={
                governmentCard.unassigned ? "—" : governmentCard.name || "—"
              }
              hint="المراجع الحكومي"
            />
            <SummaryCard label="نتيجة التجربة الميدانية" value="بانتظار" />
          </div>
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

          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <SummaryCard
              label="الظرف التابع له"
              value={requestNumber}
              hint="برقم الطلب"
            />
            <SummaryCard
              label="العهدة الحالية"
              value={governmentCard.name || "—"}
              hint="المراجع الحكومي"
            />
            <SummaryCard
              label="نتيجة التجربة الميدانية"
              value={fieldMatch}
            />
          </div>

          <div className="mb-4 rounded-[10px] border border-border bg-surface-2 px-3.5 py-3">
            <div className="mb-2 text-[12px] font-bold text-heading">
              بوابة حالة المفاتيح
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GatewayPill
                label="لا يوجد"
                active={gatewayMissing && !gatewayNoKey && !gatewaySuspended}
                tone="gray"
              />
              <GatewayPill
                label="تمكين بدون مفتاح"
                active={gatewayNoKey}
                tone="amber"
              />
              <GatewayPill
                label="محظر إخلاء"
                active={gatewaySuspended}
                tone="red"
              />
            </div>
            {gatewaySuspended ? (
              <p className="mt-2 mb-0 text-[11px] text-danger-text">
                العقار تحت محظر إخلاء — راجِع تعليمات المراجعة الحكومية.
              </p>
            ) : null}
          </div>

          <FieldsGrid>
            <FieldBox label="المحكمة" value={court} emptyLabel="—" />
            <FieldBox label="حالة المفاتيح" value={keysStatus} emptyLabel="—" />
            <FieldBox label="حالة الزيارة" value={visitStatus} emptyLabel="—" />
            <FieldBox
              label="تاريخ الزيارة"
              value={visitDate}
              emptyLabel="—"
              ltr
            />
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

          <div className="mt-4">
            <div className="mb-2 text-[12px] font-bold text-heading">
              التسلسل الزمني للمفتاح
            </div>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {[
                "استلام وتسجيل الظرف",
                "إسناد المفتاح للصك",
                visitStatus ? `زيارة: ${visitStatus}` : "مناولة / زيارة ميدانية",
                `التجربة الميدانية: ${fieldMatch}`,
              ].map((step, index) => (
                <li
                  key={step}
                  className="flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[12px]"
                >
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-text">
                    {step}
                    {index === 3 && visitDate ? (
                      <>
                        {" · "}
                        <bdi dir="ltr" className={ltrValueClass}>
                          {visitDate}
                        </bdi>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
