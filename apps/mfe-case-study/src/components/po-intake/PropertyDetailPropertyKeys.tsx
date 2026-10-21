"use client";

import {
  EmptyState,
  FieldBox,
  FieldsGrid,
  InfoBox,
  SectionHeader,
  DetailBadge,
} from "./PropertyDetailFields";
import {
  Badge,
  InlineLoadingSkeleton,
  cn,
  opsBtnGhost,
  type BadgeTone,
} from "@platform/ui-kit";
import { PropertyKeyGateSources, PropertyKeysStatuses } from "@platform/api-client";
import {
  formatPropertyDeedDisplay,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import {
  envelopeHolderLabelAr,
  keyHandedToInspectorText,
  keyLocationLabelAr,
} from "../../lib/app-data/property-key-custody";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import {
  courtVisitResultKindLabel,
} from "../../lib/app-data/operations-task-property-scope";
import {
  operationsTaskStatusLabel,
} from "../../lib/app-data/operations-task-display";
import { usePropertyOperationsTasks } from "../../query/use-property-operations-tasks";
import {
  keyGateSourceLabelAr,
  keysStatusLabelAr,
  resolveEnvelopeIdFromSources,
  usePropertyKeyGateQuery,
} from "../../query/use-property-key-gate-query";
import { canManageOperationsTasks } from "../../lib/app-data/operations-task-roles";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import Link from "next/link";

function keysBadgeTone(status: string): BadgeTone {
  if (status === PropertyKeysStatuses.Received) return "primary";
  if (status === PropertyKeysStatuses.Pending || status === PropertyKeysStatuses.Blocked)
    return "warning";
  if (status === PropertyKeysStatuses.NotRequired) return "default";
  return "default";
}

/**
 * Property keys — listens to key-envelope gate + court_visit ops (linked envelope).
 * «تسليم للمعاين» compares the envelope holder, or the deed's key holder, with this
 * deed's inspection task assignee (decision 2026-10-20).
 */
export function PropertyDetailPropertyKeys({
  poNumber,
  property,
  inspectionTask = null,
}: {
  poNumber: string;
  property: PoPropertyIntake;
  inspectionTask?: WorkflowTask | null;
}) {
  const { role } = useAppAccess();
  const canCreateOps = canManageOperationsTasks(role);
  const deedNumber = property.deedNumber.trim();
  const deedDisplay = formatPropertyDeedDisplay(property) || deedNumber;
  const requestNumber = property.requestNumber.trim();

  const {
    courtVisits,
    primaryCourtVisit,
    isLoading: opsLoading,
  } = usePropertyOperationsTasks(
    { poNumber, deedNumber, deedDisplay },
    { live: true },
  );

  const { data: gate, isLoading: gateLoading } = usePropertyKeyGateQuery({
    propertyId: property.id,
    poNumber,
    deedNumber,
    requestNumber: requestNumber || undefined,
    enabled: true,
  });

  // First load only — the tab re-subscribes (and may refetch) each time it is shown
  // again; blanking it for a background refetch flashed the skeleton over cached data.
  const loading = opsLoading || gateLoading;

  if (loading) return <InlineLoadingSkeleton />;

  const visitWithEnvelope =
    courtVisits.find((t) => t.linkedEnvelopeId?.trim()) ?? null;
  const envelopeId = resolveEnvelopeIdFromSources(
    gate,
    primaryCourtVisit?.linkedEnvelopeId ?? visitWithEnvelope?.linkedEnvelopeId,
  );

  const keysStatus = gate?.keysStatus ?? "";
  const keysLabel = keysStatusLabelAr(keysStatus);
  const handed = keyHandedToInspectorText(gate, {
    id: inspectionTask?.assigneeId ?? null,
    name: inspectionTask?.assigneeName ?? null,
  });
  const handedLabel = handed.text;
  const holderLabel = envelopeHolderLabelAr(
    gate?.envelopeHolderKind,
    gate?.envelopeHolderLabel,
  );
  const keyPlaceLabel = keyLocationLabelAr(gate?.keyLocation, gate?.keyHolderLabel);
  const sourceLabel = keyGateSourceLabelAr(gate?.source ?? "none");

  const primaryVisit = primaryCourtVisit;
  const resultKind = primaryVisit?.courtVisitResult?.kind;
  const visitLinkedCreate =
    resultKind === "received" && !envelopeId
      ? `/operations-tasks?task=${encodeURIComponent(primaryVisit?.id ?? "")}`
      : null;

  const createCourtHref = `/operations-tasks?create=1&type=court_visit&scope=transaction&po=${encodeURIComponent(poNumber)}&deed=${encodeURIComponent(deedDisplay)}`;
  const keysHref = envelopeId
    ? `/keys?envelope=${encodeURIComponent(envelopeId)}`
    : "/keys";

  const hasAny =
    Boolean(keysStatus) ||
    Boolean(envelopeId) ||
    Boolean(primaryVisit) ||
    gate?.source === PropertyKeyGateSources.CourtAccess;

  if (!hasAny) {
    return (
      <>
        <EmptyState
          title="لا بيانات مفاتيح بعد"
          sub="تُجلب الحالة من ظرف المفاتيح (إدارة المفاتيح) وزيارات المحكمة في المهام."
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {canCreateOps ? (
            <Link
              href={createCourtHref}
              className="inline-flex min-h-9 items-center justify-center rounded-lg bg-ink px-[18px] py-2 text-[12.5px] font-bold text-white no-underline max-lg:min-h-11 max-lg:w-full"
            >
              إنشاء زيارة محكمة
            </Link>
          ) : null}
          <Link
            href="/keys"
            className={cn(opsBtnGhost, "min-h-9 rounded-lg py-2 text-[12.5px] font-bold no-underline max-lg:min-h-11 max-lg:w-full")}
          >
            إدارة المفاتيح
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <InfoBox icon="ℹ">
        مصدر التبويب: بوابة المفاتيح (الظرف / تمكين المحكمة) + ربط مهام زيارة
        المحكمة — وليس حزمة المراجعة الحكومية القديمة.
      </InfoBox>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5">
        <div>
          <div className="text-[13px] font-bold text-heading">حالة المفاتيح</div>
          <div className="mt-0.5 text-[11px] text-text-2">
            المصدر: {sourceLabel}
            {primaryVisit?.assigneeName
              ? ` · آخر زيارة: ${primaryVisit.assigneeName}`
              : ""}
          </div>
        </div>
        <Badge tone={keysBadgeTone(keysStatus)}>{keysLabel}</Badge>
      </div>

      <SectionHeader>ملخص</SectionHeader>
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <SummaryCard label="حالة المفاتيح" value={keysLabel} />
        <SummaryCard label="تسليم للمُعاين" value={handedLabel} />
        <SummaryCard
          label="جاهز للمعاينة (مفتاح)"
          value={gate?.keyAvailable ? "نعم" : "لا"}
        />
      </div>

      <FieldsGrid>
        {gate?.source === PropertyKeyGateSources.Envelope ? (
          <>
            <FieldBox label="الظرف عند" value={holderLabel} emptyLabel="—" />
            <FieldBox label="مفتاح هذا الصك" value={keyPlaceLabel} emptyLabel="—" />
          </>
        ) : null}
        <FieldBox
          label="رقم الطلب"
          value={gate?.requestNumber?.trim() || requestNumber || "—"}
          emptyLabel="—"
          ltr
        />
        <FieldBox
          label="رقم الصك"
          value={gate?.deedNumber?.trim() || deedDisplay}
          emptyLabel="—"
          ltr
        />
        <FieldBox label="مصدر الحالة" value={sourceLabel} emptyLabel="—" />
        <FieldBox
          label="حالة الإسناد"
          value={gate?.assignmentStatus?.trim() || "—"}
          emptyLabel="—"
        />
        {envelopeId ? (
          <FieldBox label="معرّف الظرف" value={envelopeId} emptyLabel="—" ltr />
        ) : null}
        {gate?.studyHoldStatus && gate.studyHoldStatus !== "none" ? (
          <FieldBox
            label="إيقاف دراسة"
            value={gate.studyHoldStatus}
            emptyLabel="—"
          />
        ) : null}
      </FieldsGrid>

      {gate?.envelopeMissingWarning ? (
        <div className="mt-3 rounded-lg border border-amber border-e-[3px] border-e-amber bg-amber-light px-3.5 py-2.5 text-xs text-amber-text">
          تنبيه: يُتوقع وجود ظرف للمفاتيح ولم يُربط بعد.
        </div>
      ) : null}

      {resultKind === "received" && !envelopeId ? (
        <div className="mt-3 rounded-lg border border-amber border-e-[3px] border-e-amber bg-amber-light px-3.5 py-2.5 text-xs text-amber-text">
          نتيجة الزيارة: استلام ظرف — سجّل الظرف من المهام («تسجيل الظرف
          الآن») لربط الحالة.
          {visitLinkedCreate ? (
            <>
              {" "}
              <Link href={visitLinkedCreate} className="font-bold underline">
                فتح المهمة
              </Link>
            </>
          ) : null}
        </div>
      ) : null}

      {primaryVisit ? (
        <div className="mt-4">
          <SectionHeader>زيارة المحكمة المرتبطة</SectionHeader>
          <div className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-heading">
                {primaryVisit.displayId || primaryVisit.title}
              </span>
              <DetailBadge
                tone={
                  primaryVisit.status === "completed" ? "teal" : "amber"
                }
              >
                {operationsTaskStatusLabel(primaryVisit.status)}
              </DetailBadge>
            </div>
            <div className="mt-1 text-text-2">
              {primaryVisit.assigneeName || "—"}
              {resultKind
                ? ` · ${courtVisitResultKindLabel(resultKind)}`
                : ""}
              {primaryVisit.linkedEnvelopeId
                ? ` · ظرف: ${primaryVisit.linkedEnvelopeId}`
                : ""}
            </div>
            <p className="mt-2 mb-0">
              <Link
                href={`/operations-tasks?task=${encodeURIComponent(primaryVisit.id)}`}
                className="font-bold text-heading underline"
              >
                فتح في المهام
              </Link>
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={keysHref}
          className="inline-flex min-h-9 items-center justify-center rounded-lg bg-ink px-[18px] py-2 text-[12.5px] font-bold text-white no-underline max-lg:min-h-11"
        >
          {envelopeId ? "فتح الظرف في إدارة المفاتيح" : "إدارة المفاتيح"}
        </Link>
        {canCreateOps && courtVisits.length === 0 ? (
          <Link
            href={createCourtHref}
            className={cn(opsBtnGhost, "min-h-9 rounded-lg py-2 text-[12.5px] font-bold no-underline max-lg:min-h-11")}
          >
            إنشاء زيارة محكمة
          </Link>
        ) : null}
      </div>
    </>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[10px] border border-border bg-surface-2 px-3.5 py-3">
      <div className="mb-1 text-[10.5px] text-text-3">{label}</div>
      <div className="text-[13px] font-bold text-heading">{value || "—"}</div>
    </div>
  );
}
