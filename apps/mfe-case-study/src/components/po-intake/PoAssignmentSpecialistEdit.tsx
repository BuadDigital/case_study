"use client";

import { useState } from "react";
import type { PoIntakeRecord } from "../../lib/app-data/po-intake-data";
import { updatePoAssignmentSpecialist } from "../../lib/app-data/po-intake-commands";
import { RegField } from "@platform/app-shared/registration/FormFields";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import { Note } from "@platform/ui-kit";
import { PoEditShell } from "./PoEditShell";

/**
 * The case specialist's view of «تعديل أمر العمل»: the assignment specialist's name is provisional
 * at receipt and confirmed later, so it is the one header field the case specialist corrects.
 */
export function PoAssignmentSpecialistEdit({
  record,
  onBackAction,
  onSavedAction,
}: {
  record: PoIntakeRecord;
  onBackAction: () => void;
  onSavedAction: () => void;
}) {
  const [assignmentSpecialist, setAssignmentSpecialist] = useState(
    record.assignmentSpecialist,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isDirty = assignmentSpecialist.trim() !== record.assignmentSpecialist.trim();

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    const result = await updatePoAssignmentSpecialist(
      record.poNumber,
      assignmentSpecialist,
    );
    setSaving(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    onSavedAction();
  }

  return (
    <PoEditShell
      title={`تعديل أخصائي الإسناد — ${record.poNumber}`}
      subtitle="الاسم المسجّل عند الاستلام مبدئي — ثبّته بعد التأكد منه"
      isDirty={isDirty}
      saving={saving}
      onBack={onBackAction}
      onSave={() => void handleSave()}
    >
      {formError ? <Note tone="warn">{formError}</Note> : null}

      <RegistrationFormCard title="أخصائي الإسناد">
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
          <RegField
            id="po_number_ro"
            label="رقم PO (التعميد)"
            value={record.poNumber}
            dir="ltr"
            readOnly
          />
          <RegField
            id="po_specialist_edit"
            label="اسم أخصائي الإسناد"
            value={assignmentSpecialist}
            onChange={setAssignmentSpecialist}
          />
        </div>
      </RegistrationFormCard>
    </PoEditShell>
  );
}
