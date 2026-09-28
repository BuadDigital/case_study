"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listAuditLog,
  type AuditLogDto,
} from "@platform/api-client/audit";
import { exportRowsToCsv } from "@platform/app-shared/export/export-csv";
import { isFeatureEnabled } from "@platform/app-shared/feature-flags";
import { Can } from "@platform/app-shared/components/Can";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import {
  cn,
  EmptyState,
  InlineLoadingSkeleton,
  PageShell,
  Spinner,
  Table,
  TableFrame,
  TBody,
  Td,
  TdLtr,
  Th,
  THead,
  Tr,
  opsBtnGhost,
  opsLetterCard,
  opsListCount,
  opsTfNote,
  opsToolbar,
} from "@platform/ui-kit";
import {
  auditActionLabel,
  auditActorLabel,
  auditDetailSummary,
  auditDetailTooltip,
  auditEntityLabel,
  buildActorNameMap,
} from "@/lib/audit-log-labels";

// Hoisted: constructing Intl.DateTimeFormat per row is expensive.
const AT_FORMATTER = new Intl.DateTimeFormat("ar-SA", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatAt(iso: string): string {
  try {
    return AT_FORMATTER.format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AuditLogView() {
  const { token, user, displayName } = useAuth();
  const { data: staffResult } = useStaffUsersQuery();
  const actorNames = useMemo(() => {
    const map = buildActorNameMap(staffResult?.users ?? []);
    // Prefer the live session name when the actor is the signed-in user.
    const selfId = user?.id?.trim();
    const selfName = displayName?.trim() || user?.displayName?.trim();
    if (selfId && selfName) {
      map.set(selfId, selfName);
      map.set(selfId.toLowerCase(), selfName);
    }
    return map;
  }, [displayName, staffResult?.users, user?.displayName, user?.id]);
  const [entries, setEntries] = useState<AuditLogDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    try {
      const page = await listAuditLog({ token }, { page: 1, limit: 200 });
      setEntries(page.items);
      setTotal(page.total);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    void listAuditLog({ token }, { page: 1, limit: 200 })
      .then((page) => {
        if (cancelled) return;
        setEntries(page.items);
        setTotal(page.total);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!isFeatureEnabled("auditLog")) {
    return (
      <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
        <p className={cn(opsTfNote, "m-0")}>
          سجل التدقيق غير مفعّل في هذه البيئة.
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell
      variant="canvas"
      className="gap-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
      dir="rtl"
    >
      <div className={opsToolbar}>
        <Can capability="manage-system-config">
          <div className="flex flex-wrap items-center gap-2.5 max-lg:w-full">
            <button
              type="button"
              className={opsBtnGhost}
              onClick={() => void refresh()}
              disabled={loading}
              aria-busy={loading || undefined}
            >
              {loading ? <Spinner /> : null}
              <span>{loading ? "جارٍ التحديث…" : "تحديث"}</span>
            </button>
            <button
              type="button"
              className={opsBtnGhost}
              onClick={() =>
                exportRowsToCsv(
                  "audit-log",
                  [
                    { header: "الوقت", value: (r) => formatAt(r.createdAtUtc) },
                    {
                      header: "المستخدم",
                      value: (r) =>
                        auditActorLabel(
                          r.actorId,
                          actorNames,
                          r.actorDisplayName,
                        ),
                    },
                    {
                      header: "الإجراء",
                      value: (r) => auditActionLabel(r.action),
                    },
                    {
                      header: "الكيان",
                      value: (r) =>
                        auditEntityLabel(r.entityType, r.entityId),
                    },
                    {
                      header: "التفاصيل",
                      value: (r) =>
                        auditDetailSummary(r.action, r.before, r.after),
                    },
                  ],
                  entries,
                )
              }
              disabled={entries.length === 0}
            >
              تصدير CSV
            </button>
          </div>
        </Can>
        <span className={opsListCount} aria-live="polite">
          {total} حدث
        </span>
      </div>

      {loading ? (
        <InlineLoadingSkeleton />
      ) : failed ? (
        <section className={opsLetterCard}>
          <EmptyState line="تعذر تحميل سجل التدقيق. حاول التحديث مرة أخرى." />
        </section>
      ) : entries.length === 0 ? (
        <section className={opsLetterCard}>
          <EmptyState line="لا توجد أحداث مسجّلة بعد." />
        </section>
      ) : (
        <TableFrame className={opsLetterCard}>
          <Table wrapClassName="min-w-[860px]">
            <THead>
              <Tr hoverable={false}>
                <Th className="w-[150px] whitespace-nowrap">الوقت</Th>
                <Th>المستخدم</Th>
                <Th>الإجراء</Th>
                <Th>الكيان</Th>
                <Th>التفاصيل</Th>
              </Tr>
            </THead>
            <TBody>
              {entries.map((entry) => {
                const detail = auditDetailSummary(
                  entry.action,
                  entry.before,
                  entry.after,
                );
                const tip = auditDetailTooltip(entry.before, entry.after);
                return (
                  <Tr key={entry.id} hoverable={false}>
                    <TdLtr className="whitespace-nowrap text-text-2">
                      {formatAt(entry.createdAtUtc)}
                    </TdLtr>
                    <Td
                      className="font-semibold text-text-2"
                      title={entry.actorId}
                    >
                      {auditActorLabel(
                        entry.actorId,
                        actorNames,
                        entry.actorDisplayName,
                      )}
                    </Td>
                    <Td className="font-bold text-heading">
                      {auditActionLabel(entry.action)}
                    </Td>
                    <Td>
                      <span
                        className="min-w-0 truncate"
                        title={`${entry.entityType} · ${entry.entityId}`}
                      >
                        {auditEntityLabel(entry.entityType, entry.entityId)}
                      </span>
                    </Td>
                    <Td className="max-w-[22rem] text-text-2" title={tip}>
                      <span className="line-clamp-2 text-[12.5px] leading-snug">
                        {detail}
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </TableFrame>
      )}
    </PageShell>
  );
}
