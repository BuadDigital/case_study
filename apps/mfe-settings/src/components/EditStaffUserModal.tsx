"use client";

import { useMemo, useState } from "react";
import type { RoleId } from "@platform/types";
import type { UpdateStaffUserRequest } from "@platform/api-client";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
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
  mergeFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/registration/registration-utils";
import {
  Button,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Note,
} from "@platform/design-system";

const ROLE_OPTIONS = adminStaffRoleOptions();

type FormState = {
  displayName: string;
  email: string;
  mobile: string;
  city: string;
  roleId: RoleId | "";
  department: string;
  nationalId: string;
  avatarUrl: string;
  inspectorType: "employee" | "contractor" | "";
  hasCompensation: boolean;
  feeValueSar: string;
  iban: string;
  taxNumber: string;
  commercialRegistration: string;
  joinedAt: string;
};

function initialForm(user: StaffUser): FormState {
  return {
    displayName: user.name ?? "",
    email: user.email ?? "",
    mobile: user.phone ?? "",
    city: user.city ?? "",
    roleId: (user.roleId as RoleId | undefined) ?? "",
    department: user.department ?? "",
    nationalId: user.nationalId ?? "",
    avatarUrl: user.avatarUrl ?? "",
    inspectorType: user.inspectorType ?? "",
    hasCompensation: user.hasCompensation ?? false,
    feeValueSar:
      user.feeValueSar === null || user.feeValueSar === undefined
        ? ""
        : String(user.feeValueSar),
    iban: user.iban ?? "",
    taxNumber: user.taxNumber ?? "",
    commercialRegistration: user.commercialRegistration ?? "",
    joinedAt: user.joinedAt ? user.joinedAt.slice(0, 10) : "",
  };
}

function validate(form: FormState): FieldErrors {
  return mergeFieldErrors(
    form.displayName.trim() ? undefined : { displayName: "الاسم مطلوب." },
    form.email.trim() ? undefined : { email: "البريد الإلكتروني مطلوب." },
    form.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())
      ? { email: "صيغة البريد الإلكتروني غير صحيحة." }
      : undefined,
    form.mobile.trim() ? undefined : { mobile: "رقم الجوال مطلوب." },
    form.mobile.trim() && !/^(\+9665|05)\d{8}$/.test(form.mobile.trim())
      ? { mobile: "صيغة رقم الجوال غير صحيحة." }
      : undefined,
    form.city.trim() ? undefined : { city: "المدينة مطلوبة." },
    form.roleId ? undefined : { roleId: "الدور مطلوب." },
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
    form.iban.trim() && !/^SA\d{22}$/i.test(form.iban.replace(/\s/g, ""))
      ? { iban: "صيغة الآيبان السعودي غير صحيحة." }
      : undefined,
    form.avatarUrl.trim() && !/^https?:\/\/\S+$/i.test(form.avatarUrl.trim())
      ? { avatarUrl: "رابط الصورة الشخصية غير صالح." }
      : undefined,
  );
}

/**
 * Sends only what the administrator actually touched. An untouched member is omitted so the
 * server keeps its stored value; a cleared optional field is sent as an empty string.
 */
function buildPatch(
  form: FormState,
  original: FormState,
): UpdateStaffUserRequest {
  const patch: UpdateStaffUserRequest = {};

  const required = [
    ["displayName", "displayName"],
    ["email", "email"],
    ["mobile", "mobile"],
    ["city", "city"],
    ["nationalId", "nationalId"],
  ] as const;
  for (const [key] of required) {
    const next = form[key].trim();
    if (next !== original[key].trim()) patch[key] = next;
  }

  if (form.roleId && form.roleId !== original.roleId) patch.roleId = form.roleId;

  if (isSectionSupervisorRole(form.roleId)) {
    const next = form.department.trim();
    if (next !== original.department.trim()) patch.department = next;
  } else if (isSectionSupervisorRole(original.roleId) || original.department.trim()) {
    // Leaving the supervisor role (or clearing a stale free-text value) lets the server derive.
    if (form.department.trim() !== original.department.trim() || form.roleId !== original.roleId)
      patch.department = "";
  }

  const optional = [
    "avatarUrl",
    "iban",
    "taxNumber",
    "commercialRegistration",
  ] as const;
  for (const key of optional) {
    const next = form[key].trim();
    if (next !== original[key].trim()) patch[key] = next;
  }

  if (form.inspectorType !== original.inspectorType)
    patch.inspectorType = form.inspectorType;
  if (form.hasCompensation !== original.hasCompensation)
    patch.hasCompensation = form.hasCompensation;
  if (form.hasCompensation && form.feeValueSar !== original.feeValueSar)
    patch.feeValueSar = Number(form.feeValueSar);
  if (form.joinedAt !== original.joinedAt && form.joinedAt)
    patch.joinedAt = form.joinedAt;

  return patch;
}

export function EditStaffUserModal({
  user,
  saving,
  onSubmit,
  onClose,
}: {
  user: StaffUser;
  saving: boolean;
  onSubmit: (patch: UpdateStaffUserRequest) => Promise<FieldErrors | null>;
  onClose: () => void;
}) {
  const original = useMemo(() => initialForm(user), [user]);
  const [form, setForm] = useState<FormState>(original);
  const [errors, setErrors] = useState<FieldErrors>({});

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const clientErrors = validate(form);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    const patch = buildPatch(form, original);
    if (Object.keys(patch).length === 0) {
      setErrors({ _form: "لا توجد تغييرات لحفظها." });
      return;
    }

    const serverErrors = await onSubmit(patch);
    if (serverErrors) setErrors(serverErrors);
  }

  return (
    <ModalOverlay role="presentation" onClick={onClose}>
      <ModalCard
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-title"
        className="max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={(e) => void handleSubmit(e)}>
          <ModalHeader className="border-0 bg-ink text-white">
            <span aria-hidden className="text-gold">
              ✎
            </span>
            <ModalTitle id="edit-user-title" className="text-start text-white">
              تعديل المستخدم
            </ModalTitle>
            <ModalClose
              className="text-white/70 hover:bg-white/10 hover:text-white"
              onClick={onClose}
            >
              ×
            </ModalClose>
          </ModalHeader>

          <ModalBody className="max-h-[70vh] space-y-4 overflow-y-auto">
            {errors._form ? (
              <Note tone="danger" className="text-xs">
                {errors._form}
              </Note>
            ) : null}

            <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
              <RegField
                id="edit-displayName"
                label="الاسم"
                required
                value={form.displayName}
                onChange={(v) => updateField("displayName", v)}
                error={errors.displayName}
              />
              <RegSelect
                id="edit-roleId"
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
                id="edit-email"
                label="البريد الإلكتروني"
                required
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(v) => updateField("email", v)}
                error={errors.email}
              />
              <RegField
                id="edit-mobile"
                label="رقم الجوال"
                required
                dir="ltr"
                inputMode="tel"
                placeholder="05xxxxxxxx"
                value={form.mobile}
                onChange={(v) => updateField("mobile", v)}
                error={errors.mobile}
                hint="تغييره يُلغي تأكيد الرقم"
              />
              <RegField
                id="edit-city"
                label="المدينة"
                required
                value={form.city}
                onChange={(v) => updateField("city", v)}
                error={errors.city}
              />
              {isSectionSupervisorRole(form.roleId) ? (
                <RegSelect
                  id="edit-department"
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
              <RegField
                id="edit-nationalId"
                label="رقم الهوية"
                dir="ltr"
                inputMode="numeric"
                value={form.nationalId}
                onChange={(v) => updateField("nationalId", v)}
                error={errors.nationalId}
              />
              <RegField
                id="edit-joinedAt"
                label="تاريخ الالتحاق"
                type="date"
                value={form.joinedAt}
                onChange={(v) => updateField("joinedAt", v)}
              />
              {form.roleId === "field-inspector" ? (
                <RegSelect
                  id="edit-inspectorType"
                  label="نوع المعاين"
                  required
                  placeholder="اختر النوع"
                  options={[
                    { value: "employee", label: "موظف" },
                    { value: "contractor", label: "متعاون" },
                  ]}
                  value={form.inspectorType}
                  onChange={(v) =>
                    updateField("inspectorType", v as FormState["inspectorType"])
                  }
                  error={errors.inspectorType}
                />
              ) : null}
              <RegField
                id="edit-avatarUrl"
                label="رابط الصورة الشخصية"
                dir="ltr"
                value={form.avatarUrl}
                onChange={(v) => updateField("avatarUrl", v)}
                error={errors.avatarUrl}
                className="sm:col-span-2"
              />
              <label
                className={`flex items-center gap-2.5 rounded-[var(--radius)] border border-border bg-surface-2/50 px-3 py-2.5 text-xs font-medium text-text sm:col-span-2 ${
                  form.hasCompensation
                    ? "border-gold/40 bg-gold-soft text-heading"
                    : ""
                }`}
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
                  id="edit-feeValueSar"
                  label="قيمة الأتعاب (ر.س)"
                  required
                  type="number"
                  value={form.feeValueSar}
                  onChange={(v) => updateField("feeValueSar", v)}
                  error={errors.feeValueSar}
                />
              ) : null}
              <RegField
                id="edit-iban"
                label="الآيبان"
                dir="ltr"
                value={form.iban}
                onChange={(v) => updateField("iban", v)}
                error={errors.iban}
              />
              {form.roleId === "engineering-office" ? (
                <>
                  <RegField
                    id="edit-taxNumber"
                    label="الرقم الضريبي"
                    dir="ltr"
                    value={form.taxNumber}
                    onChange={(v) => updateField("taxNumber", v)}
                  />
                  <RegField
                    id="edit-commercialRegistration"
                    label="السجل التجاري"
                    dir="ltr"
                    value={form.commercialRegistration}
                    onChange={(v) => updateField("commercialRegistration", v)}
                  />
                </>
              ) : null}
            </div>
          </ModalBody>

          <ModalFooter className="justify-start">
            <Button
              type="submit"
              variant="primary"
              disabled={saving}
              loading={saving}
            >
              حفظ التعديلات
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
          </ModalFooter>
        </form>
      </ModalCard>
    </ModalOverlay>
  );
}
