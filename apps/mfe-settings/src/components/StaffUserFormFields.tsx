"use client";

/**
 * The staff-user form grid shared by «إضافة مستخدم» and «تعديل المستخدم»: basic data,
 * identity, compensation and the engineering-office extras. What differs between the two
 * dialogs (field id prefix, role lock, required national id, the mobile hint) comes in as props;
 * `children` lands at the end of the grid (the edit dialog's «البيانات المهنية»).
 */

import type { ReactNode } from "react";
import type { RoleId } from "@platform/types";
import { isSectionSupervisorRole } from "@platform/app-shared/users/admin-staff-roles";
import { RegField, RegSelect } from "@platform/app-shared/registration/FormFields";
import type { FieldErrors } from "@platform/app-shared/registration/registration-utils";
import { cn } from "@platform/ui-kit";
import {
  INSPECTOR_TYPE_OPTIONS,
  ROLE_SELECT_OPTIONS,
  SUPERVISOR_DEPARTMENT_SELECT_OPTIONS,
  type StaffFormState,
} from "../views/users/users-organization-state";
import { FormSectionLabel } from "./FormSectionLabel";

export function StaffUserFormFields({
  idPrefix,
  form,
  errors,
  updateField,
  changeRole,
  nationalIdRequired,
  roleLockReason,
  mobileHint,
  children,
}: {
  /** Prefix of every control id («staff» in the add dialog, «edit» in the edit dialog). */
  idPrefix: string;
  form: StaffFormState;
  errors: FieldErrors;
  updateField: <K extends keyof StaffFormState>(key: K, value: StaffFormState[K]) => void;
  changeRole: (roleId: RoleId | "") => void;
  nationalIdRequired?: boolean;
  /** When set, the role select is locked and this reason shows under it. */
  roleLockReason?: string | null;
  mobileHint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
      <FormSectionLabel>البيانات الأساسية</FormSectionLabel>
      <RegField
        id={`${idPrefix}-displayName`}
        label="الاسم"
        required
        placeholder="الاسم الكامل"
        value={form.displayName}
        onChange={(v) => updateField("displayName", v)}
        error={errors.displayName}
      />
      <RegSelect
        id={`${idPrefix}-roleId`}
        label="الدور"
        required
        placeholder="اختر الدور"
        options={ROLE_SELECT_OPTIONS}
        value={form.roleId}
        disabled={Boolean(roleLockReason)}
        hint={roleLockReason ?? undefined}
        onChange={(v) => changeRole(v as RoleId | "")}
        error={errors.roleId}
      />
      <RegField
        id={`${idPrefix}-mobile`}
        label="رقم الجوال"
        required
        dir="ltr"
        inputMode="tel"
        placeholder="05xxxxxxxx"
        value={form.mobile}
        onChange={(v) => updateField("mobile", v)}
        error={errors.mobile}
        hint={mobileHint}
      />
      <RegField
        id={`${idPrefix}-city`}
        label="المدينة"
        required
        placeholder="مثال: الرياض"
        value={form.city}
        onChange={(v) => updateField("city", v)}
        error={errors.city}
      />
      {isSectionSupervisorRole(form.roleId) ? (
        <RegSelect
          id={`${idPrefix}-department`}
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
          id={`${idPrefix}-inspectorType`}
          label="نوع المعاين"
          required
          placeholder="اختر النوع"
          options={INSPECTOR_TYPE_OPTIONS}
          value={form.inspectorType}
          onChange={(v) => updateField("inspectorType", v as StaffFormState["inspectorType"])}
          error={errors.inspectorType}
        />
      ) : null}
      <FormSectionLabel>الهوية والالتحاق</FormSectionLabel>
      <RegField
        id={`${idPrefix}-nationalId`}
        label="رقم الهوية"
        required={nationalIdRequired}
        dir="ltr"
        inputMode="numeric"
        placeholder="1xxxxxxxxx"
        value={form.nationalId}
        onChange={(v) => updateField("nationalId", v)}
        error={errors.nationalId}
      />
      <RegField
        id={`${idPrefix}-joinedAt`}
        label="تاريخ الالتحاق"
        type="date"
        value={form.joinedAt}
        onChange={(v) => updateField("joinedAt", v)}
        hint="اختياري"
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
          onChange={(event) => updateField("hasCompensation", event.target.checked)}
        />
        يستحق تعويضاً مالياً
      </label>
      {form.hasCompensation ? (
        <RegField
          id={`${idPrefix}-feeValueSar`}
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
        id={`${idPrefix}-iban`}
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
            id={`${idPrefix}-taxNumber`}
            label="الرقم الضريبي"
            dir="ltr"
            value={form.taxNumber}
            onChange={(v) => updateField("taxNumber", v)}
            hint="اختياري"
          />
          <RegField
            id={`${idPrefix}-commercialRegistration`}
            label="السجل التجاري"
            dir="ltr"
            value={form.commercialRegistration}
            onChange={(v) => updateField("commercialRegistration", v)}
            hint="اختياري"
          />
        </>
      ) : null}
      {children}
    </div>
  );
}
