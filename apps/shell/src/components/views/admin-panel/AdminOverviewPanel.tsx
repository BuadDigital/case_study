"use client";

/**
 * «لوحة الإدارة › نظرة عامة» — what needs the administrator's attention
 * (late orders, open failures, field devices that stopped syncing, locked
 * accounts), the latest audit events, and a shortcut to every settings screen.
 * Operational KPIs (SLA, trend) stay on the dashboard.
 */
import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listAuditLog } from "@platform/api-client/audit";
import { listStaleFieldSyncStatuses } from "@platform/api-client";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { settingsNavTreeForRole } from "@platform/app-shared/app-data/system-settings-nav";
import { useWorkOrderListCountsQuery } from "@case-study/mfe/query/case-study-queries";
import { useFailuresQuery } from "@failures/mfe/query/failures-queries";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import {
  cn,
  EmptyState,
  KpiAlertIcon,
  KpiBand,
  KpiCell,
  KpiClipboardIcon,
  KpiClockIcon,
  opsLetterCard,
  opsLetterHead,
  opsLetterSub,
  opsLetterTitle,
  Table,
  TableEmptyRow,
  TableFrame,
  TBody,
  THead,
  Td,
  Th,
  Tr,
} from "@platform/ui-kit";
import {
  auditActionLabel,
  auditActorLabel,
  auditEntityLabel,
  buildActorNameMap,
} from "@/lib/audit-log-labels";
import { formatAt } from "../AuditLogView";

const LATEST_AUDIT = 8;
const NO_COUNT_PARAMS = {};

/** «—» until loaded, never a misleading 0. */
function countOrDash(n: number | undefined): number | string {
  return n == null ? "—" : n;
}

function Section({
  title,
  sub,
  action,
  children,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn(opsLetterCard, "rounded-xl")}>
      <div className={opsLetterHead}>
        <div>
          <div className={opsLetterTitle}>{title}</div>
          {sub ? <div className={opsLetterSub}>{sub}</div> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function AdminOverviewPanel() {
  const { token } = useAuth();
  const { rolePages } = useAppAccess();
  const counts = useWorkOrderListCountsQuery(NO_COUNT_PARAMS);
  const failures = useFailuresQuery();
  const users = useStaffUsersQuery();
  const staleSync = useQuery({
    queryKey: [...appDataKeys.all, "field-sync-status", "stale"],
    queryFn: async () => {
      const result = await listStaleFieldSyncStatuses({ token: token! });
      if (!result.ok) throw new Error(result.kind);
      return result.data;
    },
    enabled: Boolean(token),
    staleTime: 60_000,
  });
  const audit = useQuery({
    queryKey: [...appDataKeys.all, "audit-log", "latest", LATEST_AUDIT],
    queryFn: () => listAuditLog({ token: token! }, { page: 1, limit: LATEST_AUDIT }),
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  const openFailures = failures.data?.filter((f) => f.status !== "resolved").length;
  const lockedAccounts = users.data?.users.filter((u) => u.status === "Locked").length;
  const staleDevices = staleSync.data?.length;
  const overdue = counts.data?.overdue;
  const actorNames = useMemo(
    () => buildActorNameMap(users.data?.users ?? []),
    [users.data?.users],
  );

  const alerts = [
    { count: overdue, text: "أوامر عمل متأخرة عن موعدها", href: "/po" },
    { count: openFailures, text: "تعذّرات لم تُحل", href: "/failures" },
    {
      count: staleDevices,
      text: "أجهزة ميدانية لم تزامن منذ أكثر من ساعتين",
      href: "/field-sync-board",
    },
    {
      count: lockedAccounts,
      text: "حسابات موقوفة",
      href: "/admin-panel?tab=accounts",
    },
  ].filter((a) => (a.count ?? 0) > 0);

  const shortcutGroups = settingsNavTreeForRole(rolePages).flatMap((node) =>
    node.type === "group" && node.id !== "admin" ? [node] : [],
  );

  return (
    <div className="flex flex-col gap-4">
      <KpiBand className="mb-0">
        <KpiCell
          first
          icon={<KpiClipboardIcon />}
          iconClass="bg-gold-soft text-gold-d"
          label="أوامر عمل نشطة"
          value={countOrDash(counts.data?.active)}
          sub={`${countOrDash(overdue)} متأخرة`}
          dot
        />
        <KpiCell
          icon={<KpiAlertIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red"
          label="تعذّرات مفتوحة"
          value={countOrDash(openFailures)}
          sub="بانتظار الحل"
        />
        <KpiCell
          icon={<KpiClockIcon />}
          iconClass="bg-surface-2 text-text-2"
          label="مزامنة ميدانية متأخرة"
          value={countOrDash(staleDevices)}
          sub="أكثر من ساعتين"
        />
        <KpiCell
          last
          icon={<KpiAlertIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red"
          label="حسابات موقوفة"
          value={countOrDash(lockedAccounts)}
          sub="تحتاج فك القفل"
        />
      </KpiBand>

      <Section title="يحتاج انتباهك" sub="ما يستدعي إجراءً الآن — اضغط للانتقال.">
        {alerts.length === 0 ? (
          <EmptyState panel line="لا تنبيهات — كل شيء على ما يرام." />
        ) : (
          <ul className="m-0 list-none divide-y divide-border p-0">
            {alerts.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className="flex items-center justify-between gap-3 px-[18px] py-3 text-[13px] text-text no-underline hover:bg-row-hover"
                >
                  <span>
                    <bdi className="font-extrabold text-heading">{a.count}</bdi>{" "}
                    {a.text}
                  </span>
                  <span aria-hidden>›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="آخر الأحداث"
        sub="أحدث ما سُجّل في سجل التدقيق."
        action={
          <Link
            href="/audit-log"
            className="text-[12.5px] font-bold text-heading no-underline hover:underline"
          >
            سجل التدقيق كاملاً ›
          </Link>
        }
      >
        <TableFrame className="rounded-none border-0">
          <Table>
            <THead>
              <Tr hoverable={false}>
                <Th>الوقت</Th>
                <Th>المستخدم</Th>
                <Th>الإجراء</Th>
                <Th>الكيان</Th>
              </Tr>
            </THead>
            <TBody>
              {audit.isError ? (
                <TableEmptyRow colSpan={4}>تعذّر تحميل سجل التدقيق.</TableEmptyRow>
              ) : !audit.data ? (
                <TableEmptyRow colSpan={4}>جاري التحميل…</TableEmptyRow>
              ) : audit.data.items.length === 0 ? (
                <TableEmptyRow colSpan={4}>لا أحداث بعد.</TableEmptyRow>
              ) : (
                audit.data.items.map((e) => (
                  <Tr key={e.id} hoverable={false}>
                    <Td>{formatAt(e.createdAtUtc)}</Td>
                    <Td>{auditActorLabel(e.actorId, actorNames, e.actorDisplayName)}</Td>
                    <Td>{auditActionLabel(e.action)}</Td>
                    <Td>{auditEntityLabel(e.entityType, e.entityId)}</Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </TableFrame>
      </Section>

      <Section title="اختصارات الإعدادات">
        <div className="grid gap-4 p-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {shortcutGroups.map((group) => (
            <div key={group.id}>
              <div className="mb-1.5 text-[12px] font-bold text-text-3">
                {group.label}
              </div>
              <ul className="m-0 list-none p-0">
                {group.items.map((item) => (
                  <li key={item.navKey}>
                    <Link
                      href={item.href}
                      className="block py-1 text-[13px] text-text no-underline hover:text-heading hover:underline"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
