"use client";

import { useEffect, useState } from "react";
import {
  AppModal,
  Button,
  Note,
} from "@platform/ui-kit";
import { RegField, RegTextarea } from "@platform/app-shared/registration/FormFields";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import { UnsavedChangesDialog } from "@platform/app-shared/registration/UnsavedChangesDialog";
import type { PoIntakeRecord } from "../../lib/app-data/po-intake-data";
import { AssignmentTypeFields } from "@case-study/mfe/components/po-intake/AssignmentTypeFields";
import { AssignmentValuationFields } from "@case-study/mfe/components/po-intake/AssignmentValuationFields";
import { PoWorkOrderPartyFields } from "@case-study/mfe/components/po-intake/PoWorkOrderPartyFields";
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
  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => {
    if (!open) setDiscardOpen(false);
  }, [open]);

  function requestClose() {
    if (form.saving || discardOpen) return;
    if (form.isDirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }

  return (
    <>
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
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
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
          <AssignmentTypeFields
            value={form.assignmentType}
            allowEmpty
            error={form.fieldErrors.assignmentType}
            onChange={(v) => form.setAssignmentType(v)}
          />
          <PoWorkOrderPartyFields
            idPrefix="po_modal"
            assignmentType={form.assignmentType}
            clientId={form.clientId}
            subClientId={form.subClientId}
            clients={form.clients}
            clientsLoading={form.clientsLoading}
            clientError={form.fieldErrors.clientId}
            subClientError={form.fieldErrors.subClientId}
            clientLocked
            onClientChange={form.setClientId}
            onSubClientChange={form.setSubClientId}
          />
          <AssignmentValuationFields
            idPrefix="po_modal"
            assignmentType={form.assignmentType}
            subClientId={form.subClientId}
            purposeKey={form.valuationPurposeKey}
            basisKey={form.basisOfValueKey}
            premiseKey={form.valuePremiseKey}
            onPurposeChange={form.setValuationPurposeKey}
            onBasisChange={form.setBasisOfValueKey}
            onPremiseChange={form.setValuePremiseKey}
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
    <UnsavedChangesDialog
      open={discardOpen}
      onStay={() => setDiscardOpen(false)}
      onLeave={() => {
        setDiscardOpen(false);
        onClose();
      }}
    />
    </>
  );
}
