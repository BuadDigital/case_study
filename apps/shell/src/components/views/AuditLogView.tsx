"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listAuditLog,
  type AuditLogDto,
} from "@platform/api-client/audit";
import { exportRowsToCsv } from "@platform/app-shared/export/export-csv";
import { isFeatureEnabled } from "@platform/app-shared/feature-flags";
import { Can } from "@platform/app-shared/components/Can";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import { cn, InlineLoadingSkeleton, PageShell, Spinner } from "@platform/design-system";
import {
  opsBtnGhost,
  opsEmptyHint,
  opsLetterCard,
  opsLetterRow,
  opsListCount,
  opsTdPlain,
  opsTfNote,
  opsThead,
  opsThStart,
  opsToolbar,
} from "@case-study/mfe/lib/prototype/ops-tasks-tw";

const GRID_COLS =
  "[grid-template-columns:150px_1fr_1fr_1.3fr_2fr]";

function formatAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDetail(entry: AuditLogDto): string {
  try {
    return JSON.stringify({ before: entry.before, after: entry.after });
  } catch {
    return "—";
  }
}

export function AuditLogView() {
  const { token } = useAuth();
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
                exportRowsToCsv("audit-log", [
                  { header: "الوقت", value: (r) => formatAt(r.createdAtUtc) },
                  { header: "المستخدم", value: (r) => r.actorId },
                  { header: "الإجراء", value: (r) => r.action },
                  { header: "نوع الكيان", value: (r) => r.entityType },
                  { header: "معرّف الكيان", value: (r) => r.entityId },
                  { header: "التفاصيل", value: formatDetail },
                ], entries)
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
          <p className={opsEmptyHint}>
            تعذر تحميل سجل التدقيق. حاول التحديث مرة أخرى.
          </p>
        </section>
      ) : entries.length === 0 ? (
        <section className={opsLetterCard}>
          <p className={opsEmptyHint}>لا توجد أحداث مسجّلة بعد.</p>
        </section>
      ) : (
        <section className={cn(opsLetterCard, "overflow-x-auto")}>
          <div className="min-w-[860px]" dir="rtl">
            <div className={cn(opsThead, GRID_COLS)}>
              <div className={opsThStart}>الوقت</div>
              <div className={opsThStart}>المستخدم</div>
              <div className={opsThStart}>الإجراء</div>
              <div className={opsThStart}>الكيان</div>
              <div className={opsThStart}>التفاصيل</div>
            </div>
            {entries.map((entry) => (
              <div key={entry.id} className={cn(opsLetterRow, GRID_COLS)}>
                <div className={cn(opsTdPlain, "whitespace-nowrap text-text-2")}>
                  {formatAt(entry.createdAtUtc)}
                </div>
                <div className={cn(opsTdPlain, "font-semibold text-text-2")}>
                  {entry.actorId}
                </div>
                <div className={cn(opsTdPlain, "font-bold text-heading")}>
                  {entry.action}
                </div>
                <div className={opsTdPlain}>
                  <span className="min-w-0 truncate">
                    {entry.entityType} · {entry.entityId}
                  </span>
                </div>
                <div
                  className={cn(opsTdPlain, "text-text-3")}
                  title={formatDetail(entry)}
                >
                  <span className="min-w-0 truncate">{formatDetail(entry)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}
