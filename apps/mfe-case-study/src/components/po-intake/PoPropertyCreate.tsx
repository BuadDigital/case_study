"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emptyProperty,formatPoDisplay,isBourseInquiryIdentifier,type PoIntakeRecord,type PoPropertyIntake,}from "../../lib/prototype/po-intake-data";
import { addPropertyToPo, deedExistsInPo } from "../../lib/prototype/po-intake-storage";
import { usePoRecordQuery } from "@case-study/mfe/query/case-study-queries";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import { hasFieldErrors,type FieldErrors,} from "@platform/app-shared/registration/registration-utils";
import { Button, InlineLoadingSkeleton, Label, Note, cn } from "@platform/design-system";
import { PoIntakeWizardShell } from "./PoIntakeWizardShell";
import { PoPropertyEnfathForm } from "./PoPropertyEnfathForm";
import { PoPropertyStackCard } from "./PoPropertyStackCard";
import { findInvalidEnfathPropertyIndex,firstEnfathValidationMessage,mergePropertyEnfathValidation,} from "./po-property-enfath-validation";
import { contactsForApi } from "./po-property-validation";
const PROPERTY_STEPS = ["تسجيل العقارات"] as const;
const PROPERTY_HINT = "أدخل بيانات كل عقار من المعلومات الواردة في منصة إنفاذ والمستندات المرفقة.";

export function PoPropertyCreate({ poNumber, onBackAction,onSavedAction,}: {
  poNumber: string;
  onBackAction: () => void;
  onSavedAction: () => void;
}) {
  const { data: record, isPending: recordLoading } = usePoRecordQuery(poNumber);
  const loading = recordLoading && !record;
  const [properties, setProperties] = useState<PoPropertyIntake[]>([]);
  const [currentProperty, setCurrentProperty] = useState<PoPropertyIntake>(
    emptyProperty,
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const activePropertyRef = useRef<HTMLDivElement>(null);

  const expectedTotal = record?.expectedPropertyCount ?? 1;
  const alreadyRegistered = record?.properties.length ?? 0;
  const remainingSlots = Math.max(0, expectedTotal - alreadyRegistered);

  const hasCurrentDraft = useMemo(
    () =>
      isBourseInquiryIdentifier(currentProperty.identifierType)
        ? !!currentProperty.deedNumber.trim() ||
          !!currentProperty.taskNumber.trim() ||
          !!currentProperty.ownerName.trim()
        : !!currentProperty.deedNumber.trim() ||
          !!currentProperty.taskNumber.trim() ||
          !!currentProperty.ownerName.trim(),
    [
      currentProperty.identifierType,
      currentProperty.district,
      currentProperty.classification,
      currentProperty.deedNumber,
      currentProperty.taskNumber,
      currentProperty.ownerName,
    ],
  );

  const enteredCount =
    properties.length + (hasCurrentDraft ? 1 : 0);

  const propertyOrdinal = alreadyRegistered + properties.length + 1;

  const canAddAnother =
    remainingSlots > 1 && properties.length + 1 < remainingSlots;

  const isDirty = useMemo(
    () => properties.length > 0 || hasCurrentDraft,
    [properties.length, hasCurrentDraft],
  );

  const patchProperty = useCallback(
    <K extends keyof PoPropertyIntake>(key: K, value: PoPropertyIntake[K]) => {
      setCurrentProperty((p) => ({ ...p, [key]: value }));
      setFieldErrors((e) => {
        if (!e[String(key)]) return e;
        const next = { ...e };
        delete next[String(key)];
        return next;
      });
    },
    [],
  );

  function findFirstInvalidFieldId(
    errors: FieldErrors,
    prop: PoPropertyIntake,
  ): string | null {
    const keys = Object.keys(errors);
    const isBourse = isBourseInquiryIdentifier(prop.identifierType);
    for (const key of keys) {
      if (key === "deedNumber") return isBourse ? "deed_number_bourse" : "deed_number";
      if (key === "taskNumber") return isBourse ? "task_number_bourse" : "task_number";
      if (key === "deedDate") return isBourse ? "deed_date_bourse" : "deed_date";
      if (key === "ownerName") return isBourse ? "owner_name_bourse" : "owner_name";
      if (key === "court") return isBourse ? "court_bourse" : "court";
      if (key === "circuit") return isBourse ? "circuit_bourse" : "circuit";
      if (key === "delegationLetterFileName") return `delegation_${prop.id}`;
      if (key === "realEstateRegFileName") return `real_estate_reg_${prop.id}`;
      if (key === "assignmentDocFileName") return `assignment_doc_${prop.id}`;
      if (key.startsWith("contact_phone_")) {
        const idx = key.replace("contact_phone_", "");
        return `po_contact_phone_${idx}`;
      }
      if (key.startsWith("contact_role_")) {
        const idx = key.replace("contact_role_", "");
        return `po_contact_role_${idx}`;
      }
      if (key.startsWith("contact_name_")) {
        const idx = key.replace("contact_name_", "");
        return `po_contact_name_${idx}`;
      }
    }
    return null;
  }

  function scrollToInvalidField(errors: FieldErrors, prop: PoPropertyIntake) {
    const fieldId = findFirstInvalidFieldId(errors, prop);
    if (!fieldId) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(fieldId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLButtonElement
      ) {
        el.focus();
      }
    });
  }

  function commitCurrentProperty(): PoPropertyIntake {
    return {
      ...currentProperty,
      contacts: contactsForApi(currentProperty.contacts),
    };
  }

  function validateCurrent(): boolean {
    if (!record) return false;
    const errors = mergePropertyEnfathValidation(
      currentProperty,
      record.assignmentType,
    );
    if (hasFieldErrors(errors)) {
      setFieldErrors(errors);
      setFormError(firstEnfathValidationMessage(errors));
      scrollToInvalidField(errors, currentProperty);
      return false;
    }
    return true;
  }

  function scrollToActive() {
    requestAnimationFrame(() => {
      activePropertyRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function startAnotherProperty() {
    if (!validateCurrent()) return;
    setProperties((prev) => [...prev, commitCurrentProperty()]);
    setCurrentProperty(emptyProperty());
    setFieldErrors({});
    setFormError(null);
    scrollToActive();
  }

  function editStackedProperty(index: number) {
    const target = properties[index];
    const hasDraft =
      !!currentProperty.deedNumber.trim() ||
      !!currentProperty.taskNumber.trim();
    setProperties((prev) => {
      let next = prev.filter((_, i) => i !== index);
      if (hasDraft) next = [...next, commitCurrentProperty()];
      return next;
    });
    setCurrentProperty(target);
    setFieldErrors({});
    setFormError(null);
    scrollToActive();
  }

  async function persistProperty(prop: PoPropertyIntake): Promise<boolean> {
    if (
      !isBourseInquiryIdentifier(prop.identifierType) &&
      (await deedExistsInPo(poNumber, prop.deedNumber, prop.id))
    ) {
      setFormError("رقم الصك مسجّل مسبقاً في هذا أمر العمل");
      setFieldErrors({ deedNumber: "رقم الصك مسجّل مسبقاً في هذا أمر العمل" });
      return false;
    }
    const result = await addPropertyToPo(poNumber, prop);
    if (!result.ok) {
      setFormError(
        result.errors
          ? firstEnfathValidationMessage(result.errors)
          : result.error,
      );
      if (result.errors) setFieldErrors(result.errors);
      return false;
    }
    return true;
  }

  async function handleSaveAll() {
    if (!record) return;

    const stackedIssue = findInvalidEnfathPropertyIndex(
      properties,
      record.assignmentType,
    );
    if (stackedIssue) {
      setFormError(
        `عقار ${stackedIssue.index + 1}: ${firstEnfathValidationMessage(stackedIssue.errors)} — اضغط «تعديل»`,
      );
      return;
    }
    if (!validateCurrent()) return;

    const all = [...properties, commitCurrentProperty()];
    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    for (const prop of all) {
      const ok = await persistProperty(prop);
      if (!ok) {
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSavedAction();
  }

  if (loading) {
    return (
      <PoIntakeWizardShell
        steps={PROPERTY_STEPS}
        step={1}
        hint=""
        showPrev={false}
        nextLabel="رجوع"
        flowTitle="إضافة عقار"
        onBack={onBackAction}
        onPrev={() => {}}
        onNext={onBackAction}
      >
        <InlineLoadingSkeleton />
      </PoIntakeWizardShell>
    );
  }

  if (!record) {
    return (
      <PoIntakeWizardShell
        steps={PROPERTY_STEPS}
        step={1}
        hint=""
        showPrev={false}
        nextLabel="رجوع"
        flowTitle="إضافة عقار"
        onBack={onBackAction}
        onPrev={() => {}}
        onNext={onBackAction}
      >
        <Note tone="warn">لم يُعثر على أمر العمل.</Note>
      </PoIntakeWizardShell>
    );
  }

  if (remainingSlots === 0) {
    return (
      <PoIntakeWizardShell
        steps={PROPERTY_STEPS}
        step={1}
        hint=""
        showPrev={false}
        nextLabel="العودة لقائمة العقارات"
        flowTitle={`تسجيل العقارات — ${formatPoDisplay(poNumber)}`}
        flowDept="قسم دراسة الحالة"
        onBack={onBackAction}
        onPrev={() => {}}
        onNext={onBackAction}
      >
        <Note tone="info">
          تم تسجيل {alreadyRegistered} من {expectedTotal} عقارات حسب التعميد.
          لا يتبقى عقارات لإضافتها من هذه الشاشة.
        </Note>
      </PoIntakeWizardShell>
    );
  }

  return (
    <PoIntakeWizardShell
      steps={PROPERTY_STEPS}
      step={1}
      hint={PROPERTY_HINT}
      saving={saving}
      showPrev={false}
      nextLabel="حفظ العقارات"
      isDirty={isDirty}
      flowTitle={`تسجيل العقارات — ${formatPoDisplay(poNumber)}`}
      flowDept="قسم دراسة الحالة"
      onBack={onBackAction}
      onPrev={() => {}}
      onNext={() => void handleSaveAll()}
    >
      {formError ? <Note tone="warn">{formError}</Note> : null}

      <Note tone="info">
        بيانات مرحلة إنفاذ — تُكمّل بيانات البورصة لاحقاً من «استعلام البورصة».
        مسجّل مسبقاً: {alreadyRegistered} من {expectedTotal}.
      </Note>

      <div className="flex flex-col gap-5">
        <div className="col-span-full mb-3.5 sm:col-span-2">
          <Label className="text-[11px]" htmlFor="po_property_count_display">
            عدد العقارات في هذه الجلسة
          </Label>
          <div
            id="po_property_count_display"
            className="flex min-h-[38px] w-full items-center gap-2.5 rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 px-3 py-2 text-xs text-text-2"
            aria-live="polite"
            aria-label={`${enteredCount} من ${remainingSlots} في هذه الجلسة`}
          >
            <span
              className={cn(
                "text-[15px] font-bold leading-none tabular-nums",
                enteredCount === 0 ? "font-semibold text-text-3" : "text-primary",
              )}
            >
              {enteredCount}
            </span>
            <span className="text-xs text-text-2">من {remainingSlots}</span>
            <span className="ms-auto whitespace-nowrap rounded-[10px] bg-info-bg px-2.5 py-0.5 text-[10px] font-semibold text-info-text">
              يتغيّر أثناء التسجيل
            </span>
          </div>
        </div>

        {properties.map((prop, index) => (
          <PoPropertyStackCard
            key={prop.id}
            index={alreadyRegistered + index + 1}
            property={prop}
            assignmentType={record.assignmentType}
            onEdit={() => editStackedProperty(index)}
            onRemove={() =>
              setProperties((prev) => prev.filter((_, i) => i !== index))
            }
          />
        ))}

        <div ref={activePropertyRef} className="scroll-mt-3">
          <RegistrationFormCard
            title={`عقار ${propertyOrdinal} — بيانات إنفاذ`}
            subtitle="البيانات الواردة من منصة إنفاذ"
          >
            <PoPropertyEnfathForm
              property={currentProperty}
              propertyOrdinal={propertyOrdinal}
              assignmentType={record.assignmentType}
              fieldErrors={fieldErrors}
              onPatch={patchProperty}
              poNumber={poNumber}
              showStageNote={false}
            />
          </RegistrationFormCard>
        </div>

        {canAddAnother ? (
          <div className="flex justify-center px-0 py-1">
            <Button type="button" size="sm" onClick={startAnotherProperty}>
              + إضافة عقار آخر
            </Button>
          </div>
        ) : null}
      </div>
    </PoIntakeWizardShell>
  );
}
