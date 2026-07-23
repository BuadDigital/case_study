"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  KpiBand,
  KpiCell,
  Note,
  OperationalPanel,
  PageShell,
  PageToolbar,
  QueueTableHint,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  TdAction,
  Th,
  ThAction,
  THead,
  Tr,
  queueTableRowClassName,
  queueTableWrapClassName,
} from "@platform/design-system";
import { getAuthSession } from "@platform/auth-client";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { PARTY_TASK_PAGES } from "@platform/app-shared/prototype/party-task-pages";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import type { RoleId } from "@platform/types";
import { PoNumber } from "../components/ui/PoNumber";
import { RemainingTimeCell } from "../components/ui/RemainingTimeCell";
import { RowMoreMenu } from "../components/ui/RowMoreMenu";
import type { RowMoreMenuItem } from "../components/ui/RowMoreMenu";
import {
  formatPropertyDeedDisplay,
  type PoIntakeRecord,
} from "../lib/prototype/po-intake-data";
import { resolveRemainingTime } from "../lib/prototype/my-task-row";
import { poPropertiesPath, poPropertyPath } from "../lib/po-routes";
import {
  propertySuspensionKey,
  type SuspendedTransaction,
} from "../lib/prototype/suspended-transactions-storage";
import { tasksForPartyAssignee } from "../lib/prototype/tasks-storage";
import { usePoRecordsQuery, useWorkflowTasksQuery } from "../query/case-study-queries";
import { useSuspendedTransactionsQuery } from "../query/suspended-transactions-queries";

function KpiAlertIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function KpiClockIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function KpiCheckIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function KpiClipboardIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

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
  const { role, viewerEmail, distributionAssigneeId } = usePrototype();
  const { data: items = [], isFetched } = useSuspendedTransactionsQuery();
  const { data: poRecords = [] } = usePoRecordsQuery();
  const { data: tasks = [] } = useWorkflowTasksQuery();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

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

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1">
      <KpiBand>
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

      <OperationalPanel className="min-h-0 flex-1">
          {!staff ? (
            <PageToolbar className="border-b-0 bg-surface-2/50">
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
              <div className={queueTableWrapClassName}>
                <Table pending={queuePending}>
                  <THead>
                    <Tr hoverable={false}>
                      <Th>رقم الصك</Th>
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
                        const remaining = resolveRemainingTime(
                          record?.dueDateAt ?? "",
                          now,
                        );
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
                            className={ROW}
                            onClick={() =>
                              router.push(
                                poPropertyPath(
                                  item.poNumber,
                                  item.propertyId,
                                ),
                              )
                            }
                          >
                            <Td className="whitespace-nowrap">
                              <span
                                dir="ltr"
                                className="inline-block text-[13px] font-medium text-primary"
                              >
                                {deedLabel(item, record)}
                              </span>
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
                              <RemainingTimeCell state={remaining} />
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
              </div>
              <QueueTableHint>
                اضغط الصف لعرض تفاصيل العقار — ⋮ عقارات أمر العمل · تفاصيل
                العقار.
              </QueueTableHint>
            </>
          )}
        </OperationalPanel>
    </PageShell>
  );
}
