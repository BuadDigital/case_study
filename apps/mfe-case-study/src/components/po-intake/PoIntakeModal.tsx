"use client";

import { AppModal } from "@case-study/mfe/components/ui/AppModal";
import { RegField, RegSelect, RegTextarea } from "@platform/app-shared/registration/FormFields";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import { UNSAVED_CONFIRM_MSG } from "@platform/app-shared/registration/registration-utils";
import { Button, Note } from "@platform/design-system";
import {
  ASSIGNMENT_TYPE_OPTIONS,
  type AssignmentType,
  type PoIntakeRecord,
} from "../../lib/prototype/po-intake-data";
import { usePoIntakeForm } from "@case-study/mfe/components/po-intake/usePoIntakeForm";

export function PoIntakeModal({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: (record: PoIntakeRecord) => void;
}) {
  const form = usePoIntakeForm(onComplete);

  function requestClose() {
    if (form.isDirty && !window.confirm(UNSAVED_CONFIRM_MSG)) return;
    onClose();
  }

  return (
    <AppModal
      open={open}
      title="تسجيل أمر عمل (PO) جديد"
      wide
      onClose={requestClose}
      footer={
        <>
          <Button type="button" onClick={requestClose}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={form.saving}
            disabled={form.saving}
            onClick={() => void form.save()}
          >
            حفظ أمر العمل
          </Button>
        </>
      }
    >
      {form.formError ? <Note tone="warn">{form.formError}</Note> : null}

      <RegistrationFormCard>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <RegField
            id="po_number_modal"
            label="رقم التعميد (PO)"
            required
            dir="ltr"
            value={form.poNumber}
            error={form.fieldErrors.poNumber}
            placeholder="مثال: PO-2025-001"
            onChange={form.setPoNumber}
          />
          <RegField
            id="promulgation_date_modal"
            label="تاريخ التعميد"
            required
            type="date"
            value={form.promulgationDate}
            error={form.fieldErrors.promulgationDate}
            onChange={form.setPromulgationDate}
          />
          <RegField
            id="po_specialist_modal"
            label="اسم أخصائي الإسناد"
            value={form.assignmentSpecialist}
            error={form.fieldErrors.assignmentSpecialist}
            onChange={form.setAssignmentSpecialist}
          />
          <RegField
            id="po_specialist_email_modal"
            label="إيميل أخصائي الإسناد"
            type="email"
            dir="ltr"
            value={form.assignmentSpecialistEmail}
            error={form.fieldErrors.assignmentSpecialistEmail}
            onChange={form.setAssignmentSpecialistEmail}
          />
          <RegSelect
            id="assignment_type_modal"
            label="نوع الإسناد"
            required
            options={[...ASSIGNMENT_TYPE_OPTIONS]}
            value={form.assignmentType}
            error={form.fieldErrors.assignmentType}
            onChange={(v) => form.setAssignmentType(v as AssignmentType)}
          />
          <RegField
            id="expected_property_count_modal"
            label="عدد العقارات"
            required
            type="number"
            dir="ltr"
            value={form.expectedPropertyCount}
            error={form.fieldErrors.expectedPropertyCount}
            placeholder="1"
            onChange={(v) => {
              const digits = v.replace(/\D/g, "").slice(0, 3);
              form.setExpectedPropertyCount(digits || "");
            }}
          />
          <RegField
            id="properties_region_modal"
            label="منطقة العقارات"
            value={form.propertiesRegion}
            onChange={form.setPropertiesRegion}
            placeholder="مثال: مكة — الشوقية"
            maxLength={256}
          />
          <div className="col-span-full">
            <RegTextarea
              id="work_order_description_modal"
              label="وصف أمر العمل"
              value={form.workOrderDescription}
              onChange={form.setWorkOrderDescription}
              placeholder="ملاحظات أو وصف عام لأمر العمل (اختياري)"
              rows={3}
            />
          </div>
        </div>
      </RegistrationFormCard>
    </AppModal>
  );
}
