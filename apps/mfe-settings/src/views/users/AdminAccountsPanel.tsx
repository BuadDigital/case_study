"use client";

/**
 * «لوحة الإدارة › حالة الحسابات» — account health at a glance: counts by
 * status, locked accounts with unlock, the latest sign-ins and active
 * accounts that never signed in. Full management stays on the users page.
 */
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  EmptyState,
  KpiAlertIcon,
  KpiBand,
  KpiCell,
  KpiCheckIcon,
  KpiClipboardIcon,
  KpiClockIcon,
  opsLetterCard,
  opsLetterHead,
  opsLetterSub,
  opsLetterTitle,
  QueryErrorState,
  Table,
  TableEmptyRow,
  TableFrame,
  TBody,
  THead,
  Td,
  Th,
  Tr,
  cn,
  useToast,
} from "@platform/ui-kit";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { queryLoadFailed } from "@platform/app-shared/query/query-load-state";
import { useStaffUsersQuery } from "../../query/settings-queries";
import { submitUnlockStaffUser } from "../../lib/users-api";
import {
  formatLastLogin,
  statusLabel,
  unlockErrorMessage,
  USER_TOASTS,
} from "./users-organization-state";

const RECENT_LOGINS = 10;

function lastLoginMs(user: StaffUser): number {
  const t = user.lastLoginAtUtc ? Date.parse(user.lastLoginAtUtc) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

function AccountsTable({
  title,
  sub,
  users,
  empty,
  action,
}: {
  title: string;
  sub: string;
  users: StaffUser[];
  empty: string;
  action?: (user: StaffUser) => ReactNode;
}) {
  return (
    <div className={cn(opsLetterCard, "rounded-xl")}>
      <div className={opsLetterHead}>
        <div>
          <div className={opsLetterTitle}>{title}</div>
          <div className={opsLetterSub}>{sub}</div>
        </div>
      </div>
      <TableFrame className="rounded-none border-0">
        <Table>
          <THead>
            <Tr hoverable={false}>
              <Th>الاسم</Th>
              <Th>الدور</Th>
              <Th>الحالة</Th>
              <Th>آخر دخول</Th>
              {action ? (
                <Th>
                  <span className="sr-only">إجراء</span>
                </Th>
              ) : null}
            </Tr>
          </THead>
          <TBody>
            {users.length === 0 ? (
              <TableEmptyRow colSpan={action ? 5 : 4}>{empty}</TableEmptyRow>
            ) : (
              users.map((user) => (
                <Tr key={user.id} hoverable={false}>
                  <Td>{user.name}</Td>
                  <Td>{user.role || "—"}</Td>
                  <Td>{statusLabel(user.status)}</Td>
                  <Td>
                    <bdi dir="ltr">{formatLastLogin(user.lastLoginAtUtc)}</bdi>
                  </Td>
                  {action ? <Td className="text-end">{action(user)}</Td> : null}
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableFrame>
    </div>
  );
}

export function AdminAccountsPanel() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const usersQuery = useStaffUsersQuery();
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const users = useMemo(
    () => usersQuery.data?.users ?? [],
    [usersQuery.data],
  );

  const summary = useMemo(() => {
    const locked = users.filter((u) => u.status === "Locked");
    const disabled = users.filter((u) => u.status === "Disabled");
    const active = users.filter((u) => u.status === "Active");
    const recent = users
      .filter((u) => lastLoginMs(u) > 0)
      .sort((a, b) => lastLoginMs(b) - lastLoginMs(a))
      .slice(0, RECENT_LOGINS);
    const neverSignedIn = active.filter((u) => lastLoginMs(u) === 0);
    return { locked, disabled, active, recent, neverSignedIn };
  }, [users]);

  async function unlock(user: StaffUser) {
    setUnlockingId(user.id);
    try {
      const result = await submitUnlockStaffUser(user.id);
      if (!result.ok) {
        showToast(unlockErrorMessage(result), "error");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: appDataKeys.staffUsers() });
      showToast(USER_TOASTS.unlocked, "success");
    } finally {
      setUnlockingId(null);
    }
  }

  const loadError = usersQuery.data?.loadError;
  if (queryLoadFailed(usersQuery) || loadError) {
    return (
      <div className={opsLetterCard}>
        <QueryErrorState
          panel
          line={loadError ?? "تعذّر تحميل قائمة المستخدمين."}
          error={usersQuery.error}
          onRetry={() => void usersQuery.refetch()}
          retrying={usersQuery.isFetching}
        />
      </div>
    );
  }
  if (usersQuery.isPending) {
    return (
      <div className={opsLetterCard}>
        <EmptyState panel line="جاري التحميل…" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <KpiBand className="mb-0">
        <KpiCell
          first
          icon={<KpiClipboardIcon />}
          iconClass="bg-gold-soft text-gold-d"
          label="إجمالي الحسابات"
          value={users.length}
          sub="كل حسابات النظام"
          dot
        />
        <KpiCell
          icon={<KpiCheckIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-success-text"
          label="نشطة"
          value={summary.active.length}
          sub={`${summary.neverSignedIn.length} لم يسجّلوا الدخول بعد`}
        />
        <KpiCell
          icon={<KpiClockIcon />}
          iconClass="bg-surface-2 text-text-2"
          label="معطّلة"
          value={summary.disabled.length}
          sub="لا تستطيع الدخول"
        />
        <KpiCell
          last
          icon={<KpiAlertIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red"
          label="موقوفة"
          value={summary.locked.length}
          valueClass={summary.locked.length > 0 ? "!text-red" : undefined}
          sub="تحتاج فك القفل"
        />
      </KpiBand>

      <AccountsTable
        title="حسابات موقوفة"
        sub="أُوقفت بعد محاولات دخول خاطئة — فك القفل يعيد للمستخدم الدخول."
        users={summary.locked}
        empty="لا توجد حسابات موقوفة."
        action={(user) => (
          <Button
            variant="default"
            size="sm"
            disabled={unlockingId === user.id}
            onClick={() => void unlock(user)}
          >
            فك القفل
          </Button>
        )}
      />

      <AccountsTable
        title="آخر تسجيلات الدخول"
        sub={`أحدث ${RECENT_LOGINS} حسابات دخلت النظام.`}
        users={summary.recent}
        empty="لم يسجّل أحد الدخول بعد."
      />

      <AccountsTable
        title="حسابات نشطة لم تسجّل الدخول"
        sub="أُنشئت ولم يدخل أصحابها النظام حتى الآن."
        users={summary.neverSignedIn}
        empty="كل الحسابات النشطة سجّلت الدخول."
      />

      <div>
        <Link
          href="/users"
          className="text-[13px] font-bold text-heading underline-offset-4 hover:underline"
        >
          إدارة المستخدمين (إضافة، تعديل، تعطيل) ›
        </Link>
      </div>
    </div>
  );
}
