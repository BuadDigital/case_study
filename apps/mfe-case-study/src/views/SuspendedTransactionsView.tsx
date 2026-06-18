"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  cn,
  Note,
  PageGutter,
  PageShell,
  StatCard,
  StatGrid,
  StatLabel,
  StatSkeleton,
  StatValue,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  TdAction,
  Th,
  ThAction,
  THead,
  Tr,
} from "@platform/design-system";
import { getAuthSession } from "@platform/auth-client";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
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

const PARTY_ASSIGNMENT_ROLE_IDS = new Set(
  Object.values(PARTY_TASK_PAGES).map((def) => def.roleId),
);

const ROW =
  "cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--info-bg)_40%,var(--surface))]";

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
  const { role, viewerEmail } = usePrototype();
  const { data: items = [], isFetched } = useSuspendedTransactionsQuery();
  const { data: poRecords = [] } = usePoRecordsQuery();
  const { data: tasks = [] } = useWorkflowTasksQuery();
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
    const mine = tasksForPartyAssignee(role, tasks, undefined, email);
    const keys = new Set(
      mine
        .filter((t) => t.propertyId)
        .map((t) => propertySuspensionKey(t.poNumber, t.propertyId!)),
    );
    return items.filter((item) =>
      keys.has(propertySuspensionKey(item.poNumber, item.propertyId)),
    );
  }, [items, role, tasks, viewerEmail]);

  const stats = useMemo(() => {
    let onTime = 0;
    let overdue = 0;
    for (const item of visibleItems) {
      const record = poByNumber.get(item.poNumber.trim());
      const remaining = resolveRemainingTime(record?.dueDateAt ?? "", now);
      if (remaining.status === "overdue") overdue += 1;
      else if (remaining.status === "active") onTime += 1;
    }
    return {
      suspended: visibleItems.length,
      onTime,
      overdue,
      total: visibleItems.length,
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
    <>
      <PageGutter className="mb-4 grid grid-cols-2 gap-2.5 pt-4 md:grid-cols-4">
        <StatGrid cols={4} className="col-span-full mb-0">
          {!isFetched ? (
            Array.from({ length: 4 }, (_, index) => (
              <StatCard key={index} accent="gray">
                <StatSkeleton />
              </StatCard>
            ))
          ) : (
            <>
          <StatCard accent="red">
            <StatLabel>معاملات معلقة</StatLabel>
            <StatValue value={stats.suspended} countUp />
          </StatCard>
          <StatCard accent="amber">
            <StatLabel>متأخرة عن الاستحقاق</StatLabel>
            <StatValue value={stats.overdue} countUp />
          </StatCard>
          <StatCard accent="default">
            <StatLabel>ضمن المهلة</StatLabel>
            <StatValue value={stats.onTime} countUp />
          </StatCard>
          <StatCard accent="gray">
            <StatLabel>الإجمالي</StatLabel>
            <StatValue value={stats.total} countUp />
          </StatCard>
            </>
          )}
        </StatGrid>
      </PageGutter>

      {!staff ? (
        <Note tone="info" className="mx-6">
          المعاملة معلّقة — لا يمكن متابعة العمل حتى رفع التعليق من مشرف دراسة
          الحالة.
        </Note>
      ) : null}
      {staff ? (
        <Note
          tone="default"
          className="mx-6 border-r-primary bg-teal-light text-teal-text"
        >
          مسار التعليق: مراجعة المشرف → تعليق المعاملة → إيقاف جميع الأطراف —
          المؤقت يستمر حتى موعد الاستحقاق.
        </Note>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border bg-bg">
        <PageShell>
          <header className="grid items-center gap-1 border-b border-border bg-gradient-to-br from-surface-2 to-surface px-4 py-2.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-2">
                {sortedItems.length > 0 ? (
                  <span className="font-medium text-text-2">
                    {sortedItems.length}{" "}
                    {sortedItems.length === 1 ? "معاملة" : "معاملات"}
                  </span>
                ) : null}
              </div>
            </div>
          </header>

          {isFetched && sortedItems.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="m-0 text-[13px] text-text-3">لا توجد معاملات معلقة.</p>
              <p className="mt-2 text-[11px] text-text-3">
                تظهر هنا بعد تعليق المعاملة من إدارة التعذرات.
              </p>
            </div>
          ) : (
            <>
              <div className="w-full overflow-x-auto">
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
                      const moreItems = buildSuspendedRowMoreItems(item, router);

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
                              className="inline-block text-[11px] font-semibold text-primary"
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
              <p className="px-6 py-2 pb-3 text-[11px] text-text-3">
                اضغط الصف لعرض تفاصيل العقار — ⋮ عقارات أمر العمل · تفاصيل
                العقار.
              </p>
            </>
          )}
        </PageShell>
      </div>
    </>
  );
}
