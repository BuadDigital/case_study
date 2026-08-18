"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatPoDisplay,
  hasBourseDetailFields,
  isBourseInquiryIdentifier,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import {
  deedExistsInPo,
  findPropertyInRecord,
  removePropertyFromPo,
  updatePropertyInPo,
} from "../../lib/prototype/po-intake-storage";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import {
  hasFieldErrors,
  mergeFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/registration/registration-utils";
import { Button, InlineLoadingSkeleton, Note, useToast } from "@platform/ui-kit";
import { PoEditShell } from "./PoEditShell";
import { PoPropertyBourseForm } from "./PoPropertyBourseForm";
import { PoPropertyEnfathForm } from "./PoPropertyEnfathForm";
import {
  firstBourseValidationMessage,
  validatePropertyBourseFields,
} from "../../lib/domain/po-intake/property-bourse-validation";
import {
  firstEnfathValidationMessage,
  mergePropertyEnfathValidation,
} from "../../lib/domain/po-intake/property-enfath-validation";
import { contactsForApi } from "../../lib/domain/po-intake/property-validation";
import { scheduleScrollToFirstPoPropertyError } from "../../lib/domain/po-intake/po-field-error-targets";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { canDeleteProperty } from "../../lib/prototype/po-roles";

export function PoPropertyEdit({
  poNumber,
  propertyId,
  onBackAction,
  onSavedAction,
  onDeletedAction,
}: {
  poNumber: string;
  propertyId: string;
  onBackAction: () => void;
  onSavedAction: () => void;
  onDeletedAction?: () => void;
}) {
  const { role } = usePrototype();
  const [initialRecord, setInitialRecord] = useState<PoIntakeRecord | null>(null);
  const [property, setProperty] = useState<PoPropertyIntake | null>(null);
  const [loading, setLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const showDeleteProperty =
    canDeleteProperty(role) && Boolean(property && !property.isRemoved);

  useEffect(() => {
    let cancelled = false;
    void findPropertyInRecord(poNumber, propertyId).then((found) => {
      if (cancelled) return;
      if (found) {
        setInitialRecord(found.record);
        setProperty(found.property);
      } else {
        setInitialRecord(null);
        setProperty(null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [poNumber, propertyId]);

  const patchProperty = useCallback(
    <K extends keyof PoPropertyIntake>(key: K, value: PoPropertyIntake[K]) => {
      setProperty((p) => {
        if (!p) return p;
        const next = { ...p, [key]: value };
        return next;
      });
      setFieldErrors((e) => {
        if (!e[String(key)]) return e;
        const next = { ...e };
        delete next[String(key)];
        return next;
      });
    },
    [],
  );

  const replaceProperty = useCallback((next: PoPropertyIntake) => {
    setProperty(next);
    setFieldErrors({});
  }, []);

  if (loading) {
    return (
      <PoEditShell
        title="تعديل العقار"
        onBack={onBackAction}
        onSave={onBackAction}
        saveLabel="رجوع"
      >
        <InlineLoadingSkeleton />
      </PoEditShell>
    );
  }

  if (!initialRecord || !property) {
    return (
      <PoEditShell
        title="تعديل العقار"
        onBack={onBackAction}
        onSave={onBackAction}
        saveLabel="رجوع"
      >
        <Note tone="warn">لم يُعثر على العقار.</Note>
      </PoEditShell>
    );
  }

  if (property.isRemoved) {
    return (
      <PoEditShell
        title={`عقار محذوف — ${property.deedNumber || poNumber}`}
        onBack={onBackAction}
        onSave={onBackAction}
        saveLabel="رجوع"
      >
        <Note tone="warn" role="alert">
          هذا العقار محذوف
          {property.removalReason.trim()
            ? ` — ${property.removalReason.trim()}`
            : ""}
          . لا يمكن تعديله.
        </Note>
      </PoEditShell>
    );
  }

  async function handleSave() {
    if (!initialRecord || !property) return;
    if (property.isRemoved) {
      setFormError("لا يمكن تعديل عقار محذوف");
      return;
    }

    const enfathErrors = mergePropertyEnfathValidation(
      property,
      initialRecord.assignmentType,
    );
    const bourseErrors = property.bourseDataCompleted
      ? validatePropertyBourseFields(property)
      : {};
    const errors = mergeFieldErrors(enfathErrors, bourseErrors);

    if (
      !isBourseInquiryIdentifier(property.identifierType) &&
      (await deedExistsInPo(poNumber, property.deedNumber, propertyId))
    ) {
      errors.deedNumber = "رقم الصك مسجّل مسبقاً في هذا أمر العمل";
    }

    if (hasFieldErrors(errors)) {
      setFieldErrors(errors);
      setFormError(
        firstEnfathValidationMessage(errors) ||
          firstBourseValidationMessage(errors),
      );
      scheduleScrollToFirstPoPropertyError(errors, property);
      return;
    }

    setSaving(true);
    setFormError(null);

    const committed: PoPropertyIntake = {
      ...property,
      contacts: contactsForApi(property.contacts),
    };

    const result = await updatePropertyInPo(poNumber, propertyId, committed);
    if (!result.ok) {
      setSaving(false);
      setFormError(result.error);
      if (result.errors) {
        setFieldErrors(result.errors);
        scheduleScrollToFirstPoPropertyError(result.errors, property);
      }
      showToast(result.error, "error");
      return;
    }

    setSaving(false);
    showToast("تم حفظ التعديلات.", "success");
    onSavedAction();
  }

  async function handleDelete() {
    const reason = window.prompt("سبب الحذف (مطلوب):");
    if (reason == null) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      showToast("سبب الحذف مطلوب", "error");
      return;
    }
    if (
      !window.confirm(
        "حذف هذا العقار؟ يبقى في قائمة أمر العمل مع سبب الحذف، ولا يمكن التراجع.",
      )
    ) {
      return;
    }
    setSaving(true);
    const result = await removePropertyFromPo(poNumber, propertyId, trimmed);
    setSaving(false);
    if (!result.ok) {
      setFormError(result.error);
      showToast(result.error, "error");
      return;
    }
    showToast("تم حذف العقار.", "success");
    if (onDeletedAction) onDeletedAction();
    else onSavedAction();
  }

  return (
    <PoEditShell
      title={`تعديل عقار — ${property.deedNumber || poNumber}`}
      subtitle={`أخصائي دراسة الحالة · ${formatPoDisplay(poNumber)}`}
      saving={saving}
      saveShowActionToast={false}
      onBack={onBackAction}
      onSave={() => void handleSave()}
      footerExtra={
        showDeleteProperty ? (
          <Button
            type="button"
            size="sm"
            variant="danger"
            className="border-red/30 bg-transparent hover:bg-danger-bg/60"
            loading={saving}
            disabled={saving}
            onClick={() => void handleDelete()}
          >
            حذف العقار
          </Button>
        ) : null
      }
    >
      {formError ? <Note tone="warn">{formError}</Note> : null}

      <RegistrationFormCard title="بيانات إنفاذ (الصك)">
        <PoPropertyEnfathForm
          property={property}
          assignmentType={initialRecord.assignmentType}
          fieldErrors={fieldErrors}
          onPatch={patchProperty}
          onReplaceProperty={replaceProperty}
          poNumber={poNumber}
          excludePoNumber={poNumber}
        />
      </RegistrationFormCard>

      {property.bourseDataCompleted || hasBourseDetailFields(property) ? (
        <RegistrationFormCard
          title="بيانات البورصة"
          subtitle={
            property.bourseDataCompleted
              ? "يمكن تعديلها هنا أو من استعلام البورصة"
              : "مُعبَّأة من معاملة سابقة — راجع وعدّل ما تغيّر ثم احفظ (تصبح معتمدة لهذه المعاملة)"
          }
        >
          <PoPropertyBourseForm
            property={property}
            fieldErrors={fieldErrors}
            onPatch={patchProperty}
            poNumber={poNumber}
          />
        </RegistrationFormCard>
      ) : (
        <Note tone="info">
          بيانات البورصة غير مكتملة — أكملها من «استعلام البورصة» في القائمة
          الجانبية.
        </Note>
      )}
    </PoEditShell>
  );
}
