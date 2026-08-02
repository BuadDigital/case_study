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
import {
  Button,
  EmptyState,
  InlineLoadingSkeleton,
  PageGutter,
  PageShell,
  PageShellHeader,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@platform/design-system";

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
      <PageShell>
        <PageGutter>
          <EmptyState line="سجل التدقيق غير مفعّل في هذا البيئة." />
        </PageGutter>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageShellHeader
        title="سجل التدقيق"
        meta={`سجل مركزي دائم للإجراءات المهمة داخل النظام · ${total} حدث`}
      />
      <PageGutter>
        <Can capability="manage-system-config">
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void refresh()}
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? "جارٍ التحديث…" : "تحديث"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
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
            </Button>
          </div>
        </Can>
        {loading ? (
          <InlineLoadingSkeleton />
        ) : failed ? (
          <EmptyState line="تعذر تحميل سجل التدقيق. حاول التحديث مرة أخرى." />
        ) : entries.length === 0 ? (
          <EmptyState line="لا توجد أحداث مسجّلة بعد." />
        ) : (
          <Table>
            <THead>
              <Tr hoverable={false}>
                <Th>الوقت</Th>
                <Th>المستخدم</Th>
                <Th>الإجراء</Th>
                <Th>الكيان</Th>
                <Th>التفاصيل</Th>
              </Tr>
            </THead>
            <TBody>
              {entries.map((entry) => (
                <Tr key={entry.id} hoverable={false}>
                  <Td className="whitespace-nowrap">{formatAt(entry.createdAtUtc)}</Td>
                  <Td>{entry.actorId}</Td>
                  <Td>{entry.action}</Td>
                  <Td>{entry.entityType} · {entry.entityId}</Td>
                  <Td className="max-w-xl truncate text-text-3" title={formatDetail(entry)}>
                    {formatDetail(entry)}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </PageGutter>
    </PageShell>
  );
}
