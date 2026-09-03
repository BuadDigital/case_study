"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  formatPoDisplay,
  hasBourseDetailFields,
  isBourseInquiryIdentifier,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import {
  deedExistsInPo,
  findPropertyInRecord,
} from "../../lib/app-data/po-intake-reads";
import {
  removePropertyFromPo,
  updatePropertyInPo,
} from "../../lib/app-data/po-intake-commands";
import {
  hasFieldErrors,
  mergeFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/registration/registration-utils";
import { REG_BACK } from "@platform/app-shared/registration/registration-labels";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  InlineLoadingSkeleton,
  Note,
  PageShell,
  PageShellHeader,
  useToast,
} from "@platform/ui-kit";
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
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { canDeleteProperty } from "../../lib/app-data/po-roles";

function EditChrome({
  title,
  meta,
  onBack,
  actions,
  children,
}: {
  title: string;
  meta?: string;
  onBack: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
      <PageShellHeader
        title={title}
        meta={meta}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <Button type="button" size="sm" onClick={onBack}>
              {REG_BACK}
            </Button>
          </div>
        }
      />
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </PageShell>
  );
}

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
  const { role } = useAppAccess();
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
      <EditChrome title="تعديل العقار" onBack={onBackAction}>
        <InlineLoadingSkeleton />
      </EditChrome>
    );
  }

  if (!initialRecord || !property) {
    return (
      <EditChrome title="تعديل العقار" onBack={onBackAction}>
        <Note tone="warn">لم يُعثر على العقار.</Note>
      </EditChrome>
    );
  }

  if (property.isRemoved) {
    return (
      <EditChrome
        title={`عقار محذوف — ${property.deedNumber || poNumber}`}
        onBack={onBackAction}
      >
        <Note tone="warn" role="alert">
          هذا العقار محذوف
          {property.removalReason.trim()
            ? ` — ${property.removalReason.trim()}`
            : ""}
          . لا يمكن تعديله.
        </Note>
      </EditChrome>
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
    <EditChrome
      title={`تعديل عقار — ${property.deedNumber || poNumber}`}
      meta={`أخصائي دراسة الحالة · ${formatPoDisplay(poNumber)}`}
      onBack={onBackAction}
      actions={
        <>
          {showDeleteProperty ? (
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
          ) : null}
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={saving}
            disabled={saving}
            showActionToast={false}
            onClick={() => void handleSave()}
          >
            حفظ التعديلات
          </Button>
        </>
      }
    >
      {formError ? <Note tone="warn">{formError}</Note> : null}

      <Card>
        <CardHeader>
          <h2 className="m-0 text-sm font-bold">بيانات إنفاذ (الصك)</h2>
        </CardHeader>
        <CardBody>
          <PoPropertyEnfathForm
            property={property}
            assignmentType={initialRecord.assignmentType}
            fieldErrors={fieldErrors}
            onPatch={patchProperty}
            onReplaceProperty={replaceProperty}
            poNumber={poNumber}
            excludePoNumber={poNumber}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="min-w-0">
            <h2 className="m-0 text-sm font-bold">بيانات الموقع والمساحة</h2>
            <p className="m-0 mt-0.5 text-xs text-text-3">
              المدينة والحي والمساحة والتصنيف والحدود — قابلة للتعديل هنا مباشرة
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <PoPropertyBourseForm
            property={property}
            fieldErrors={fieldErrors}
            onPatch={patchProperty}
            poNumber={poNumber}
            showIntroNote={false}
          />
          {!property.bourseDataCompleted && !hasBourseDetailFields(property) ? (
            <Note tone="info" className="mt-3">
              بيانات البورصة الرسمية لم تُكتمل بعد — يمكنك تعبئة المساحة والموقع
              يدوياً هنا، أو إكمالها لاحقاً من «استعلام البورصة».
            </Note>
          ) : null}
        </CardBody>
      </Card>
    </EditChrome>
  );
}
