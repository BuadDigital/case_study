"use client";

/**
 * "إضافة مستخدم" dialog: the create form (basic data, identity, compensation,
 * engineering-office extras), the created-account note and the one-time
 * activation ticket.
 */

import type { ReactNode } from "react";
import type { RoleId } from "@platform/types";
import { isSectionSupervisorRole } from "@platform/app-shared/users/admin-staff-roles";
import { RegField, RegSelect } from "@platform/app-shared/registration/FormFields";
import {
  Button,
  ModalBody,
  ModalCard,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Note,
  Textarea,
  cn,
} from "@platform/ui-kit";
import {
  INSPECTOR_TYPE_OPTIONS,
  ROLE_SELECT_OPTIONS,
  SUPERVISOR_DEPARTMENT_SELECT_OPTIONS,
  type StaffFormState,
} from "./users-organization-state";
import type { UsersOrganizationWorkflow } from "./useUsersOrganizationWorkflow";

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

export function AddStaffUserModal({ workflow }: { workflow: UsersOrganizationWorkflow }) {
  const {
    form,
    errors,
    saving,
    updateField,
    changeRole,
    closeAdd,
    onSubmit,
    createdUser,
    activationTicket,
    issuingTicketFor,
    onIssueActivationTicket,
  } = workflow;

  return (
    <ModalOverlay
      onClick={() => {
        if (saving) return;
        closeAdd();
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
            اسم الدخول يُنشأ تلقائياً ويُفعَّل بدعوة لمرة واحدة.
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
                onChange={(v) => changeRole(v as RoleId | "")}
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
                    updateField("inspectorType", v as StaffFormState["inspectorType"])
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
                  onChange={(event) => updateField("hasCompensation", event.target.checked)}
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
          <Button variant="ghost" onClick={closeAdd} disabled={saving}>
            إغلاق
          </Button>
          {!createdUser ? (
            <Button variant="primary" type="submit" form="add-staff-user" loading={saving}>
              إنشاء المستخدم
            </Button>
          ) : null}
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
