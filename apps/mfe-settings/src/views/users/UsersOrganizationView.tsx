"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RoleId, UserStatusApi } from "@platform/types";
import type { UpdateStaffUserRequest } from "@platform/api-client";
import { Can, useCapability } from "@platform/app-shared/components/Can";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { adminStaffRoleOptions } from "@platform/app-shared/users/admin-staff-roles";
import {
  isSectionSupervisorRole,
  SUPERVISOR_DEPARTMENT_OPTIONS,
} from "@platform/app-shared/users/admin-staff-roles";
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
  EmptyState,
  KpiBand,
  KpiCell,
  Note,
  OperationalPanel,
  OperationalToolbarSearch,
  OperationalToolbarSelect,
  PageGutter,
  PageShell,
  PageShellHeader,
  PageToolbar,
  Spinner,
  Table,
  TBody,
  Td,
  TdAction,
  Textarea,
  Th,
  ThAction,
  THead,
  Tr,
  cn,
  useToast,
} from "@platform/ui-kit";
import { getAuthSession } from "@platform/auth-client";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import { DevSystemResetPanel } from "../../components/DevSystemResetPanel";
import { EditStaffUserModal } from "../../components/EditStaffUserModal";
import { UserProfileModal } from "../../components/UserProfileModal";
import {
  requestActivationTicket,
  submitCreateStaffUser,
  submitDeleteStaffUser,
  submitUnlockStaffUser,
  submitUpdateStaffUser,
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
  mobile: string;
  city: string;
  department: string;
  inspectorType: "employee" | "contractor" | "";
  hasCompensation: boolean;
  feeValueSar: string;
  iban: string;
  taxNumber: string;
  commercialRegistration: string;
  joinedAt: string;
  avatarUrl: string;
  nationalId: string;
};

const EMPTY_FORM: FormState = {
  displayName: "",
  roleId: "",
  email: "",
  mobile: "",
  city: "",
  department: "",
  inspectorType: "",
  hasCompensation: false,
  feeValueSar: "",
  iban: "",
  taxNumber: "",
  commercialRegistration: "",
  joinedAt: "",
  avatarUrl: "",
  nationalId: "",
};

function validateForm(form: FormState): FieldErrors {
  return mergeFieldErrors(
    collectRequiredErrors(
      {
        displayName: form.displayName,
        roleId: form.roleId,
        email: form.email,
        mobile: form.mobile,
        city: form.city,
        nationalId: form.nationalId,
      },
      ["displayName", "roleId", "email", "mobile", "city", "nationalId"],
    ),
    form.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())
      ? { email: "صيغة البريد الإلكتروني غير صحيحة." }
      : undefined,
    fieldRequired(form.displayName)
      ? { displayName: fieldRequired(form.displayName)! }
      : undefined,
    fieldRequired(form.roleId) ? { roleId: fieldRequired(form.roleId)! } : undefined,
    form.mobile.trim() && !/^(\+9665|05)\d{8}$/.test(form.mobile.trim())
      ? { mobile: "صيغة رقم الجوال غير صحيحة." }
      : undefined,
    form.nationalId.trim() && !/^[12]\d{9}$/.test(form.nationalId.trim())
      ? { nationalId: "رقم الهوية يجب أن يتكون من 10 أرقام." }
      : undefined,
    form.roleId === "field-inspector" && !form.inspectorType
      ? { inspectorType: "نوع المعاين مطلوب." }
      : undefined,
    isSectionSupervisorRole(form.roleId) &&
      !SUPERVISOR_DEPARTMENT_OPTIONS.some((o) => o.value === form.department)
      ? { department: "يجب اختيار قسم المشرف: دراسة الحالة أو التقييم." }
      : undefined,
    form.hasCompensation && (!form.feeValueSar || Number(form.feeValueSar) < 0)
      ? { feeValueSar: "قيمة الأتعاب مطلوبة." }
      : undefined,
    form.iban.trim() &&
      !/^SA\d{22}$/i.test(form.iban.replace(/\s/g, ""))
      ? { iban: "صيغة الآيبان السعودي غير صحيحة." }
      : undefined,
    form.avatarUrl.trim() &&
      !/^https?:\/\/\S+$/i.test(form.avatarUrl.trim())
      ? { avatarUrl: "رابط الصورة الشخصية غير صالح." }
      : undefined,
  );
}

function statusTone(status: string | undefined): "success" | "danger" | "default" {
  if (status === "Active") return "success";
  if (status === "Disabled" || status === "Locked") return "danger";
  return "default";
}

function statusLabel(status: string | undefined): string {
  if (status === "Active") return "فعّال";
  if (status === "Disabled") return "معطّل";
  if (status === "PendingActivation") return "بانتظار التفعيل";
  if (status === "Locked") return "موقوف";
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

function formatLastLogin(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "؟";
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`;
}

function FormSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="col-span-full sm:col-span-2">
      <p className="m-0 flex items-center gap-2 border-b border-border pb-1.5 text-[11.5px] font-bold text-heading">
        <span className="size-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
        {children}
      </p>
    </div>
  );
}

/** Icon-only row actions — matches Courts admin toolbar. */
function UserActionButton({
  label,
  tone = "default",
  loading = false,
  disabled,
  onClick,
  children,
}: {
  label: string;
  tone?: "default" | "danger" | "success" | "gold";
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const toneClass =
    tone === "danger"
      ? "text-danger-text hover:bg-danger-bg"
      : tone === "success"
        ? "text-success-text hover:bg-success-bg"
        : tone === "gold"
          ? "text-gold-d hover:bg-gold-soft"
          : "text-text-2 hover:bg-surface-2 hover:text-ink";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md border border-transparent text-[14px] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        toneClass,
      )}
    >
      {loading ? <Spinner className="size-3.5" /> : children}
    </button>
  );
}

function IconProfile({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5.5 19.5c1.5-3.2 3.8-4.8 6.5-4.8s5 1.6 6.5 4.8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconInvite({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M4 7.5 12 13.2 20 7.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconEdit({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 20h4.2L18.8 9.4a1.9 1.9 0 0 0 0-2.7l-1.5-1.5a1.9 1.9 0 0 0-2.7 0L4 15.8V20Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="m13.2 6.8 4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconUnlock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M8 11V8a4 4 0 0 1 7.5-2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16" r="1.2" fill="currentColor" />
    </svg>
  );
}

function IconEnable({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="m8.5 12.2 2.3 2.3 4.7-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDisable({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M9 9 15 15M15 9 9 15"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function UsersOrganizationView() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { role } = usePrototype();
  const canManage = useCapability("manage-users");
  /** Admin = full columns + actions; supervisor = status/last login; others = directory. */
  const showStatusColumn = canManage || role === "section-supervisor" || role === "cdo";
  const showLastLoginColumn = showStatusColumn;
  const showActionsColumn = canManage;
  const currentUserId = getAuthSession()?.user.id ?? null;
  const { data, isPending, refetch } = useStaffUsersQuery();
  const users = data?.users ?? [];
  const loadError = data?.loadError ?? null;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<StaffUser | null>(null);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatusApi | "">("");
  const [createdUser, setCreatedUser] = useState<{
    id: string;
    userName: string;
  } | null>(null);
  const [activationTicket, setActivationTicket] = useState<{
    userName: string;
    token: string;
    expiresAtUtc: string;
  } | null>(null);
  const [issuingTicketFor, setIssuingTicketFor] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter && user.role !== roleFilter) return false;
      if (statusFilter && user.status !== statusFilter) return false;
      if (!q) return true;
      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        (user.userName ?? "").toLowerCase().includes(q) ||
        user.role.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter, statusFilter]);

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
    setCreatedUser(null);
    setActivationTicket(null);
    try {
      const result = await submitCreateStaffUser({
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        city: form.city.trim(),
        roleId: form.roleId,
        department: isSectionSupervisorRole(form.roleId)
          ? form.department.trim()
          : undefined,
        inspectorType: form.inspectorType || undefined,
        hasCompensation: form.hasCompensation,
        feeValueSar: form.hasCompensation ? Number(form.feeValueSar) : undefined,
        iban: form.iban.trim() || undefined,
        taxNumber: form.taxNumber.trim() || undefined,
        commercialRegistration: form.commercialRegistration.trim() || undefined,
        joinedAt: form.joinedAt || undefined,
        avatarUrl: form.avatarUrl.trim() || undefined,
        nationalId: form.nationalId.trim(),
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
      setCreatedUser({
        id: result.result.user.id,
        userName: result.result.userName,
      });
      await queryClient.invalidateQueries({ queryKey: prototypeKeys.staffUsers() });
      await refetch();
      showToast("تم إنشاء المستخدم بنجاح.", "success");
    } finally {
      setSaving(false);
    }
  }

  async function onIssueActivationTicket(userId: string) {
    setIssuingTicketFor(userId);
    setActivationTicket(null);
    try {
      const result = await requestActivationTicket(userId);
      if (!result.ok) {
        showToast(
          result.kind === "network"
            ? "تعذر الاتصال بالخادم."
            : result.message ?? "تعذر إصدار دعوة التفعيل.",
          "error",
        );
        return;
      }
      setActivationTicket(result.ticket);
      showToast("تم إصدار دعوة التفعيل — اعرض الرمز من بطاقة الإضافة أعلى الصفحة.", "success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIssuingTicketFor(null);
    }
  }

  async function onDeleteUser(user: {
    id: string;
    name: string;
  }) {
    if (!window.confirm(`تعطيل المستخدم «${user.name}» وإنهاء جلساته النشطة؟`)) return;
    setDeletingId(user.id);
    try {
      const result = await submitDeleteStaffUser(user.id);
      if (!result.ok) {
        showToast(
          result.kind === "validation"
            ? result.message ?? "تعذر تعطيل المستخدم."
            : result.kind === "network"
              ? "تعذر الاتصال بالخادم."
              : "تعذر تعطيل المستخدم.",
          "error",
        );
        return;
      }
      await queryClient.invalidateQueries({ queryKey: prototypeKeys.staffUsers() });
      await refetch();
      showToast("تم تعطيل المستخدم.", "success");
    } finally {
      setDeletingId(null);
    }
  }

  /** Returns field errors for the modal to render, or null once the update succeeded. */
  async function onSaveEdit(
    userId: string,
    patch: UpdateStaffUserRequest,
  ): Promise<FieldErrors | null> {
    setPendingActionId(userId);
    try {
      const result = await submitUpdateStaffUser(userId, patch);
      if (!result.ok) {
        if (result.kind === "validation" && result.errors) return result.errors;
        return {
          _form:
            result.kind === "network"
              ? "تعذر الاتصال بالخادم."
              : "تعذر حفظ التعديلات.",
        };
      }

      setEditingUser(null);
      await queryClient.invalidateQueries({ queryKey: prototypeKeys.staffUsers() });
      await refetch();
      showToast("تم حفظ التعديلات.", "success");
      return null;
    } finally {
      setPendingActionId(null);
    }
  }

  async function onReactivateUser(user: { id: string; name: string }) {
    setPendingActionId(user.id);
    try {
      const result = await submitUpdateStaffUser(user.id, { status: "Active" });
      if (!result.ok) {
        showToast(
          result.kind === "validation"
            ? (result.errors?._form ??
                result.errors?.status ??
                "تعذر تفعيل المستخدم.")
            : result.kind === "network"
              ? "تعذر الاتصال بالخادم."
              : "تعذر تفعيل المستخدم.",
          "error",
        );
        return;
      }
      await queryClient.invalidateQueries({ queryKey: prototypeKeys.staffUsers() });
      await refetch();
      showToast("تم تفعيل المستخدم.", "success");
    } finally {
      setPendingActionId(null);
    }
  }

  async function onUnlockUser(user: { id: string; name: string }) {
    setPendingActionId(user.id);
    try {
      const result = await submitUnlockStaffUser(user.id);
      if (!result.ok) {
        showToast(
          result.kind === "network"
            ? "تعذر الاتصال بالخادم."
            : (result.message ?? "تعذر فك قفل الحساب."),
          "error",
        );
        return;
      }
      await queryClient.invalidateQueries({ queryKey: prototypeKeys.staffUsers() });
      await refetch();
      showToast("تم فك قفل الحساب.", "success");
    } finally {
      setPendingActionId(null);
    }
  }

  const statusCounts = useMemo(() => {
    let active = 0;
    let pending = 0;
    let locked = 0;
    let disabled = 0;
    for (const user of users) {
      if (user.status === "Active") active += 1;
      else if (user.status === "PendingActivation") pending += 1;
      else if (user.status === "Locked") locked += 1;
      else if (user.status === "Disabled") disabled += 1;
    }
    return { active, pending, locked, disabled, total: users.length };
  }, [users]);

  return (
    <PageShell variant="canvas" className="min-h-0" dir="rtl">
      <PageShellHeader
        title="المستخدمون"
        meta="إنشاء الحسابات التشغيلية ومتابعة الحالة ودعوات التفعيل"
      />

      <PageGutter className="space-y-3 pb-8 pt-1 sm:space-y-3.5">
        {!canManage ? (
          <Note tone="info">
            عرض فقط — تحتاج صلاحية إدارة المستخدمين للإضافة.
          </Note>
        ) : null}

        {!isPending && users.length > 0 ? (
          <KpiBand className="mb-0">
            <KpiCell
              first
              icon={<span className="text-[13px] font-bold">∑</span>}
              iconClass="bg-surface-2 text-heading"
              label="الإجمالي"
              value={statusCounts.total}
              sub="كل الحسابات"
            />
            <KpiCell
              icon={<span className="text-[13px] font-bold">✓</span>}
              iconClass="bg-success-bg text-success-text"
              label="فعّال"
              value={statusCounts.active}
              sub="جاهز للعمل"
              valueClass="text-success-text"
            />
            <KpiCell
              icon={<span className="text-[13px] font-bold">…</span>}
              iconClass="bg-warning-bg text-warning"
              label="بانتظار التفعيل"
              value={statusCounts.pending}
              sub="دعوة أو كلمة مرور"
              valueClass="text-warning"
            />
            <KpiCell
              last
              icon={<span className="text-[13px] font-bold">⏹</span>}
              iconClass="bg-danger-bg text-danger-text"
              label="موقوف / معطّل"
              value={statusCounts.locked + statusCounts.disabled}
              sub={`${statusCounts.locked} قفل · ${statusCounts.disabled} تعطيل`}
              valueClass="text-danger-text"
            />
          </KpiBand>
        ) : null}

        <Can capability="manage-users">
          <OperationalPanel>
            <div className="relative border-b border-border px-4 py-3.5 sm:px-5">
              <span
                aria-hidden
                className="absolute inset-y-0 start-0 w-[3px] bg-gold"
              />
              <h2 className="m-0 text-[14px] font-bold text-heading">
                إضافة مستخدم
              </h2>
              <p className="m-0 mt-1 text-[12px] leading-relaxed text-text-3">
                بيانات الحساب — اسم الدخول يُنشأ تلقائياً ويُفعَّل بدعوة لمرة واحدة
              </p>
            </div>

            <form onSubmit={(e) => void onSubmit(e)}>
              <div className="grid gap-x-4 gap-y-3.5 border-b border-border px-4 py-4 sm:grid-cols-2 sm:px-5 sm:py-5">
                <FormSectionLabel>البيانات الأساسية</FormSectionLabel>
                <RegField
                  id="staff-displayName"
                  label="الاسم"
                  required
                  placeholder="الاسم الكامل"
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
                  onChange={(v) => {
                    const roleId = v as RoleId | "";
                    setForm((prev) => ({
                      ...prev,
                      roleId,
                      department: isSectionSupervisorRole(roleId)
                        ? prev.department
                        : "",
                    }));
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.roleId;
                      delete next.department;
                      return next;
                    });
                  }}
                  error={errors.roleId}
                />
                <RegField
                  id="staff-email"
                  label="البريد الإلكتروني"
                  required
                  type="email"
                  dir="ltr"
                  placeholder="name@example.com"
                  value={form.email}
                  onChange={(v) => updateField("email", v)}
                  error={errors.email}
                />
                <RegField
                  id="staff-mobile"
                  label="رقم الجوال"
                  required
                  dir="ltr"
                  inputMode="tel"
                  placeholder="05xxxxxxxx"
                  value={form.mobile}
                  onChange={(v) => updateField("mobile", v)}
                  error={errors.mobile}
                />
                <RegField
                  id="staff-city"
                  label="المدينة"
                  required
                  placeholder="مثال: الرياض"
                  value={form.city}
                  onChange={(v) => updateField("city", v)}
                  error={errors.city}
                />
                {isSectionSupervisorRole(form.roleId) ? (
                  <RegSelect
                    id="staff-department"
                    label="قسم الإشراف"
                    required
                    placeholder="اختر القسم"
                    options={SUPERVISOR_DEPARTMENT_OPTIONS.map((o) => ({
                      value: o.value,
                      label: o.label,
                    }))}
                    value={form.department}
                    onChange={(v) => updateField("department", v)}
                    error={errors.department}
                  />
                ) : null}
                {form.roleId === "field-inspector" ? (
                  <RegSelect
                    id="staff-inspectorType"
                    label="نوع المعاين"
                    required
                    placeholder="اختر النوع"
                    options={[
                      { value: "employee", label: "موظف" },
                      { value: "contractor", label: "متعاون" },
                    ]}
                    value={form.inspectorType}
                    onChange={(v) =>
                      updateField(
                        "inspectorType",
                        v as FormState["inspectorType"],
                      )
                    }
                    error={errors.inspectorType}
                  />
                ) : null}

                <FormSectionLabel>الهوية والالتحاق</FormSectionLabel>
                <RegField
                  id="staff-nationalId"
                  label="رقم الهوية"
                  required
                  dir="ltr"
                  inputMode="numeric"
                  placeholder="1xxxxxxxxx"
                  value={form.nationalId}
                  onChange={(v) => updateField("nationalId", v)}
                  error={errors.nationalId}
                />
                <RegField
                  id="staff-joinedAt"
                  label="تاريخ الالتحاق"
                  type="date"
                  value={form.joinedAt}
                  onChange={(v) => updateField("joinedAt", v)}
                  hint="اختياري"
                />
                <RegField
                  id="staff-avatarUrl"
                  label="رابط الصورة الشخصية"
                  dir="ltr"
                  placeholder="https://…"
                  value={form.avatarUrl}
                  onChange={(v) => updateField("avatarUrl", v)}
                  error={errors.avatarUrl}
                  hint="اختياري"
                  className="sm:col-span-2"
                />

                <FormSectionLabel>التعويض والفوترة</FormSectionLabel>
                <label
                  className={cn(
                    "flex items-center gap-2.5 rounded-[var(--radius)] border border-border bg-surface-2/70 px-3 py-2.5 text-xs font-medium text-text sm:col-span-2",
                    form.hasCompensation &&
                      "border-gold/40 bg-gold-soft text-heading",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-3.5 accent-[var(--gold-d)]"
                    checked={form.hasCompensation}
                    onChange={(event) =>
                      updateField("hasCompensation", event.target.checked)
                    }
                  />
                  يستحق تعويضاً مالياً
                </label>
                {form.hasCompensation ? (
                  <RegField
                    id="staff-feeValueSar"
                    label="قيمة الأتعاب (ر.س)"
                    required
                    type="number"
                    dir="ltr"
                    placeholder="0"
                    value={form.feeValueSar}
                    onChange={(v) => updateField("feeValueSar", v)}
                    error={errors.feeValueSar}
                  />
                ) : null}
                <RegField
                  id="staff-iban"
                  label="الآيبان"
                  dir="ltr"
                  placeholder="SAxxxxxxxxxxxxxxxxxxxxxx"
                  value={form.iban}
                  onChange={(v) => updateField("iban", v)}
                  error={errors.iban}
                  hint="اختياري — صيغة SA + 22 رقماً"
                />
                {form.roleId === "engineering-office" ? (
                  <>
                    <FormSectionLabel>بيانات المكتب الهندسي</FormSectionLabel>
                    <RegField
                      id="staff-taxNumber"
                      label="الرقم الضريبي"
                      dir="ltr"
                      value={form.taxNumber}
                      onChange={(v) => updateField("taxNumber", v)}
                      hint="اختياري"
                    />
                    <RegField
                      id="staff-commercialRegistration"
                      label="السجل التجاري"
                      dir="ltr"
                      value={form.commercialRegistration}
                      onChange={(v) =>
                        updateField("commercialRegistration", v)
                      }
                      hint="اختياري"
                    />
                  </>
                ) : null}
              </div>

              <div className="space-y-3 px-4 py-4 sm:px-5">
                {errors._form ? (
                  <Note tone="danger" className="text-xs">
                    {errors._form}
                  </Note>
                ) : null}

                {createdUser ? (
                  <div className="rounded-[var(--radius)] border border-success/25 bg-success-bg px-3.5 py-3 text-xs leading-relaxed text-success-text">
                    <strong>تم إنشاء الحساب — بانتظار التفعيل</strong>
                    <div className="mt-2" dir="ltr">
                      <span className="text-text-3">username:</span>{" "}
                      {createdUser.userName}
                    </div>
                    <p className="m-0 mt-2 text-[11px]" dir="rtl">
                      لا يملك الحساب كلمة مرور. أرسل دعوة تفعيل لمرة واحدة
                      ليختار صاحب الحساب كلمة مروره من صفحة{" "}
                      <bdi dir="ltr">/activate</bdi>.
                    </p>
                    <div className="mt-2.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={issuingTicketFor === createdUser.id}
                        loading={issuingTicketFor === createdUser.id}
                        onClick={() =>
                          void onIssueActivationTicket(createdUser.id)
                        }
                      >
                        إرسال دعوة التفعيل
                      </Button>
                    </div>
                  </div>
                ) : null}

                {activationTicket ? (
                  <div className="rounded-[var(--radius)] border border-warning/35 bg-warning-bg px-3.5 py-3 text-xs leading-relaxed text-text">
                    <strong>رمز التفعيل لمرة واحدة</strong>
                    <div className="mt-2 space-y-1" dir="ltr">
                      <div>
                        <span className="text-text-3">username:</span>{" "}
                        {activationTicket.userName}
                      </div>
                      <Textarea
                        readOnly
                        rows={3}
                        dir="ltr"
                        aria-label="رمز التفعيل لمرة واحدة"
                        className="min-h-0 resize-none bg-surface-2 font-mono text-[10.5px] leading-relaxed text-ink selection:bg-gold-soft"
                        value={activationTicket.token}
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    </div>
                    <p className="m-0 mt-2 text-[10px] text-text-3" dir="rtl">
                      صالح حتى{" "}
                      {new Date(activationTicket.expiresAtUtc).toLocaleString(
                        "ar",
                      )}{" "}
                      — يُستخدم مرة واحدة ولن يُعرض مرة أخرى. سلّمه عبر قناة
                      آمنة.
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3.5">
                  <p className="m-0 text-[11px] text-text-3">
                    بعد الإنشاء: دعوة تفعيل لمرة واحدة — ثم الدخول من صفحة التفعيل.
                  </p>
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
          </OperationalPanel>
        </Can>

        <OperationalPanel>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <h2 className="m-0 text-[14px] font-bold text-heading">
                قائمة المستخدمين
              </h2>
              {!isPending ? (
                <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-text-2">
                  {filteredUsers.length}
                  {filteredUsers.length !== users.length
                    ? ` / ${users.length}`
                    : ""}
                </span>
              ) : null}
            </div>
          </div>

          <PageToolbar className="flex-wrap items-center gap-2.5 border-b border-border bg-surface-2/60">
            <OperationalToolbarSearch
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الإيميل أو اسم الدخول…"
              aria-label="البحث في المستخدمين"
              className="min-w-[200px] max-w-full flex-1 sm:max-w-[320px]"
            />
            <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
              <OperationalToolbarSelect
                aria-label="تصفية حسب الدور"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="min-w-[160px] flex-1 sm:flex-none"
                selectClassName="w-full min-w-[160px]"
              >
                <option value="">كل الأدوار</option>
                {roleFilterOptions.map((roleTitle) => (
                  <option key={roleTitle} value={roleTitle}>
                    {roleTitle}
                  </option>
                ))}
              </OperationalToolbarSelect>
              <OperationalToolbarSelect
                aria-label="تصفية حسب الحالة"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as UserStatusApi | "")
                }
                className="min-w-[150px] flex-1 sm:flex-none"
                selectClassName="w-full min-w-[150px]"
              >
                <option value="">كل الحالات</option>
                <option value="Active">نشط</option>
                <option value="PendingActivation">بانتظار التفعيل</option>
                <option value="Locked">مقفل</option>
                <option value="Disabled">معطّل</option>
              </OperationalToolbarSelect>
            </div>
          </PageToolbar>

          {loadError ? (
            <Note tone="danger" className="m-4 text-xs">
              {loadError}
            </Note>
          ) : isPending && users.length === 0 ? (
            <div className="flex justify-center py-14">
              <Spinner />
            </div>
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              className="py-12"
              line={
                users.length === 0
                  ? "لا يوجد مستخدمون بعد"
                  : "لا يوجد مستخدمون مطابقون للبحث"
              }
              hint={
                users.length === 0 && canManage
                  ? "استخدم نموذج «إضافة مستخدم» لإنشاء أول حساب."
                  : "جرّب تعديل الفلاتر أو نص البحث."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table pending={isPending} className="min-w-[800px]">
                <THead>
                  <Tr hoverable={false}>
                    <Th>الاسم</Th>
                    <Th>الدور</Th>
                    <Th>الجوال</Th>
                    {showStatusColumn ? (
                      <Th className="w-28 text-center">الحالة</Th>
                    ) : null}
                    {showLastLoginColumn ? <Th>آخر دخول</Th> : null}
                    {showActionsColumn ? <ThAction>إجراءات</ThAction> : null}
                  </Tr>
                </THead>
                <TBody>
                  {filteredUsers.map((user) => (
                    <Tr key={user.id}>
                      <Td className="py-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="size-9 shrink-0 rounded-full border border-border object-cover"
                            />
                          ) : (
                            <span
                              aria-hidden
                              className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold text-white"
                            >
                              {userInitials(user.name)}
                            </span>
                          )}
                          <div className="min-w-0">
                            <button
                              type="button"
                              className="cursor-pointer border-0 bg-transparent p-0 text-start text-[13px] font-semibold text-heading hover:text-gold-d hover:underline"
                              onClick={() => setProfileUser(user)}
                            >
                              {user.name}
                            </button>
                            {user.userName ? (
                              <div
                                className="mt-0.5 truncate text-[11px] text-text-3"
                                dir="ltr"
                              >
                                {user.userName}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </Td>
                      <Td className="py-3">
                        <span className="inline-flex max-w-[200px] truncate rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[11.5px] font-medium text-text-2">
                          {user.role}
                        </span>
                      </Td>
                      <Td className="py-3">
                        <span className="text-[12px] tabular-nums text-text-2" dir="ltr">
                          {user.phone || "—"}
                        </span>
                      </Td>
                      {showStatusColumn ? (
                        <Td className="py-3 text-center">
                          <Badge tone={statusTone(user.status)} dot>
                            {statusLabel(user.status)}
                          </Badge>
                        </Td>
                      ) : null}
                      {showLastLoginColumn ? (
                        <Td className="py-3">
                          <span className="text-[12px] text-text-2" dir="ltr">
                            {formatLastLogin(user.lastLoginAtUtc)}
                          </span>
                        </Td>
                      ) : null}
                      {showActionsColumn ? (
                        <TdAction>
                          <div className="flex items-center justify-end gap-0.5">
                            <UserActionButton
                              label="البروفايل"
                              onClick={() => setProfileUser(user)}
                            >
                              <IconProfile className="size-4" />
                            </UserActionButton>
                            {canManage ? (
                              <UserActionButton
                                label={
                                  user.status === "PendingActivation" ||
                                  user.status === "Disabled"
                                    ? "إعادة دعوة التفعيل"
                                    : "دعوة تفعيل"
                                }
                                tone="gold"
                                loading={issuingTicketFor === user.id}
                                disabled={issuingTicketFor === user.id}
                                onClick={() =>
                                  void onIssueActivationTicket(user.id)
                                }
                              >
                                <IconInvite className="size-4" />
                              </UserActionButton>
                            ) : null}
                            {canManage ? (
                              <UserActionButton
                                label="تعديل"
                                onClick={() => setEditingUser(user)}
                              >
                                <IconEdit className="size-4" />
                              </UserActionButton>
                            ) : null}
                            {canManage && user.status === "Locked" ? (
                              <UserActionButton
                                label="فك القفل"
                                tone="success"
                                loading={pendingActionId === user.id}
                                disabled={pendingActionId === user.id}
                                onClick={() => void onUnlockUser(user)}
                              >
                                <IconUnlock className="size-4" />
                              </UserActionButton>
                            ) : null}
                            {canManage && user.status === "Disabled" ? (
                              <UserActionButton
                                label="تفعيل"
                                tone="success"
                                loading={pendingActionId === user.id}
                                disabled={pendingActionId === user.id}
                                onClick={() => void onReactivateUser(user)}
                              >
                                <IconEnable className="size-4" />
                              </UserActionButton>
                            ) : canManage &&
                              canDeleteUser(user, currentUserId) ? (
                              <UserActionButton
                                label="تعطيل"
                                tone="danger"
                                loading={deletingId === user.id}
                                disabled={deletingId === user.id}
                                onClick={() => void onDeleteUser(user)}
                              >
                                <IconDisable className="size-4" />
                              </UserActionButton>
                            ) : null}
                          </div>
                        </TdAction>
                      ) : null}
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </OperationalPanel>

        <DevSystemResetPanel />
      </PageGutter>

      {profileUser ? (
        <UserProfileModal
          user={profileUser}
          onClose={() => setProfileUser(null)}
        />
      ) : null}

      {editingUser ? (
        <EditStaffUserModal
          user={editingUser}
          saving={pendingActionId === editingUser.id}
          onSubmit={(patch) => onSaveEdit(editingUser.id, patch)}
          onClose={() => setEditingUser(null)}
        />
      ) : null}
    </PageShell>
  );
}