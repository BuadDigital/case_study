"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RoleId } from "@platform/types";
import { Can, useCapability } from "@platform/app-shared/components/Can";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { adminStaffRoleOptions } from "@platform/app-shared/users/admin-staff-roles";
import {
  RegField,
  RegSelect,
} from "@platform/app-shared/registration/FormFields";
import {
  collectRequiredErrors,
  fieldRequired,
  mergeFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/registration/registration-utils";
import {
  Badge,
  Button,
  Input,
  Note,
  Select,
  Spinner,
  Table,
  TBody,
  Td,
  TdAction,
  Th,
  ThAction,
  THead,
  Tr,
  useToast,
} from "@platform/design-system";
import { getAuthSession } from "@platform/auth-client";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import { DevSystemResetPanel } from "../../components/DevSystemResetPanel";
import { UserProfileModal } from "../../components/UserProfileModal";
import {
  submitCreateStaffUser,
  submitDeleteStaffUser,
} from "../../lib/users-api";
import { useStaffUsersQuery } from "../../query/settings-queries";

const ROLE_OPTIONS = adminStaffRoleOptions();

const PROTECTED_USERNAMES = new Set(["sliman", "admin"]);
const PROTECTED_EMAILS = new Set([
  "s.salhy@gmail.com",
  "admin@local.dev",
]);

type FormState = {
  displayName: string;
  roleId: RoleId | "";
  email: string;
  employeeNumber: string;
  nationalId: string;
};

const EMPTY_FORM: FormState = {
  displayName: "",
  roleId: "",
  email: "",
  employeeNumber: "",
  nationalId: "",
};

function validateForm(form: FormState): FieldErrors {
  return mergeFieldErrors(
    collectRequiredErrors(
      {
        displayName: form.displayName,
        roleId: form.roleId,
        email: form.email,
      },
      ["displayName", "roleId", "email"],
    ),
    form.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())
      ? { email: "صيغة البريد الإلكتروني غير صحيحة." }
      : undefined,
    fieldRequired(form.displayName)
      ? { displayName: fieldRequired(form.displayName)! }
      : undefined,
    fieldRequired(form.roleId) ? { roleId: fieldRequired(form.roleId)! } : undefined,
  );
}

function statusTone(status: string | undefined): "success" | "danger" | "default" {
  if (status === "Active") return "success";
  if (status === "Inactive") return "danger";
  return "default";
}

function statusLabel(status: string | undefined): string {
  if (status === "Active") return "فعّال";
  if (status === "Inactive") return "معطّل";
  return status || "—";
}

function canDeleteUser(user: {
  id: string;
  email: string;
  userName?: string;
}, currentUserId: string | null): boolean {
  if (currentUserId && user.id === currentUserId) return false;
  const email = user.email.trim().toLowerCase();
  const userName = (user.userName ?? "").trim().toLowerCase();
  if (PROTECTED_EMAILS.has(email) || PROTECTED_USERNAMES.has(userName)) return false;
  return true;
}

export function UsersOrganizationView() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const canManage = useCapability("manage-users");
  const currentUserId = getAuthSession()?.user.id ?? null;
  const { data, isPending, refetch } = useStaffUsersQuery();
  const users = data?.users ?? [];
  const loadError = data?.loadError ?? null;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<StaffUser | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<{
    userName: string;
    temporaryPassword: string;
  } | null>(null);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter && user.role !== roleFilter) return false;
      if (!q) return true;
      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        (user.userName ?? "").toLowerCase().includes(q) ||
        user.role.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

  const roleFilterOptions = useMemo(() => {
    const titles = [...new Set(users.map((u) => u.role).filter(Boolean))];
    return titles.sort((a, b) => a.localeCompare(b, "ar"));
  }, [users]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clientErrors = validateForm(form);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setSaving(true);
    setCreatedCredentials(null);
    try {
      const result = await submitCreateStaffUser({
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        roleId: form.roleId,
        employeeNumber: form.employeeNumber.trim() || undefined,
        nationalId: form.nationalId.trim() || undefined,
      });

      if (!result.ok) {
        if (result.kind === "validation" && result.errors) {
          setErrors(result.errors);
          return;
        }
        showToast(
          result.kind === "network"
            ? "تعذر الاتصال بالخادم."
            : "تعذر إنشاء المستخدم.",
          "error",
        );
        return;
      }

      setForm(EMPTY_FORM);
      setErrors({});
      setCreatedCredentials({
        userName: result.result.userName,
        temporaryPassword: result.result.temporaryPassword,
      });
      await queryClient.invalidateQueries({ queryKey: prototypeKeys.staffUsers() });
      await refetch();
      showToast("تم إنشاء المستخدم بنجاح.", "success");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteUser(user: {
    id: string;
    name: string;
  }) {
    if (!window.confirm(`حذف المستخدم «${user.name}»؟ لا يمكن التراجع.`)) return;
    setDeletingId(user.id);
    try {
      const result = await submitDeleteStaffUser(user.id);
      if (!result.ok) {
        showToast(
          result.kind === "validation"
            ? result.message ?? "تعذر حذف المستخدم."
            : result.kind === "network"
              ? "تعذر الاتصال بالخادم."
              : "تعذر حذف المستخدم.",
          "error",
        );
        return;
      }
      await queryClient.invalidateQueries({ queryKey: prototypeKeys.staffUsers() });
      await refetch();
      showToast("تم حذف المستخدم.", "success");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    /* Scroll عبر #content في الـ shell — بدون flex-1/overflow داخلي يمنع النزول */
    <div className="bg-surface-2 px-4 pb-8 pt-5 sm:px-6 sm:pb-10 sm:pt-6" dir="rtl">
      {!canManage ? (
        <Note tone="info" className="mb-4">
          عرض فقط — تحتاج صلاحية إدارة المستخدمين للإضافة.
        </Note>
      ) : null}

      <Can capability="manage-users">
        <section className="mb-5 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <h2 className="m-0 text-[15px] font-bold text-heading">إضافة مستخدم</h2>
            <p className="m-0 mt-1.5 text-[12px] leading-relaxed text-text-3">
              بيانات الحساب
            </p>
          </div>

          <form onSubmit={(e) => void onSubmit(e)}>
            <div className="grid gap-x-5 gap-y-5 border-b border-border px-5 py-5 sm:grid-cols-2 sm:px-6 sm:py-6">
              <RegField
                id="staff-displayName"
                label="الاسم"
                required
                value={form.displayName}
                onChange={(v) => updateField("displayName", v)}
                error={errors.displayName}
              />
              <RegSelect
                id="staff-roleId"
                label="الدور"
                required
                placeholder="اختر الدور"
                options={ROLE_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                value={form.roleId}
                onChange={(v) => updateField("roleId", v as RoleId | "")}
                error={errors.roleId}
              />
              <RegField
                id="staff-email"
                label="البريد الإلكتروني"
                required
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(v) => updateField("email", v)}
                error={errors.email}
              />
              <RegField
                id="staff-employeeNumber"
                label="رقم العضوية"
                value={form.employeeNumber}
                onChange={(v) => updateField("employeeNumber", v)}
                hint="اختياري"
              />
              <RegField
                id="staff-nationalId"
                label="رقم الهوية"
                value={form.nationalId}
                onChange={(v) => updateField("nationalId", v)}
                hint="اختياري"
                inputMode="numeric"
              />
            </div>

            <div className="space-y-4 px-5 py-5 sm:px-6">
              {errors._form ? (
                <Note tone="danger" className="text-xs">
                  {errors._form}
                </Note>
              ) : null}

              {createdCredentials ? (
                <div className="rounded-lg border border-success/30 bg-success-bg px-4 py-3 text-xs leading-relaxed text-success-text">
                  <strong>بيانات الدخول المؤقتة</strong>
                  <div className="mt-2 space-y-1" dir="ltr">
                    <div>
                      <span className="text-text-3">username:</span>{" "}
                      {createdCredentials.userName}
                    </div>
                    <div>
                      <span className="text-text-3">password:</span>{" "}
                      {createdCredentials.temporaryPassword}
                    </div>
                  </div>
                  <p className="m-0 mt-2 text-[10px] text-text-3" dir="rtl">
                    احفظها الآن — لن تُعرض مرة أخرى.
                  </p>
                </div>
              ) : null}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={saving}
                  loading={saving}
                >
                  إنشاء المستخدم
                </Button>
              </div>
            </div>
          </form>
        </section>
      </Can>

      <section className="mb-5 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <h2 className="m-0 text-[15px] font-bold text-heading">قائمة المستخدمين</h2>
            {!isPending ? (
              <span className="rounded-md bg-surface-2 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-text-2">
                {filteredUsers.length}
                {filteredUsers.length !== users.length ? ` / ${users.length}` : ""}
              </span>
            ) : null}
          </div>
          <div className="flex w-full flex-wrap gap-2.5 sm:w-auto">
            <div className="relative min-w-[240px] flex-1 sm:flex-none">
              <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-text-3">
                ⌕
              </span>
              <Input
                aria-label="البحث في المستخدمين"
                value={search}
                placeholder="بحث بالاسم أو الإيميل أو اسم الدخول…"
                onChange={(e) => setSearch(e.target.value)}
                className="pe-3 ps-8 text-xs"
              />
            </div>
            <Select
              aria-label="تصفية حسب الدور"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-[180px] text-xs"
            >
              <option value="">كل الأدوار</option>
              {roleFilterOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {loadError ? (
          <Note tone="danger" className="m-5 text-xs">
            {loadError}
          </Note>
        ) : isPending && users.length === 0 ? (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className="py-14 text-center text-xs text-text-3">
            {users.length === 0
              ? "لا يوجد مستخدمون بعد."
              : "لا يوجد مستخدمون مطابقون للبحث."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table pending={isPending} className="min-w-[800px]">
              <THead>
                <Tr hoverable={false}>
                  <Th>الاسم</Th>
                  <Th>الدور</Th>
                  <Th>البريد</Th>
                  <Th>اسم الدخول</Th>
                  <Th className="w-28 text-center">الحالة</Th>
                  <ThAction>إجراءات</ThAction>
                </Tr>
              </THead>
              <TBody>
                {filteredUsers.map((user) => (
                  <Tr key={user.id}>
                    <Td className="py-3.5">
                      <button
                        type="button"
                        className="cursor-pointer border-0 bg-transparent p-0 text-start text-[13px] font-semibold text-primary hover:underline"
                        onClick={() => setProfileUser(user)}
                      >
                        {user.name}
                      </button>
                    </Td>
                    <Td className="py-3.5">
                      <span className="rounded-md border border-border-md bg-surface-2 px-2.5 py-[3px] text-[12px] font-medium text-text-2">
                        {user.role}
                      </span>
                    </Td>
                    <Td className="py-3.5">
                      <span className="text-[12px] text-text-2" dir="ltr">
                        {user.email}
                      </span>
                    </Td>
                    <Td className="py-3.5">
                      <span className="text-[12px] font-medium text-text" dir="ltr">
                        {user.userName || "—"}
                      </span>
                    </Td>
                    <Td className="py-3.5 text-center">
                      <Badge tone={statusTone(user.status)} dot>
                        {statusLabel(user.status)}
                      </Badge>
                    </Td>
                    <TdAction>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setProfileUser(user)}
                        >
                          البروفايل
                        </Button>
                        {canManage && canDeleteUser(user, currentUserId) ? (
                          <Button
                            type="button"
                            variant="dangerOutline"
                            size="sm"
                            disabled={deletingId === user.id}
                            loading={deletingId === user.id}
                            onClick={() => void onDeleteUser(user)}
                          >
                            حذف
                          </Button>
                        ) : null}
                      </div>
                    </TdAction>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </section>

      <DevSystemResetPanel />

      {profileUser ? (
        <UserProfileModal
          user={profileUser}
          onClose={() => setProfileUser(null)}
        />
      ) : null}
    </div>
  );
}
