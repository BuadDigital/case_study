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
import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";
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
// Weekday first: «الأربعاء، ٣٠‏/٩‏/٢٠٢٦، ٣:٣٣ م». The calendar is pinned to
// Gregorian so the row reads the same on every runtime.
const AT_FORMATTER = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  weekday: "long",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
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
  const isDesktopViewport = useViewportDesktop();
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
                    { header: "التاريخ والوقت", value: (r) => formatAt(r.createdAtUtc) },
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
          <EmptyState line="تعذّر تحميل سجل التدقيق. حاول التحديث مرة أخرى." />
        </section>
      ) : entries.length === 0 ? (
        <section className={opsLetterCard}>
          <EmptyState line="لا توجد أحداث مسجّلة بعد." />
        </section>
      ) : (
        <>
          {isDesktopViewport === true ? null : (
            // Phones: one card per event — the 5-column table clipped «الإجراء».
            <ul className="m-0 flex list-none flex-col gap-2 p-0 lg:hidden">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-[12px] border border-border bg-surface px-3.5 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 text-[13.5px] font-bold text-heading">
                      {auditActionLabel(entry.action)}
                    </span>
                    <span
                      className="shrink-0 text-[11.5px] font-semibold text-text-2"
                      title={entry.actorId}
                    >
                      {auditActorLabel(
                        entry.actorId,
                        actorNames,
                        entry.actorDisplayName,
                      )}
                    </span>
                  </div>
                  <div className="mt-1 text-[12px] text-text-3">
                    <bdi>{formatAt(entry.createdAtUtc)}</bdi>
                  </div>
                  <div
                    className="mt-1 truncate text-[12.5px] text-text-2"
                    title={`${entry.entityType} · ${entry.entityId}`}
                  >
                    {auditEntityLabel(entry.entityType, entry.entityId)}
                  </div>
                  <p className="m-0 mt-1 line-clamp-3 text-[12.5px] leading-snug text-text-2">
                    {auditDetailSummary(entry.action, entry.before, entry.after)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {isDesktopViewport === false ? null : (
        <TableFrame className={cn(opsLetterCard, "hidden lg:block")}>
          <Table wrapClassName="min-w-[860px]">
            <THead>
              <Tr hoverable={false}>
                <Th className="w-[205px] whitespace-nowrap">التاريخ والوقت</Th>
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
        </>
      )}
    </PageShell>
  );
}
