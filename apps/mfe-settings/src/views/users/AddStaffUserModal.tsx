"use client";

/**
 * "إضافة مستخدم" dialog: the create form (basic data, identity, compensation,
 * engineering-office extras) and the created-account note (phone login ready).
 */

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
import type { UsersOrganizationWorkflow } from "./useUsersOrganizationWorkflow";
import { StaffUserFormFields } from "../../components/StaffUserFormFields";

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
            اسم الدخول يُنشأ تلقائياً. يدخل المستخدم برقم الجوال (شاشة رمز التحقق).
          </p>
          <form id="add-staff-user" onSubmit={(e) => void onSubmit(e)}>
            <StaffUserFormFields
              idPrefix="staff"
              form={form}
              errors={errors}
              updateField={updateField}
              changeRole={changeRole}
              nationalIdRequired
            />
            {errors._form ? (
              <Note tone="danger" className="mt-3 text-xs">
                {errors._form}
              </Note>
            ) : null}
            {createdUser ? (
              <div className="mt-3 rounded-[var(--radius)] border border-success/25 bg-success-bg px-3.5 py-3 text-xs leading-relaxed text-success-text">
                <strong>تم إنشاء الحساب — جاهز لتسجيل الدخول بالجوال</strong>
                <div className="mt-2" dir="ltr">
                  <span className="text-text-3">username:</span> {createdUser.userName}
                </div>
                {createdUser.mobile ? (
                  <div className="mt-1" dir="ltr">
                    <span className="text-text-3">mobile:</span> {createdUser.mobile}
                  </div>
                ) : null}
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
