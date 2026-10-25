"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listStaleFieldSyncStatuses,
  type FieldSyncStatusDto,
} from "@platform/api-client";
import { getValidAuthSession } from "@platform/auth-client";
import {
  Button,
  cn,
  MobileRecordCard,
  MobileRecordList,
  Note,
  PageGutter,
  PageShell,
  PageShellHeader,
  PageLoadingHint,
  Table,
  TBody,
  Td,
  TdLtr,
  Th,
  THead,
  Tr,
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

/** Display values for one device row — shared by the table and the phone cards. */
function syncRowView(row: FieldSyncStatusDto) {
  return {
    name: row.displayName?.trim() || row.userId,
    role: row.roleId || "—",
    age: row.ageHours != null ? `${row.ageHours} س` : "—",
    kinds: row.kinds.map((k) => KIND_LABELS[k] ?? k).join(" · ") || "—",
    lastSeen: row.lastSeenAtUtc
      ? new Date(row.lastSeenAtUtc).toLocaleString("ar-SA-u-nu-latn")
      : "—",
  };
}

/**
 * Supervisor board — "pending envelopes not yet synced".
 * Shows field devices with pending offline work older than two hours.
 * Empty state is the healthy/normal case.
 */
export function FieldSyncSupervisorView() {
  const [rows, setRows] = useState<FieldSyncStatusDto[]>([]);
  const [loading, setLoading] = useState(true);
  // After the first good load the minute poll and «تحديث» keep the table on
  // screen (dimmed) instead of swapping it for the loading hint each time.
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const session = getValidAuthSession();
    if (!session?.token) {
      setError("يلزم تسجيل الدخول");
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
    setLoadedOnce(true);
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
        title="ظروف بانتظار المزامنة"
        meta="كشف خلل — عناصر ميدانية بانتظار المزامنة أكثر من ساعتين"
        actions={
          <Button type="button" variant="outline" onClick={() => void refresh()}>
            تحديث
          </Button>
        }
      />
      <PageGutter className="space-y-4 pb-8">
        <Note tone="info" className="text-xs">
          في الوضع الطبيعي تكون اللوحة فارغة. يظهر هنا المعاين/المراجع عندما تبقى
          عناصره بانتظار المزامنة أكثر من ساعتين (جهاز مطفأ · إغلاق قبل اكتمال الرفع ·
          فشل شبكة).
        </Note>

        {loading && !loadedOnce ? (
          <PageLoadingHint />
        ) : error ? (
          <Note tone="danger">{error}</Note>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-text-2">
            لا عناصر بانتظار المزامنة — المزامنة الميدانية سليمة
          </div>
        ) : (
          <>
            {/* Phones: one card per device — the 40rem table scrolled sideways. */}
            <MobileRecordList
              className={cn(
                "lg:hidden transition-opacity",
                loading && "opacity-60",
              )}
            >
              {rows.map((row) => {
                const v = syncRowView(row);
                return (
                  <MobileRecordCard
                    key={row.id}
                    tone="gold"
                    title={v.name}
                    subtitle={v.role}
                    fields={[
                      {
                        label: "بانتظار المزامنة",
                        value: row.pendingCount,
                        ltr: true,
                      },
                      {
                        label: "العمر",
                        value: <span className="text-amber-700">{v.age}</span>,
                      },
                      { label: "الأنواع", value: v.kinds, wide: true },
                      { label: "آخر ظهور", value: v.lastSeen, ltr: true, wide: true },
                    ]}
                  />
                );
              })}
            </MobileRecordList>
            <div className="max-lg:hidden">
              <Table framed className="min-w-[40rem] text-sm" pending={loading}>
                <THead>
                  <Tr hoverable={false}>
                    <Th>المستخدم</Th>
                    <Th>الدور</Th>
                    <Th>بانتظار المزامنة</Th>
                    <Th>العمر</Th>
                    <Th>الأنواع</Th>
                    <Th>آخر ظهور</Th>
                  </Tr>
                </THead>
                <TBody>
                  {rows.map((row) => {
                    const v = syncRowView(row);
                    return (
                      <Tr key={row.id} hoverable={false}>
                        <Td className="font-medium text-text-1">{v.name}</Td>
                        <Td className="text-text-2">{v.role}</Td>
                        <TdLtr bare className="tabular-nums">
                          {row.pendingCount}
                        </TdLtr>
                        <Td className="text-amber-700">{v.age}</Td>
                        <Td className="text-text-2">{v.kinds}</Td>
                        <TdLtr bare className="text-text-3">
                          {v.lastSeen}
                        </TdLtr>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          </>
        )}
      </PageGutter>
    </PageShell>
  );
}
