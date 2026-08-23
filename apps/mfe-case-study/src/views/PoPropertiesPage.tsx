"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Note,
  PageGutter,
  cn,
  PanelSkeleton,
} from "@platform/ui-kit";
import { RowMoreMenu } from "@case-study/mfe/components/ui/RowMoreMenu";
import type { RowMoreMenuItem } from "@case-study/mfe/components/ui/RowMoreMenu";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import { ltrValueClass } from "../components/po-intake/PropertyDetailFields";
import { CopyFromPriorTransactionModal } from "../components/po-intake/CopyFromPriorTransactionModal";
import {
  PpBadge,
  PpCard,
  PpCell,
  PpDeedCell,
  PpEmpty,
  PpFooterHint,
  PpGrid,
  PpHead,
  PpMeta,
  PpPo,
  PpRow,
  PpStatus,
  PpSummary,
  PpTd,
  PpTh,
  PpThead,
  PpTitle,
  assignmentTypeTone,
  deedStatusStyle,
  propertyWorkflowStatusStyle,
} from "../components/po-intake/PoPropertiesHtmlPrimitives";
import {
  assignmentCompositeTag,
  formatDateAr,
  formatPropertyLocation,
  formatPropertyTypeLine,
  hasBourseDetailFields,
  isPastDue,
} from "../lib/prototype/po-intake-data";
import { poHeaderEditPath, poPropertyPath, poListPath } from "../lib/po-routes";
import { buildCopyPriorTargetOptions } from "../lib/prototype/po-intake-storage";
import {
  buildPoPropertiesRowMoreItems,
  type PoPropertyRowMoreContext,
} from "../lib/prototype/po-properties-row-menu";
import { DeliveryCountdown } from "../components/po-intake/DeliveryCountdown";
import {
  usePoRecordQuery,
  usePropertyListItemsQuery,
  useWorkflowTasksQuery,
} from "@case-study/mfe/query/case-study-queries";
import {
  canEditPoHeader,
  canEditProperty,
  canRaisePropertyFailure,
  canViewPoEye,
} from "../lib/prototype/po-roles";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import type { PropertyWorkflowStage } from "@platform/app-shared/prototype/constants";
import { PropertyListRowStatuses } from "@platform/api-client";
import type { PoPropertyIntake } from "../lib/prototype/po-intake-data";

function deedLabel(property: PoPropertyIntake): string {
  return (
    property.deedNumber.trim() ||
    property.realEstateRegNumber.trim() ||
    "—"
  );
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
  const showHeaderEdit = canEditPoHeader(role) || showEdit;
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
  const { data: propertyListItems = [] } = usePropertyListItemsQuery();

  /** Server-authored badges — same source as dashboard / valuation lists. */
  const statusByPropertyId = useMemo(() => {
    const map = new Map<string, PropertyWorkflowStage>();
    const po = poNumber.trim();
    for (const item of propertyListItems) {
      if (item.poNumber.trim() !== po) continue;
      map.set(item.propertyId, item.row.status);
    }
    return map;
  }, [propertyListItems, poNumber]);

  const copyTargets = useMemo(
    () => (record ? buildCopyPriorTargetOptions(record, workflowTasks) : []),
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

  const visibleProperties = record.properties;
  const count = record.properties.filter((p) => !p.isRemoved).length;
  const expected = record.expectedPropertyCount ?? count;
  const dueUrgent = record.dueDateAt
    ? isPastDue(record.dueDateAt) || isDueSoon(record.dueDateAt)
    : false;
  const typeTone = assignmentTypeTone(record.assignmentType);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-bg px-4 py-5 max-lg:px-3 sm:px-[30px] sm:py-[26px]">
      <PpHead>
        {showHeaderEdit ? (
          <div className="absolute left-3 top-3 z-10">
            <RowMoreMenu
              ariaLabel="إجراءات أمر العمل"
              items={[
                {
                  id: "edit-po-header",
                  label: "تعديل أمر العمل",
                  onClick: () =>
                    router.push(poHeaderEditPath(record.poNumber)),
                },
              ]}
            />
          </div>
        ) : null}
        <PpTitle>
          <span>عقارات</span>
          <PpPo>
            <PoNumber
              value={record.poNumber}
              className="!text-[14px] font-bold text-inherit"
            />
          </PpPo>
        </PpTitle>
        <PpMeta>
          <PpBadge tone={typeTone}>
            {assignmentCompositeTag(record.assignmentType)}
          </PpBadge>
          <span className="text-text-3" aria-hidden>
            ·
          </span>
          <span>
            {count} من {expected} {expected === 1 ? "عقار" : "عقارات"}
          </span>
        </PpMeta>
        <PpSummary>
          <PpCell label="أخصائي الإسناد" first>
            {record.assignmentSpecialist.trim() || "—"}
          </PpCell>
          <PpCell label="استلام إنفاذ">
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
          </PpCell>
          <PpCell label="تاريخ الاستحقاق">
            {record.dueDateAt ? (
              <bdi
                dir="ltr"
                className={cn(ltrValueClass, dueUrgent && "text-[#d9694f]")}
              >
                {formatDateTimeAr(record.dueDateAt)}
              </bdi>
            ) : (
              "—"
            )}
          </PpCell>
          <PpCell label="المتبقي للتسليم">
            <DeliveryCountdown
              dueIso={record.dueDateAt}
              className="text-[13.5px] font-semibold"
            />
          </PpCell>
        </PpSummary>
      </PpHead>

      <PpCard>
        {visibleProperties.length === 0 ? (
          expected > 0 ? (
            <PpEmpty
              title="لم تُسجَّل عقارات هذا الأمر بعد."
              subtitle={`بانتظار تسجيل ${expected === 1 ? "عقار واحد" : `${expected} عقارات`} من قِبل أخصائي دراسة الحالة.`}
            />
          ) : (
            <PpEmpty />
          )
        ) : (
          <div className="overflow-x-auto">
            <PpGrid>
              <PpThead>
                <PpTh>رقم الصك</PpTh>
                <PpTh>الموقع</PpTh>
                <PpTh>التصنيف / النوع</PpTh>
                <PpTh>حالة الصك</PpTh>
                <PpTh>الحالة</PpTh>
                <PpTh center />
              </PpThead>
              {visibleProperties.map((prop, index) => {
                const serverStatus =
                  statusByPropertyId.get(prop.id) ?? PropertyListRowStatuses.New;
                const boursePending = !prop.bourseDataCompleted && !prop.isRemoved;
                const locRaw = formatPropertyLocation(prop);
                const location =
                  locRaw === "بانتظار البورصة"
                    ? "بانتظار البورصة"
                    : locRaw || "—";
                const typeLine = formatPropertyTypeLine(prop);
                const typeDisplay =
                  boursePending && !hasBourseDetailFields(prop)
                    ? "—"
                    : typeLine || "—";
                const detailHref = poPropertyPath(poNumber, prop.id);
                const label = deedLabel(prop);
                const workflowStyle = prop.isRemoved
                  ? propertyWorkflowStatusStyle("removed")
                  : boursePending
                    ? {
                        label: "بانتظار البورصة",
                        base: "#a67c1a",
                        fg: "#8a6a18",
                      }
                    : propertyWorkflowStatusStyle(serverStatus);
                const deedSt = prop.deedStatus.trim();

                return (
                  <PpRow
                    key={prop.id}
                    onClick={() => {
                      router.push(detailHref);
                    }}
                  >
                    <PpTd>
                      <PpDeedCell
                        index={index + 1}
                        deed={label}
                      />
                    </PpTd>
                    <PpTd muted>
                      <span className="truncate">{location}</span>
                    </PpTd>
                    <PpTd>
                      {boursePending && !hasBourseDetailFields(prop) ? (
                        <span className="text-text-2">—</span>
                      ) : (
                        <span className="truncate">{typeDisplay}</span>
                      )}
                    </PpTd>
                    <PpTd>
                      {boursePending || !deedSt ? (
                        <span className="text-text-2">—</span>
                      ) : (
                        <PpStatus label={deedSt} style={deedStatusStyle(deedSt)} />
                      )}
                    </PpTd>
                    <PpTd>
                      <div className="flex min-w-0 flex-col items-start gap-0.5">
                        <PpStatus
                          label={workflowStyle.label}
                          style={workflowStyle}
                        />
                        {prop.isRemoved && prop.removalReason.trim() ? (
                          <span className="text-[11px] font-medium text-[#c0553d]">
                            {prop.removalReason.trim()}
                          </span>
                        ) : null}
                      </div>
                    </PpTd>
                    <PpTd
                      className="justify-center overflow-visible"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {showRowMenu ? (
                        <RowMoreMenu items={resolveRowMoreItems(prop)} />
                      ) : null}
                    </PpTd>
                  </PpRow>
                );
              })}
            </PpGrid>
          </div>
        )}
      </PpCard>

      {visibleProperties.length > 0 ? <PpFooterHint /> : null}

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
