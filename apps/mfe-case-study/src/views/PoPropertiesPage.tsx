"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Note,
  PageGutter,
  PageShell,
  PageShellHeader,
  EmptyState,
  StatusBadge,
  Table,
  TBody,
  Td,
  TdAction,
  Th,
  ThAction,
  THead,
  Tr,
  cn,
  PanelSkeleton,
  type BadgeTone,
} from "@platform/design-system";
import { RowMoreMenu } from "@case-study/mfe/components/ui/RowMoreMenu";
import type { RowMoreMenuItem } from "@case-study/mfe/components/ui/RowMoreMenu";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import { ltrValueClass } from "../components/po-intake/PropertyDetailFields";
import { CopyFromPriorTransactionModal } from "../components/po-intake/CopyFromPriorTransactionModal";
import {
  formatDateAr,
  formatPropertyLocation,
  formatPropertyTypeLine,
  hasBourseDetailFields,
  isPastDue,
  requiresAssignmentDecree,
} from "../lib/prototype/po-intake-data";
import {
  poPropertyPath,
  poListPath,
} from "../lib/po-routes";
import { poPropertyToPropertyRow, buildCopyPriorTargetOptions } from "../lib/prototype/po-intake-storage";
import {
  buildPoPropertiesRowMoreItems,
  type PoPropertyRowMoreContext,
} from "../lib/prototype/po-properties-row-menu";
import { formatDeliveryRemainingLabel } from "../lib/prototype/my-task-row";
import { usePoRecordQuery, useWorkflowTasksQuery } from "@case-study/mfe/query/case-study-queries";
import {
  canEditProperty,
  canRaisePropertyFailure,
  canViewPoEye,
} from "../lib/prototype/po-roles";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import type { PoPropertyIntake } from "../lib/prototype/po-intake-data";

function assignmentTypeBadgeTone(type: string): BadgeTone {
  if (type === "تنفيذ") return "info";
  if (type === "تركات") return "warning";
  if (type === "قطاع خاص") return "primary";
  return "default";
}

function deedLabel(property: PoPropertyIntake): string {
  return property.deedNumber.trim() || "—";
}

function isDueSoon(iso: string): boolean {
  if (!iso) return false;
  const due = new Date(iso.slice(0, 10));
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

/** DD/MM/YYYY plus HH:mm when present in ISO or a separate time field. */
function formatDateTimeAr(iso: string, separateTime?: string): string {
  if (!iso) return "—";
  const date = formatDateAr(iso);
  const extra = separateTime?.trim();
  if (extra) return `${date} ${extra}`;
  const timeMatch = iso.trim().match(/T(\d{2}:\d{2})/);
  return timeMatch ? `${date} ${timeMatch[1]}` : date;
}

function BackIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export function PoPropertiesPage({
  poNumber,
  buildPropertyRowMoreItems,
}: {
  poNumber: string;
  /** Shell may append role-specific items (e.g. appraiser recall). */
  buildPropertyRowMoreItems?: (
    ctx: PoPropertyRowMoreContext,
  ) => RowMoreMenuItem[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { role } = usePrototype();
  const showEdit = canEditProperty(role);
  const showFailureRaise = canRaisePropertyFailure(role);
  const showEye = canViewPoEye(role);
  const showRowMenu =
    showEye || showEdit || showFailureRaise || Boolean(buildPropertyRowMoreItems);
  const [menuRevision, setMenuRevision] = useState(0);
  const bumpMenu = useCallback(() => setMenuRevision((n) => n + 1), []);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyInitialTargetKey, setCopyInitialTargetKey] = useState<
    string | null
  >(null);

  const { data: record, isPending } = usePoRecordQuery(poNumber);
  const { data: workflowTasks = [] } = useWorkflowTasksQuery();

  const copyTargets = useMemo(
    () =>
      record
        ? buildCopyPriorTargetOptions(record, workflowTasks)
        : [],
    [record, workflowTasks],
  );

  const openCopyModal = useCallback((targetKey?: string | null) => {
    setCopyInitialTargetKey(targetKey ?? null);
    setCopyModalOpen(true);
  }, []);

  const handleCopiedFromPrior = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: prototypeKeys.poRecord(poNumber),
    });
    void queryClient.invalidateQueries({
      queryKey: prototypeKeys.workflowTasks(),
    });
    void queryClient.invalidateQueries({
      queryKey: prototypeKeys.pendingBourseItems(),
    });
    void queryClient.invalidateQueries({
      queryKey: prototypeKeys.propertyListItems(),
    });
  }, [queryClient, poNumber]);

  const resolveRowMoreItems = useCallback(
    (property: PoPropertyIntake): RowMoreMenuItem[] => {
      void menuRevision;
      const ctx: PoPropertyRowMoreContext = {
        poNumber,
        property,
        showEdit: showEdit && !property.isRemoved,
        showFailureRaise: showFailureRaise && !property.isRemoved,
        router,
        onCopyFromPrior:
          showEdit && !property.isRemoved
            ? () => openCopyModal(`property:${property.id}`)
            : undefined,
      };
      const base = buildPoPropertiesRowMoreItems(ctx);
      const extra = buildPropertyRowMoreItems?.(ctx) ?? [];
      const ids = new Set(base.map((i) => i.id));
      const merged = [...base];
      for (const item of extra) {
        if (!ids.has(item.id)) merged.push(item);
      }
      return merged;
    },
    [
      poNumber,
      showEdit,
      showFailureRaise,
      router,
      bumpMenu,
      buildPropertyRowMoreItems,
      menuRevision,
      openCopyModal,
    ],
  );

  if (isPending && !record) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
        <PanelSkeleton className="m-2" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
        <PageGutter className="py-6">
          <Note tone="warn">
            لم يُعثر على أمر العمل.
            <div className="mt-3">
              <Button
                size="sm"
                variant="default"
                onClick={() => router.push(poListPath())}
              >
                رجوع لأوامر العمل
              </Button>
            </div>
          </Note>
        </PageGutter>
      </div>
    );
  }

  const showDecree = requiresAssignmentDecree(record.assignmentType);
  const priorByDeed = new Map<string, string>();
  const count = record.properties.filter((p) => !p.isRemoved).length;
  const expected = record.expectedPropertyCount ?? count;
  const dueUrgent = record.dueDateAt
    ? isPastDue(record.dueDateAt) || isDueSoon(record.dueDateAt)
    : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
      <PageShell>
        <PageShellHeader
          actions={
            showEdit ? (
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => openCopyModal(null)}
              >
                نسخ من معاملة سابقة
              </Button>
            ) : undefined
          }
        >
          <Link
            href={poListPath()}
            className="mb-2 inline-flex w-fit items-center gap-1.5 py-1 text-[11px] font-medium text-text-2 no-underline transition-colors hover:text-primary [&_svg]:-scale-x-100"
          >
            <BackIcon />
            <span>أوامر العمل</span>
          </Link>
          <h1 className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base font-bold leading-snug text-text">
            <span>عقارات</span>
            <PoNumber
              value={record.poNumber}
              className="text-primary"
            />
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-2">
            <Badge tone={assignmentTypeBadgeTone(record.assignmentType)}>
              {record.assignmentType}
            </Badge>
            <span className="select-none text-text-3" aria-hidden>
              ·
            </span>
            <span className="font-medium text-text-2">
              {count} من {expected}{" "}
              {expected === 1 ? "عقار" : "عقارات"}
            </span>
          </div>
          <div
            className="mt-3 flex flex-nowrap gap-0 overflow-x-auto pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:h-0"
            aria-label="ملخص أمر العمل"
          >
            <div className="shrink-0 pe-4 ps-0">
              <div className="mb-0.5 text-[11px] text-text-3">اسم الأخصائي</div>
              <div className="text-[13px] font-medium text-text">
                {record.assignmentSpecialist.trim() || "—"}
              </div>
            </div>
            <div className="shrink-0 border-s border-border px-4">
              <div className="mb-0.5 text-[11px] text-text-3">استلام إنفاذ</div>
              <div className="text-[13px] font-medium text-text">
                {record.receivedFromEnfathAt ? (
                  <bdi dir="ltr" className={ltrValueClass}>
                    {formatDateTimeAr(
                      record.receivedFromEnfathAt,
                      record.receivedFromEnfathTime,
                    )}
                  </bdi>
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div className="shrink-0 border-s border-border px-4">
              <div className="mb-0.5 text-[11px] text-text-3">تاريخ الاستحقاق</div>
              <div
                className={cn(
                  "text-[13px] font-medium",
                  dueUrgent ? "text-red" : "text-text",
                )}
              >
                {record.dueDateAt ? (
                  <bdi dir="ltr" className={ltrValueClass}>
                    {formatDateTimeAr(record.dueDateAt)}
                  </bdi>
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div className="shrink-0 border-s border-border px-4">
              <div className="mb-0.5 text-[11px] text-text-3">المتبقي للتسليم</div>
              <div
                className={cn(
                  "text-[13px] font-medium",
                  dueUrgent ? "text-red" : "text-text",
                )}
              >
                {formatDeliveryRemainingLabel(record.dueDateAt)}
              </div>
            </div>
            </div>
        </PageShellHeader>

        {count === 0 ? (
          <EmptyState line="لا توجد عقارات في هذا الأمر." />
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <Table>
                <THead>
                  <Tr hoverable={false}>
                    <Th>رقم الصك</Th>
                    <Th>الموقع</Th>
                    <Th>المحكمة / الدائرة</Th>
                    <Th>التصنيف / النوع</Th>
                    <Th>حالة الصك</Th>
                    <Th>الحالة</Th>
                    {showRowMenu ? (
                      <ThAction aria-label="المزيد" />
                    ) : null}
                  </Tr>
                </THead>
                <TBody>
                  {record.properties.map((prop, index) => {
                    const row = poPropertyToPropertyRow(
                      record,
                      prop,
                      priorByDeed,
                      workflowTasks,
                    );
                    const boursePending = !prop.bourseDataCompleted;
                    const locRaw = formatPropertyLocation(prop);
                    const location =
                      locRaw === "بانتظار البورصة" &&
                      !hasBourseDetailFields(prop)
                        ? "—"
                        : locRaw === "بانتظار البورصة"
                          ? "—"
                          : locRaw;
                    const typeLine = formatPropertyTypeLine(prop);
                    const typeDisplay =
                      boursePending && !hasBourseDetailFields(prop)
                        ? "بانتظار البورصة"
                        : typeLine || "—";
                    const courtCircuit =
                      [prop.court.trim(), prop.circuit.trim()]
                        .filter(Boolean)
                        .join(" · ") || "—";
                    const detailHref = poPropertyPath(poNumber, prop.id);
                    const label = deedLabel(prop);

                    return (
                      <Tr
                        key={prop.id}
                        hoverable={false}
                        className="cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--info-bg)_40%,var(--surface))]"
                        onClick={() => router.push(detailHref)}
                      >
                        <Td>
                          <span className="inline-flex min-w-0 items-center justify-end gap-2">
                            <span
                              className="inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-md bg-surface-3 text-[10px] font-semibold text-text-3"
                              aria-hidden
                            >
                              {index + 1}
                            </span>
                            <span
                              dir="ltr"
                              className="inline-block text-[13px] font-medium text-primary"
                            >
                              {label}
                            </span>
                          </span>
                        </Td>
                        <Td className="text-text-2">{location}</Td>
                        <Td className="text-text-2">{courtCircuit}</Td>
                        <Td>{typeDisplay}</Td>
                        <Td className="text-text-2">
                          {prop.deedStatus || "—"}
                        </Td>
                        <Td>
                          {prop.isRemoved ? (
                            <div className="flex flex-col items-start gap-0.5">
                              <StatusBadge status="removed" />
                              {prop.removalReason.trim() ? (
                                <span className="text-[11px] font-medium text-danger-text">
                                  {prop.removalReason.trim()}
                                </span>
                              ) : null}
                            </div>
                          ) : boursePending ? (
                            <Badge tone="warning">بانتظار البورصة</Badge>
                          ) : (
                            <StatusBadge status={row.status} />
                          )}
                        </Td>
                        {showRowMenu ? (
                          <TdAction onClick={(e) => e.stopPropagation()}>
                            <RowMoreMenu items={resolveRowMoreItems(prop)} />
                          </TdAction>
                        ) : null}
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </div>
            {showDecree ? (
              <p className="px-4 py-2 pb-3 text-[11px] text-text-3 sm:px-6">
                مسار التنفيذ — قرار إسناد مستقل لكل صك.
                {showRowMenu
                  ? " اضغط الصف للتفاصيل أو ⋮ للإجراءات."
                  : " اضغط الصف للتفاصيل."}
              </p>
            ) : (
              <p className="px-4 py-2 pb-3 text-[11px] text-text-3 sm:px-6">
                {showRowMenu
                  ? "اضغط الصف لمعاينة العقار أو ⋮ للإجراءات (تفاصيل · طلب استرجاع المعاملة…)."
                  : "اضغط الصف لمعاينة تفاصيل العقار."}
              </p>
            )}
          </>
        )}
      </PageShell>

      {showEdit ? (
        <CopyFromPriorTransactionModal
          open={copyModalOpen}
          poNumber={poNumber}
          targets={copyTargets}
          initialTargetKey={copyInitialTargetKey}
          lockTarget={Boolean(copyInitialTargetKey)}
          onClose={() => {
            setCopyModalOpen(false);
            setCopyInitialTargetKey(null);
          }}
          onCopied={handleCopiedFromPrior}
        />
      ) : null}
    </div>
  );
}
