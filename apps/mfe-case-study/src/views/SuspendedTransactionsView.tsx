"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  cn,
  EmptyState,
  KpiAlertIcon,
  KpiBand,
  KpiCell,
  KpiCheckIcon,
  KpiClipboardIcon,
  KpiClockIcon,
  MobileKpiStatCards,
  Note,
  OperationalPanel,
  PageShell,
  PageToolbar,
  QueueTableHint,
  queueTableRowClassName,
  RowMoreMenu,
  type RowMoreMenuItem,
  SkeletonTableRows,
  Table,
  TableFrame,
  TBody,
  Td,
  TdAction,
  Th,
  ThAction,
  THead,
  Tr,
} from "@platform/ui-kit";
import { getAuthSession } from "@platform/auth-client";
import { useTickingMinute } from "@platform/app-shared/hooks/use-ticking-now";
import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { PARTY_TASK_PAGES } from "@platform/app-shared/app-data/party-task-pages";
import { isSuperAdmin } from "@platform/app-shared/app-data/role-access";
import type { RoleId } from "@platform/types";
import { PoNumber } from "../components/ui/PoNumber";
import { TickingRemainingTimeCell } from "../components/ui/RemainingTimeCell";
import { InteractiveDeedCell } from "../components/ui/InteractiveDeedCell";
import {
  ActiveQueueMobileCards,
  type ActiveQueueMobileCardItem,
} from "@platform/app-shared/components/ActiveQueueMobileCards";
import {
  formatPoDisplay,
  formatPropertyDeedDisplay,
  PROPERTY_IDENTIFIER_COLUMN_LABEL,
  type PoIntakeRecord,
} from "../lib/app-data/po-intake-data";
import { remainingTimerTick, resolveRemainingTime, formatRemainingDuration } from "../lib/app-data/my-task-row";
import { poPropertiesPath, poPropertyPath } from "@platform/app-shared/domain/po-routes";
import {
  propertySuspensionKey,
  type SuspendedTransaction,
} from "../lib/app-data/suspended-transactions-model";
import { tasksForPartyAssignee } from "../lib/app-data/tasks-storage";
import { usePoRecordsQuery, useWorkflowTasksQuery } from "../query/case-study-queries";
import { useSuspendedTransactionsQuery } from "../query/suspended-transactions-queries";

const PARTY_ASSIGNMENT_ROLE_IDS = new Set(
  Object.values(PARTY_TASK_PAGES).map((def) => def.roleId),
);

const ROW = queueTableRowClassName;

function isCaseStudyStaff(role: RoleId) {
  return (
    isSuperAdmin(role) ||
    role === "case-specialist" ||
    role === "section-supervisor" ||
    role === "general-manager"
  );
}

function deedLabel(
  item: SuspendedTransaction,
  record: PoIntakeRecord | undefined,
): string {
  const property =
    record?.properties.find((p) => p.id === item.propertyId) ?? null;
  if (property) {
    const label = formatPropertyDeedDisplay(property);
    if (label !== "—") return label;
  }
  return item.deedNumber.trim() || item.title.trim() || "—";
}

function buildSuspendedRowMoreItems(
  item: SuspendedTransaction,
  router: ReturnType<typeof useRouter>,
): RowMoreMenuItem[] {
  const po = item.poNumber.trim();
  const propertyId = item.propertyId.trim();
  return [
    {
      id: "property-detail",
      label: "تفاصيل العقار",
      onClick: () => router.push(poPropertyPath(po, propertyId)),
    },
    {
      id: "po-properties",
      label: "عقارات أمر العمل",
      onClick: () => router.push(poPropertiesPath(po)),
    },
  ];
}

export function SuspendedTransactionsView() {
  const router = useRouter();
  const { role, viewerEmail, distributionAssigneeId } = useAppAccess();
  const { data: items = [], isFetched } = useSuspendedTransactionsQuery();
  const { data: poRecords = [] } = usePoRecordsQuery();
  const { data: tasks = [] } = useWorkflowTasksQuery();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  // Minute precision is enough for indicators and sort — the per-second timer lives in the timer cell
  // itself, so rows are not rebuilt every second (rerender-defer-reads).
  const nowMinuteMs = useTickingMinute();
  const now = useMemo(() => new Date(nowMinuteMs), [nowMinuteMs]);
  // After hydration mount only one tree (cards or table) — both used to be built together.
  const isDesktopViewport = useViewportDesktop();
  const [isOpening, startOpen] = useTransition();
  const [openingId, setOpeningId] = useState<string | null>(null);

  const openItem = (item: { id: string; poNumber: string; propertyId: string }) => {
    setOpeningId(item.id);
    startOpen(() => {
      router.push(poPropertyPath(item.poNumber, item.propertyId));
    });
  };

  useEffect(() => {
    if (isOpening || !openingId) return;
    const t = window.setTimeout(() => setOpeningId(null), 400);
    return () => window.clearTimeout(t);
  }, [isOpening, openingId]);

  const poByNumber = useMemo(() => {
    const map = new Map<string, PoIntakeRecord>();
    for (const record of poRecords) map.set(record.poNumber.trim(), record);
    return map;
  }, [poRecords]);

  const visibleItems = useMemo(() => {
    if (isSuperAdmin(role) || !PARTY_ASSIGNMENT_ROLE_IDS.has(role)) return items;
    const email = viewerEmail ?? getAuthSession()?.user.email;
    const mine = tasksForPartyAssignee(
      role,
      tasks,
      undefined,
      email,
      staffUsers,
      distributionAssigneeId,
    );
    const keys = new Set(
      mine
        .filter((t) => t.propertyId)
        .map((t) => propertySuspensionKey(t.poNumber, t.propertyId!)),
    );
    return items.filter((item) =>
      keys.has(propertySuspensionKey(item.poNumber, item.propertyId)),
    );
  }, [items, role, tasks, viewerEmail, distributionAssigneeId, staffUsers]);

  const stats = useMemo(() => {
    let onTime = 0;
    let overdue = 0;
    for (const item of visibleItems) {
      const record = poByNumber.get(item.poNumber.trim());
      const remaining = resolveRemainingTime(record?.dueDateAt ?? "", now);
      if (remaining.status === "overdue") overdue += 1;
      else if (remaining.status === "active") onTime += 1;
    }
    const total = visibleItems.length;
    return {
      suspended: total,
      onTime,
      overdue,
      total,
      onTimePct:
        total > 0 ? `${Math.round((onTime / total) * 100)}% من الإجمالي` : "—",
    };
  }, [visibleItems, poByNumber, now]);

  const sortedItems = useMemo(() => {
    return [...visibleItems].sort((a, b) =>
      b.suspendedAt.localeCompare(a.suspendedAt),
    );
  }, [visibleItems]);

  const staff = isCaseStudyStaff(role);
  const queuePending = !isFetched;

  const mobileCardItems = useMemo((): ActiveQueueMobileCardItem[] => {
    if (isDesktopViewport === true) return [];
    return sortedItems.map((item) => {
      const record = poByNumber.get(item.poNumber.trim());
      const remaining = resolveRemainingTime(record?.dueDateAt ?? "", now);
      const timer = formatRemainingDuration(record?.dueDateAt ?? "", now);
      const assignmentType = record?.assignmentType?.trim() || "—";
      const overdue = remaining.status === "overdue";
      const deed = deedLabel(item, record);
      return {
        id: item.id,
        title: deed.startsWith("صك") || deed === "—" ? deed : `صك ${deed}`,
        meta: [
          { text: formatPoDisplay(item.poNumber), kind: "po" as const },
          assignmentType !== "—"
            ? { text: assignmentType, kind: "type" as const }
            : null,
        ].filter((v): v is NonNullable<typeof v> => Boolean(v)),
        statusLabel: overdue ? "متأخرة" : "معلقة",
        tone: overdue ? ("returned" as const) : ("pending" as const),
        timerLabel:
          timer.remainingDuration !== "—"
            ? overdue
              ? "متأخرة"
              : `متبقي ${timer.remainingDuration}`
            : undefined,
        timerTick:
          timer.remainingDuration !== "—"
            ? remainingTimerTick(record?.dueDateAt ?? "")
            : undefined,
        timerOverdue: overdue,
        moreItems: buildSuspendedRowMoreItems(item, router),
        onOpen: () => openItem(item),
        loading: openingId === item.id,
      };
    });
  }, [isDesktopViewport, sortedItems, poByNumber, now, router, openingId]);

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1">
      <KpiBand className="mb-0 hidden lg:flex">
        <KpiCell
          first
          icon={<KpiAlertIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red"
          label="معاملات معلقة"
          value={!isFetched ? "—" : stats.suspended}
          valueClass="!text-red"
          sub={
            !isFetched
              ? "—"
              : stats.suspended > 0
                ? "بانتظار رفع التعليق"
                : "لا معاملات معلّقة"
          }
          dot
        />
        <KpiCell
          icon={<KpiClockIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#b8791a]"
          label="متأخرة عن الاستحقاق"
          value={!isFetched ? "—" : stats.overdue}
          sub={
            !isFetched
              ? "—"
              : stats.overdue > 0
                ? "تجاوزت الموعد"
                : "لا تأخير مسجّل"
          }
        />
        <KpiCell
          icon={<KpiCheckIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-success-text"
          label="ضمن المهلة"
          value={!isFetched ? "—" : stats.onTime}
          valueClass="!text-success-text"
          sub={!isFetched ? "—" : stats.onTimePct}
        />
        <KpiCell
          last
          icon={<KpiClipboardIcon />}
          iconClass="bg-info-bg text-info-text"
          label="الإجمالي"
          value={!isFetched ? "—" : stats.total}
          sub="عقارات موقوفة مؤقتاً"
        />
      </KpiBand>

      <MobileKpiStatCards
        className="mb-0"
        items={[
          {
            key: "suspended",
            label: "معاملات معلقة",
            sub: !isFetched
              ? "—"
              : stats.suspended > 0
                ? "بانتظار رفع التعليق"
                : "لا معاملات معلّقة",
            value: !isFetched ? "—" : stats.suspended,
            icon: <KpiAlertIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red",
            tone: "red",
            valueClass: "!text-red",
          },
          {
            key: "overdue",
            label: "متأخرة عن الاستحقاق",
            sub: !isFetched
              ? "—"
              : stats.overdue > 0
                ? "تجاوزت الموعد"
                : "لا تأخير مسجّل",
            value: !isFetched ? "—" : stats.overdue,
            icon: <KpiClockIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#b8791a]",
            tone: "gold",
          },
          {
            key: "onTime",
            label: "ضمن المهلة",
            sub: !isFetched ? "—" : stats.onTimePct,
            value: !isFetched ? "—" : stats.onTime,
            icon: <KpiCheckIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink",
            tone: "ink",
            valueClass: "!text-ink",
          },
          {
            key: "total",
            label: "الإجمالي",
            sub: "عقارات موقوفة مؤقتاً",
            value: !isFetched ? "—" : stats.total,
            icon: <KpiClipboardIcon />,
            iconClass: "bg-info-bg text-info-text",
            tone: "ink",
          },
        ]}
      />

      <OperationalPanel className="min-h-0 flex-1 max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none max-lg:rounded-none">
          {!staff ? (
            <PageToolbar className="border-b-0 bg-surface-2/50 max-lg:mb-2 max-lg:rounded-[14px] max-lg:border max-lg:border-border max-lg:bg-surface">
              <Note tone="info" className="m-0 flex-1">
                المعاملة معلّقة — لا يمكن متابعة العمل حتى رفع التعليق من مشرف
                دراسة الحالة.
              </Note>
            </PageToolbar>
          ) : null}

          {isFetched && sortedItems.length === 0 ? (
            <EmptyState
              line="لا توجد معاملات معلقة."
              hint="تظهر هنا بعد تعليق المعاملة من إدارة التعذرات."
            />
          ) : (
            <>
              {isDesktopViewport === true ? null : (
                <div className="pb-3 lg:hidden">
                  <ActiveQueueMobileCards
                    items={mobileCardItems}
                    pending={queuePending}
                    emptyMessage="لا توجد معاملات معلقة."
                  />
                </div>
              )}
              {isDesktopViewport === false ? null : (
              <TableFrame className="hidden lg:block">
                <Table pending={queuePending}>
                  <THead>
                    <Tr hoverable={false}>
                      <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
                      <Th>أمر العمل</Th>
                      <Th>نوع الإسناد</Th>
                      <Th>أخصائي الإسناد</Th>
                      <Th>الحالة</Th>
                      <ThAction aria-label="المزيد" />
                    </Tr>
                  </THead>
                  <TBody>
                    {queuePending && sortedItems.length === 0 ? (
                      <SkeletonTableRows rows={5} cols={6} />
                    ) : (
                      sortedItems.map((item) => {
                        const record = poByNumber.get(item.poNumber.trim());
                        const assignmentType =
                          record?.assignmentType?.trim() || "—";
                        const assignmentSpecialist =
                          record?.assignmentSpecialist?.trim() || "—";
                        const moreItems = buildSuspendedRowMoreItems(
                          item,
                          router,
                        );

                        return (
                          <Tr
                            key={item.id}
                            hoverable={false}
                            className={cn(
                              "group/atq-row",
                              ROW,
                              openingId === item.id &&
                                "ui-queue-row-opening pointer-events-none",
                            )}
                            onClick={() => openItem(item)}
                          >
                            <Td className="whitespace-nowrap">
                              <InteractiveDeedCell
                                label={deedLabel(item, record)}
                                loading={openingId === item.id}
                                labelClassName="text-[13px] font-medium"
                              />
                            </Td>
                            <Td className="text-text-2">
                              <PoNumber value={item.poNumber} link />
                            </Td>
                            <Td className="text-text-2">{assignmentType}</Td>
                            <Td
                              className="max-w-0 overflow-hidden text-ellipsis text-text-2"
                              title={assignmentSpecialist}
                            >
                              {assignmentSpecialist}
                            </Td>
                            <Td>
                              <TickingRemainingTimeCell
                                dueIso={record?.dueDateAt ?? ""}
                              />
                            </Td>
                            <TdAction>
                              <RowMoreMenu items={moreItems} />
                            </TdAction>
                          </Tr>
                        );
                      })
                    )}
                  </TBody>
                </Table>
                <QueueTableHint>
                  اضغط الصف لعرض تفاصيل العقار — ⋮ عقارات أمر العمل · تفاصيل
                  العقار.
                </QueueTableHint>
              </TableFrame>
              )}
            </>
          )}
        </OperationalPanel>
    </PageShell>
  );
}
