"use client";

import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import type { RoleId } from "@platform/types";
import type { UpdateStaffUserRequest } from "@platform/api-client";
import { useCapability } from "@platform/app-shared/components/Can";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { adminStaffRoleOptions } from "@platform/app-shared/users/admin-staff-roles";
import {
  isSectionSupervisorRole,
  SUPERVISOR_DEPARTMENT_OPTIONS,
  supervisingDepartmentLabel,
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
  Card,
  Input,
  ModalBody,
  ModalCard,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Note,
  PageShell,
  Select,
  Spinner,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
  cn,
  useToast,
} from "@platform/ui-kit";
import { getAuthSession } from "@platform/auth-client";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import { DevSystemResetPanel } from "../../components/DevSystemResetPanel";
import {
  requestActivationTicket,
  submitCreateStaffUser,
  submitDeleteStaffUser,
  submitUnlockStaffUser,
  submitUpdateStaffUser,
} from "../../lib/users-api";
import { useStaffUsersQuery } from "../../query/settings-queries";

const EditStaffUserModal = dynamic(
  () =>
    import("../../components/EditStaffUserModal").then(
      (m) => m.EditStaffUserModal,
    ),
  { ssr: false },
);
const UserProfileModal = dynamic(
  () =>
    import("../../components/UserProfileModal").then((m) => m.UserProfileModal),
  { ssr: false },
);

// تحميل مسبق عند التحويم/التركيز — بدونها ينتظر المستخدم جلب الحزمة بعد النقر
// مباشرة (bundle-preload). أزرار الصفوف تُحوَّم قبل النقر عادةً.
const preloadEditStaffUserModal = () =>
  void import("../../components/EditStaffUserModal");
const preloadUserProfileModal = () =>
  void import("../../components/UserProfileModal");

const ROLE_OPTIONS = adminStaffRoleOptions();
const ROLE_SELECT_OPTIONS = ROLE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));
const SUPERVISOR_DEPARTMENT_SELECT_OPTIONS = SUPERVISOR_DEPARTMENT_OPTIONS.map(
  (o) => ({ value: o.value, label: o.label }),
);
const INSPECTOR_TYPE_OPTIONS = [
  { value: "employee", label: "موظف" },
  { value: "contractor", label: "متعاون" },
];

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

function statusTone(
  status: string | undefined,
): "success" | "danger" | "warning" | "default" {
  if (status === "Active") return "success";
  if (status === "Locked") return "danger";
  if (status === "PendingActivation") return "warning";
  return "default";
}

function statusLabel(status: string | undefined): string {
  if (status === "Active") return "نشط";
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

function deptLabel(user: StaffUser): string {
  return (
    supervisingDepartmentLabel(user.department) ||
    user.department?.trim() ||
    "—"
  );
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
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "on" | "off">("all");
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    body: string;
    confirm: string;
    onConfirm: () => void;
  } | null>(null);
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

  // الإدخال فوري والترشيح مؤجل إطاراً — ترشيح محلي بحت (rerender-use-deferred-value).
  const deferredSearch = useDeferredValue(search);

  const filteredUsers = useMemo(() => {
    const q = deferredSearch.trim();
    return users.filter((user) => {
      if (statusFilter === "on" && user.status !== "Active") return false;
      if (
        statusFilter === "off" &&
        user.status !== "Disabled" &&
        user.status !== "Locked"
      ) {
        return false;
      }
      if (!q) return true;
      return user.name.includes(q);
    });
  }, [users, deferredSearch, statusFilter]);

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
      setAdding(true);
      // الإبطال يعيد جلب الاستعلام النشط بنفسه — refetch إضافي كان GET ثانياً مطابقاً.
      await queryClient.invalidateQueries({ queryKey: prototypeKeys.staffUsers() });
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
      setAdding(true);
      showToast("تم إصدار دعوة التفعيل.", "success");
    } finally {
      setIssuingTicketFor(null);
    }
  }

  async function onDeleteUser(user: { id: string; name: string }) {
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
      // الإبطال يعيد جلب الاستعلام النشط بنفسه — refetch إضافي كان GET ثانياً مطابقاً.
      await queryClient.invalidateQueries({ queryKey: prototypeKeys.staffUsers() });
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
      // الإبطال يعيد جلب الاستعلام النشط بنفسه — refetch إضافي كان GET ثانياً مطابقاً.
      await queryClient.invalidateQueries({ queryKey: prototypeKeys.staffUsers() });
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
      // الإبطال يعيد جلب الاستعلام النشط بنفسه — refetch إضافي كان GET ثانياً مطابقاً.
      await queryClient.invalidateQueries({ queryKey: prototypeKeys.staffUsers() });
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
      // الإبطال يعيد جلب الاستعلام النشط بنفسه — refetch إضافي كان GET ثانياً مطابقاً.
      await queryClient.invalidateQueries({ queryKey: prototypeKeys.staffUsers() });
      showToast("تم فك قفل الحساب.", "success");
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
      {!canManage ? (
        <Note tone="warn" className="mb-3 max-w-[560px]">
          الرابط صحيح، لكن دورك الحالي لا يملك صلاحية هذا البند. اطلب الصلاحية من مسؤول النظام.
        </Note>
      ) : null}
      {loadError ? <Note tone="warn">{loadError}</Note> : null}

      <div className="mb-3 flex flex-wrap gap-2.5">
        <Input
          className="h-[34px] max-w-[260px] py-0 text-[12.5px] leading-[34px]"
          placeholder="بحث بالاسم…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          className="h-[34px] max-w-[170px] py-0 text-[12.5px] leading-[34px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "on" | "off")}
        >
          <option value="all">كل الحالات</option>
          <option value="on">نشط</option>
          <option value="off">معطّل</option>
        </Select>
        {canManage ? (
          <Button
            variant="default"
            onClick={() => {
              setCreatedUser(null);
              setActivationTicket(null);
              setErrors({});
              setAdding(true);
            }}
          >
            إضافة مستخدم
          </Button>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        {isPending && users.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-text-3">
            <Spinner />
            <span className="text-[13px]">جاري التحميل…</span>
          </div>
        ) : (
          <Table className="tabular-nums">
            <THead>
              <Tr hoverable={false}>
                <Th>الاسم</Th>
                <Th>الدور</Th>
                <Th>القسم</Th>
                <Th>آخر دخول</Th>
                <Th>الحالة</Th>
                <Th />
              </Tr>
            </THead>
            <TBody>
              {filteredUsers.length === 0 ? (
                <Tr hoverable={false}>
                  <Td colSpan={6} className="py-10 text-center text-[12.5px] text-text-3">
                    {users.length === 0
                      ? "لا يوجد مستخدمون بعد"
                      : "لا يوجد مستخدمون مطابقون للبحث"}
                  </Td>
                </Tr>
              ) : (
                filteredUsers.map((user) => {
                  const busy =
                    deletingId === user.id || pendingActionId === user.id;
                  const toggleLabel =
                    user.status === "Locked"
                      ? "فك القفل"
                      : user.status === "PendingActivation"
                        ? "دعوة"
                        : user.status === "Disabled"
                          ? "تفعيل"
                          : "تعطيل";
                  return (
                    <Tr key={user.id} hoverable={false}>
                      <Td className="font-medium">
                        <button
                          type="button"
                          className="cursor-pointer border-0 bg-transparent p-0 text-start font-medium text-inherit hover:text-gold-d"
                          onClick={() => setProfileUser(user)}
                          onMouseEnter={preloadUserProfileModal}
                          onFocus={preloadUserProfileModal}
                        >
                          {user.name}
                        </button>
                        {/* ورشة الترقيم (بند البتّ 5): الرقم المرجعي يظهر لا يُخفى. */}
                        {user.referenceNumber ? (
                          <span
                            className="block text-[10px] text-text-3"
                            dir="ltr"
                          >
                            {user.referenceNumber}
                          </span>
                        ) : null}
                      </Td>
                      <Td>{user.role}</Td>
                      <Td>{deptLabel(user)}</Td>
                      <Td>
                        <bdi>{formatLastLogin(user.lastLoginAtUtc)}</bdi>
                      </Td>
                      <Td>
                        <Badge tone={statusTone(user.status)}>
                          {statusLabel(user.status)}
                        </Badge>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {canManage ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingUser(user)}
                              onMouseEnter={preloadEditStaffUserModal}
                              onFocus={preloadEditStaffUserModal}
                            >
                              تعديل
                            </Button>{" "}
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={
                                busy || issuingTicketFor === user.id
                              }
                              disabled={busy || issuingTicketFor === user.id}
                              onClick={() => {
                                if (user.status === "Active") {
                                  if (!canDeleteUser(user, currentUserId)) {
                                    showToast("لا يمكن تعطيل هذا الحساب.", "error");
                                    return;
                                  }
                                  setConfirm({
                                    title: "تعطيل مستخدم",
                                    body: `«${user.name}» يفقد الدخول فوراً وتبقى سجلاته في سجل التدقيق.`,
                                    confirm: "تعطيل",
                                    onConfirm: () => void onDeleteUser(user),
                                  });
                                  return;
                                }
                                if (user.status === "Disabled") {
                                  void onReactivateUser(user);
                                  return;
                                }
                                if (user.status === "Locked") {
                                  void onUnlockUser(user);
                                  return;
                                }
                                void onIssueActivationTicket(user.id);
                              }}
                            >
                              {toggleLabel}
                            </Button>
                          </>
                        ) : null}
                      </Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        )}
      </Card>
      <p className="mx-0.5 mt-2.5 text-[11.5px] text-text-3">
        ٨ أدوار معرّفة مسبقاً بصلاحياتها — تحرير الأدوار نفسها غير متاح في هذه المرحلة.
      </p>

      <div className="mt-6">
        <DevSystemResetPanel />
      </div>

      {adding ? (
        <ModalOverlay
          onClick={() => {
            if (saving) return;
            setAdding(false);
          }}
        >
          <ModalCard
            className="max-h-[90vh] w-full max-w-[640px] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
            aria-labelledby="add-user-title"
          >
            <ModalHeader>
              <ModalTitle id="add-user-title">إضافة مستخدم</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <p className="m-0 mb-3 text-[12px] text-text-3">
                اسم الدخول يُنشأ تلقائياً ويُفعَّل بدعوة لمرة واحدة.
              </p>
              <form id="add-staff-user" onSubmit={(e) => void onSubmit(e)}>
                <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
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
                    options={ROLE_SELECT_OPTIONS}
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
                      options={SUPERVISOR_DEPARTMENT_SELECT_OPTIONS}
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
                      options={INSPECTOR_TYPE_OPTIONS}
                      value={form.inspectorType}
                      onChange={(v) =>
                        updateField("inspectorType", v as FormState["inspectorType"])
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
                      form.hasCompensation && "border-gold/40 bg-gold-soft text-heading",
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
                        onChange={(v) => updateField("commercialRegistration", v)}
                        hint="اختياري"
                      />
                    </>
                  ) : null}
                </div>
                {errors._form ? (
                  <Note tone="danger" className="mt-3 text-xs">
                    {errors._form}
                  </Note>
                ) : null}
                {createdUser ? (
                  <div className="mt-3 rounded-[var(--radius)] border border-success/25 bg-success-bg px-3.5 py-3 text-xs leading-relaxed text-success-text">
                    <strong>تم إنشاء الحساب — بانتظار التفعيل</strong>
                    <div className="mt-2" dir="ltr">
                      <span className="text-text-3">username:</span> {createdUser.userName}
                    </div>
                    <div className="mt-2.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={issuingTicketFor === createdUser.id}
                        loading={issuingTicketFor === createdUser.id}
                        onClick={() => void onIssueActivationTicket(createdUser.id)}
                      >
                        إرسال دعوة التفعيل
                      </Button>
                    </div>
                  </div>
                ) : null}
                {activationTicket ? (
                  <div className="mt-3 rounded-[var(--radius)] border border-warning/35 bg-warning-bg px-3.5 py-3 text-xs leading-relaxed text-text">
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
                        className="min-h-0 resize-none bg-surface-2 font-mono text-[10.5px] leading-relaxed text-ink"
                        value={activationTicket.token}
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    </div>
                  </div>
                ) : null}
              </form>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="ghost"
                onClick={() => setAdding(false)}
                disabled={saving}
              >
                إغلاق
              </Button>
              {!createdUser ? (
                <Button
                  variant="primary"
                  type="submit"
                  form="add-staff-user"
                  loading={saving}
                >
                  إنشاء المستخدم
                </Button>
              ) : null}
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      ) : null}

      {profileUser ? (
        <UserProfileModal user={profileUser} onClose={() => setProfileUser(null)} />
      ) : null}

      {editingUser ? (
        <EditStaffUserModal
          user={editingUser}
          saving={pendingActionId === editingUser.id}
          onSubmit={(patch) => onSaveEdit(editingUser.id, patch)}
          onClose={() => setEditingUser(null)}
        />
      ) : null}

      {confirm ? (
        <ModalOverlay onClick={() => setConfirm(null)}>
          <ModalCard
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
            aria-labelledby="users-confirm-title"
          >
            <ModalHeader>
              <ModalTitle id="users-confirm-title">{confirm.title}</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <p className="m-0 text-[13px] leading-relaxed text-text-2">{confirm.body}</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                إلغاء
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const run = confirm.onConfirm;
                  setConfirm(null);
                  run();
                }}
              >
                {confirm.confirm}
              </Button>
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      ) : null}
    </PageShell>
  );
}
