"use client";

import { useMemo, useState } from "react";
import type { RoleId } from "@platform/types";
import type {
  OrganizationValuerRosterEntry,
  UpdateStaffUserRequest,
} from "@platform/api-client";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import {
  isSectionSupervisorRole,
  SUPERVISOR_DEPARTMENT_OPTIONS,
} from "@platform/app-shared/users/admin-staff-roles";
import {
  mergeFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/registration/registration-utils";
import {
  applyRoleChange,
  professionalEquals,
  professionalFromRow,
  staffRoleChangeBlocked,
  staffRoleSelectLocked,
  unlinkedRosterRows,
  withoutFieldError,
  withoutRoleErrors,
  type StaffFormState,
  type StaffProfessional,
} from "../views/users/users-organization-state";
import { StaffProfessionalFields } from "./StaffProfessionalFields";
import { StaffUserFormFields } from "./StaffUserFormFields";
import {
  Button,
  ModalBody,
  ModalCard,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Note,
} from "@platform/ui-kit";

function initialForm(user: StaffUser): StaffFormState {
  return {
    displayName: user.name ?? "",
    mobile: user.phone ?? "",
    city: user.city ?? "",
    roleId: (user.roleId as RoleId | undefined) ?? "",
    department: user.department ?? "",
    nationalId: user.nationalId ?? "",
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

function validate(form: StaffFormState): FieldErrors {
  return mergeFieldErrors(
    form.displayName.trim() ? undefined : { displayName: "الاسم مطلوب." },
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
  );
}

/**
 * Sends only what the administrator actually touched. An untouched member is omitted so the
 * server keeps its stored value; a cleared optional field is sent as an empty string.
 */
function buildPatch(
  form: StaffFormState,
  original: StaffFormState,
): UpdateStaffUserRequest {
  const patch: UpdateStaffUserRequest = {};

  const required = [
    ["displayName", "displayName"],
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
  users,
  rosterRow,
  valuers,
  viewerUserId,
  saving,
  onSubmit,
  onClose,
}: {
  user: StaffUser;
  users: StaffUser[];
  /** The account's valuers-roster row, when it has one — source of «البيانات المهنية». */
  rosterRow: OrganizationValuerRosterEntry | null;
  /** The whole roster, to offer unlinked rows to a card without one. */
  valuers: OrganizationValuerRosterEntry[];
  viewerUserId: string | null;
  saving: boolean;
  onSubmit: (
    patch: UpdateStaffUserRequest,
    professional: StaffProfessional,
  ) => Promise<FieldErrors | null>;
  onClose: () => void;
}) {
  const original = useMemo(() => initialForm(user), [user]);
  const [form, setForm] = useState<StaffFormState>(original);
  const originalPro = useMemo(
    () => professionalFromRow(rosterRow, user.roleId),
    [rosterRow, user.roleId],
  );
  const [pro, setPro] = useState<StaffProfessional>(originalPro);
  const [errors, setErrors] = useState<FieldErrors>({});
  const roleLockReason = staffRoleSelectLocked(viewerUserId, user, users);

  function updateField<K extends keyof StaffFormState>(key: K, value: StaffFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => withoutFieldError(prev, key));
  }

  function changeRole(roleId: RoleId | "") {
    setForm((prev) => applyRoleChange(prev, roleId));
    setErrors((prev) => withoutRoleErrors(prev));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const clientErrors = validate(form);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    const patch = buildPatch(form, original);
    if (Object.keys(patch).length === 0 && professionalEquals(pro, originalPro)) {
      setErrors({ _form: "لا توجد تغييرات لحفظها." });
      return;
    }

    const roleBlocked = staffRoleChangeBlocked(
      viewerUserId,
      user,
      form.roleId,
      users,
    );
    if (roleBlocked) {
      setErrors({ roleId: roleBlocked });
      return;
    }

    const serverErrors = await onSubmit(patch, pro);
    if (serverErrors) setErrors(serverErrors);
  }

  return (
    <ModalOverlay
      role="presentation"
      onClick={() => {
        if (saving) return;
        onClose();
      }}
    >
      <ModalCard
        className="max-h-[90vh] w-full max-w-[640px] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-labelledby="edit-user-title"
      >
        <ModalHeader>
          <ModalTitle id="edit-user-title">تعديل المستخدم</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="m-0 mb-3 text-[12px] text-text-3">
            {user.name} · يدخل برقم الجوال. الصفة في تقرير التقييم والتوقيع في «البيانات المهنية»
            أسفل النموذج.
          </p>
          <form id="edit-staff-user" onSubmit={(e) => void handleSubmit(e)}>
            <StaffUserFormFields
              idPrefix="edit"
              form={form}
              errors={errors}
              updateField={updateField}
              changeRole={changeRole}
              roleLockReason={roleLockReason}
              mobileHint="تغييره يُلغي تأكيد الرقم"
            >
              <StaffProfessionalFields
                value={pro}
                onChange={setPro}
                disabled={saving}
                hasRow={rosterRow !== null}
                unlinkedRows={unlinkedRosterRows(valuers)}
              />
            </StaffUserFormFields>
            {errors._form ? (
              <Note tone="danger" className="mt-3 text-xs">
                {errors._form}
              </Note>
            ) : null}
          </form>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            إغلاق
          </Button>
          <Button variant="primary" type="submit" form="edit-staff-user" loading={saving}>
            حفظ التعديلات
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
