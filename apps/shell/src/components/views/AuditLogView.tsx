"use client";

import { useEffect, useState } from "react";
import {
  AUDIT_LOG_CHANGED_EVENT,
  clearAuditLog,
  listAuditLogEntries,
  type AuditLogEntry,
} from "@platform/app-shared/audit/audit-log-store";
import { exportRowsToCsv } from "@platform/app-shared/export/export-csv";
import { isFeatureEnabled } from "@platform/app-shared/feature-flags";
import { Can } from "@platform/app-shared/components/Can";
import {
  Button,
  EmptyState,
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

export function AuditLogView() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    const refresh = () => setEntries(listAuditLogEntries());
    refresh();
    window.addEventListener(AUDIT_LOG_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(AUDIT_LOG_CHANGED_EVENT, refresh);
  }, []);

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
        meta="تتبع الإجراءات المهمة داخل النظام (نموذج أولي — يُخزَّن محلياً)."
      />
      <PageGutter>
        <Can capability="manage-system-config">
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                exportRowsToCsv("audit-log", [
                  { header: "الوقت", value: (r) => formatAt(r.at) },
                  { header: "المستخدم", value: (r) => r.actor },
                  { header: "الإجراء", value: (r) => r.action },
                  { header: "الكيان", value: (r) => r.entity },
                  { header: "التفاصيل", value: (r) => r.detail ?? "" },
                ], entries)
              }
              disabled={entries.length === 0}
            >
              تصدير CSV
            </Button>
            <Button
              type="button"
              size="sm"
              variant="dangerOutline"
              onClick={clearAuditLog}
              disabled={entries.length === 0}
            >
              مسح السجل
            </Button>
          </div>
        </Can>
        {entries.length === 0 ? (
          <EmptyState line="لا توجد أحداث مسجّلة بعد." />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>الوقت</Th>
                <Th>المستخدم</Th>
                <Th>الإجراء</Th>
                <Th>الكيان</Th>
                <Th>التفاصيل</Th>
              </Tr>
            </THead>
            <TBody>
              {entries.map((entry) => (
                <Tr key={entry.id}>
                  <Td className="whitespace-nowrap text-xs">{formatAt(entry.at)}</Td>
                  <Td>{entry.actor}</Td>
                  <Td>{entry.action}</Td>
                  <Td>{entry.entity}</Td>
                  <Td className="text-text-3">{entry.detail ?? "—"}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </PageGutter>
    </PageShell>
  );
}
