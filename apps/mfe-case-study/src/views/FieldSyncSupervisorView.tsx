"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listStaleFieldSyncStatuses,
  type FieldSyncStatusDto,
} from "@platform/api-client";
import { getValidAuthSession } from "@platform/auth-client";
import {
  Button,
  Note,
  PageGutter,
  PageShell,
  PageShellHeader,
  Spinner,
} from "@platform/ui-kit";

const KIND_LABELS: Record<string, string> = {
  "attachment-upload": "رفع مرفق",
  "party-submission-save": "حفظ مسودة",
  "party-submission-submit": "إرسال مهمة",
  "key-envelope-create": "تسجيل ظرف مفاتيح",
  "key-envelope-assignment-add": "إسناد ظرف",
  "key-envelope-assignment-confirm": "تأكيد إسناد",
  "key-envelope-handoff-create": "مناولة مفاتيح",
  "key-envelope-handoff-confirm": "تأكيد مناولة",
};

/**
 * Supervisor board — "pending envelopes not yet synced".
 * Shows field devices with pending offline work older than two hours.
 * Empty state is the healthy/normal case.
 */
export function FieldSyncSupervisorView() {
  const [rows, setRows] = useState<FieldSyncStatusDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const session = getValidAuthSession();
    if (!session?.token) {
      setError("يجب تسجيل الدخول");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await listStaleFieldSyncStatuses({ token: session.token });
    if (!result.ok) {
      setError(
        result.kind === "forbidden"
          ? "لا تملك صلاحية عرض لوحة المزامنة"
          : "تعذّر تحميل اللوحة",
      );
      setLoading(false);
      return;
    }
    setRows(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1">
      <PageShellHeader
        title="ظروف معلّقة لم تُزامن"
        meta="كشف خلل — عناصر ميدانية معلّقة أكثر من ساعتين"
        actions={
          <Button type="button" variant="outline" onClick={() => void refresh()}>
            تحديث
          </Button>
        }
      />
      <PageGutter className="space-y-4 pb-8">
        <Note tone="info" className="text-xs">
          في الوضع الطبيعي تكون اللوحة فارغة. يظهر هنا المعاين/المراجع عندما يبقى
          طابور الحفظ دون مزامنة أكثر من ساعتين (جهاز مطفأ · إغلاق قبل اكتمال الرفع ·
          فشل شبكة).
        </Note>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <Note tone="danger">{error}</Note>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-text-2">
            لا عناصر معلّقة — المزامنة الميدانية سليمة
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead className="bg-surface-2 text-start text-xs text-text-2">
                <tr>
                  <th className="px-3 py-2 font-semibold">المستخدم</th>
                  <th className="px-3 py-2 font-semibold">الدور</th>
                  <th className="px-3 py-2 font-semibold">معلّق</th>
                  <th className="px-3 py-2 font-semibold">العمر</th>
                  <th className="px-3 py-2 font-semibold">الأنواع</th>
                  <th className="px-3 py-2 font-semibold">آخر ظهور</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-text-1">
                      {row.displayName?.trim() || row.userId}
                    </td>
                    <td className="px-3 py-2 text-text-2">{row.roleId || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{row.pendingCount}</td>
                    <td className="px-3 py-2 text-amber-700">
                      {row.ageHours != null ? `${row.ageHours} س` : "—"}
                    </td>
                    <td className="px-3 py-2 text-text-2">
                      {row.kinds
                        .map((k) => KIND_LABELS[k] ?? k)
                        .join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-text-3 [direction:ltr]">
                      {row.lastSeenAtUtc
                        ? new Date(row.lastSeenAtUtc).toLocaleString("ar-SA")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageGutter>
    </PageShell>
  );
}
