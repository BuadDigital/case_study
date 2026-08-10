"use client";

import Link from "next/link";
import {
  DetailBadge,
  EmptyState,
  FieldBox,
  FieldsGrid,
  InfoBox,
  SectionHeader,
} from "./PropertyDetailFields";
import { Badge, InlineLoadingSkeleton } from "@platform/design-system";
import {
  formatDateAr,
  formatPropertyDeedDisplay,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import {
  courtVisitResultKindLabel,
} from "../../lib/prototype/operations-task-property-scope";
import {
  operationsTaskStatusLabel,
  operationsTaskTypeLabel,
} from "../../lib/prototype/operations-task-display";
import { isActiveOperationsTask } from "../../lib/prototype/operations-tasks-storage";
import { usePropertyOperationsTasks } from "../../query/use-property-operations-tasks";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { canManageOperationsTasks } from "../../lib/prototype/operations-task-roles";

/**
 * المراجعات الحكومية — projection of court_visit ops tasks for this deed.
 */
export function PropertyDetailGovernmentReviewsTab({
  poNumber,
  property,
}: {
  poNumber: string;
  property: PoPropertyIntake;
}) {
  const { role } = usePrototype();
  const canCreate = canManageOperationsTasks(role);
  const deedNumber = property.deedNumber.trim();
  const deedDisplay = formatPropertyDeedDisplay(property) || deedNumber;

  const { courtVisits, primaryCourtVisit, isLoading, isFetching } =
    usePropertyOperationsTasks(
      { poNumber, deedNumber, deedDisplay },
      { live: true },
    );

  const createHref = `/operations-tasks?create=1&type=court_visit&scope=transaction&po=${encodeURIComponent(poNumber)}&deed=${encodeURIComponent(deedDisplay)}`;
  const listHref = "/operations-tasks";

  if (isLoading || isFetching) {
    return <InlineLoadingSkeleton />;
  }

  if (courtVisits.length === 0) {
    return (
      <>
        <EmptyState
          title="لا توجد زيارة محكمة مرتبطة"
          sub="تظهر هنا مهام «زيارة محكمة» من المهام المرتبطة بهذا الصك/أمر العمل."
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {canCreate ? (
            <Link
              href={createHref}
              className="inline-flex min-h-9 items-center justify-center rounded-lg bg-ink px-[18px] py-2 text-[12.5px] font-bold text-white no-underline max-lg:min-h-11 max-lg:w-full"
            >
              إنشاء زيارة محكمة
            </Link>
          ) : null}
          <Link
            href={listHref}
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border-md bg-surface px-[18px] py-2 text-[12.5px] font-bold text-text-2 no-underline max-lg:min-h-11 max-lg:w-full"
          >
            فتح المهام
          </Link>
        </div>
      </>
    );
  }

  const primary = primaryCourtVisit ?? courtVisits[0]!;
  const result = primary.courtVisitResult;
  const letter = primary.letterRows[0];
  const visitDoneAt =
    primary.status === "completed"
      ? primary.updatedAt?.slice(0, 10)
      : "";

  return (
    <>
      <InfoBox icon="ℹ">
        مصدر التبويب: مهام «زيارة محكمة» من{" "}
        <Link href={listHref} className="font-bold text-heading underline">
          المهام
        </Link>
        . لا يعتمد على مسار المراجعة الحكومية القديم.
      </InfoBox>

      <SectionHeader>آخر زيارة محكمة</SectionHeader>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5">
        <div>
          <div className="text-[13px] font-bold text-heading">
            {primary.displayId || primary.title}
          </div>
          <div className="mt-0.5 text-[11px] text-text-2">
            {primary.assigneeName?.trim() || "بدون منفّذ"} ·{" "}
            {operationsTaskTypeLabel(primary.type)}
          </div>
        </div>
        <DetailBadge
          tone={
            primary.status === "completed"
              ? "teal"
              : isActiveOperationsTask(primary)
                ? "amber"
                : "gray"
          }
        >
          {operationsTaskStatusLabel(primary.status)}
        </DetailBadge>
      </div>

      <FieldsGrid>
        <FieldBox
          label="المنفّذ"
          value={primary.assigneeName || "—"}
          emptyLabel="—"
        />
        <FieldBox
          label="الأولوية"
          value={primary.priority || "—"}
          emptyLabel="—"
        />
        <FieldBox
          label="الموعد"
          value={
            primary.dueAt
              ? formatDateAr(primary.dueAt.slice(0, 10))
              : "—"
          }
          emptyLabel="—"
        />
        <FieldBox
          label="تأكيد الاستلام"
          value={
            primary.receiptConfirmedAt
              ? formatDateAr(primary.receiptConfirmedAt.slice(0, 10))
              : "بانتظار"
          }
          emptyLabel="—"
        />
        {letter ? (
          <>
            <FieldBox label="المحكمة / الدائرة" value={letter.court || "—"} emptyLabel="—" />
            <FieldBox label="رقم الطلب" value={letter.request || "—"} emptyLabel="—" ltr />
            <FieldBox label="الصك" value={letter.deed || deedDisplay} emptyLabel="—" ltr />
            <FieldBox label="المالك" value={letter.owner || "—"} emptyLabel="—" />
          </>
        ) : null}
        {result?.kind ? (
          <>
            <FieldBox
              label="نتيجة الزيارة"
              value={courtVisitResultKindLabel(result.kind)}
              emptyLabel="—"
            />
            {result.other?.trim() ? (
              <FieldBox label="تفصيل آخر" value={result.other.trim()} emptyLabel="—" />
            ) : null}
            {visitDoneAt ? (
              <FieldBox
                label="تاريخ الإنجاز"
                value={formatDateAr(visitDoneAt)}
                emptyLabel="—"
                ltr
              />
            ) : null}
          </>
        ) : (
          <FieldBox label="نتيجة الزيارة" value="لم تُسجَّل بعد" emptyLabel="—" />
        )}
        {primary.linkedEnvelopeId?.trim() ? (
          <FieldBox
            label="ظرف مرتبط"
            value={primary.linkedEnvelopeId.trim()}
            emptyLabel="—"
            ltr
          />
        ) : null}
      </FieldsGrid>

      {result?.statement?.trim() ? (
        <div className="mt-3 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-xs leading-relaxed text-text-2">
          <div className="mb-1 text-[10.5px] font-semibold text-text-3">
            إفادة / بيان
          </div>
          {result.statement.trim()}
        </div>
      ) : null}

      {result?.contacts && result.contacts.length > 0 ? (
        <div className="mt-3">
          <SectionHeader>جهات اتصال (إفادة الدائرة)</SectionHeader>
          <div className="flex flex-col gap-2">
            {result.contacts.map((c, i) => (
              <div
                key={`${c.name}-${i}`}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs"
              >
                <div className="font-semibold text-heading">{c.name || "—"}</div>
                <div className="mt-0.5 text-text-2">
                  {[c.role, c.phone, c.scope].filter(Boolean).join(" · ") || "—"}
                </div>
                {c.note?.trim() ? (
                  <div className="mt-1 text-text-3">{c.note.trim()}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {courtVisits.length > 1 ? (
        <div className="mt-4">
          <SectionHeader>كل زيارات المحكمة لهذا العقار</SectionHeader>
          <div className="flex flex-col gap-2">
            {courtVisits.map((t) => (
              <Link
                key={t.id}
                href={`/operations-tasks?task=${encodeURIComponent(t.id)}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 no-underline transition-colors hover:border-border-md"
              >
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-semibold text-heading">
                    {t.displayId || t.title}
                  </div>
                  <div className="mt-0.5 text-[11px] text-text-3">
                    {t.assigneeName || "—"}
                    {t.courtVisitResult?.kind
                      ? ` · ${courtVisitResultKindLabel(t.courtVisitResult.kind)}`
                      : ""}
                  </div>
                </div>
                <Badge
                  tone={
                    t.status === "completed"
                      ? "success"
                      : isActiveOperationsTask(t)
                        ? "warning"
                        : "default"
                  }
                >
                  {operationsTaskStatusLabel(t.status)}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-3">
          <Link
            href={`/operations-tasks?task=${encodeURIComponent(primary.id)}`}
            className="text-[12.5px] font-bold text-heading underline"
          >
            فتح المهمة في المهام
          </Link>
        </p>
      )}

      {canCreate ? (
        <p className="mt-3">
          <Link
            href={createHref}
            className="text-[12px] font-semibold text-text-2 underline"
          >
            + زيارة محكمة جديدة
          </Link>
        </p>
      ) : null}
    </>
  );
}
