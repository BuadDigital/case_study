"use client";

import { InlineLoadingSkeleton, Note, useToast } from "@platform/design-system";
import { useCallback, useEffect, useState, type RefObject } from "react";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import {
  formatPropertyDeedDisplay,
} from "../../lib/prototype/po-intake-data";
import { usePoRecordQuery } from "../../query/case-study-queries";
import {
  isFieldInspectionFormLocked,
  type FieldInspectionSubmission,
} from "../../lib/prototype/field-inspection-data";
import { finalizeFieldInspectionSubmission } from "../../lib/prototype/finalize-field-inspection-submission";
import {
  getOrCreateFieldInspectionDraft,
  updateFieldInspectionDraft,
} from "../../lib/prototype/field-inspection-submission-storage";
import {
  firstFieldInspectionError,
  validateFieldInspectionSubmission,
  type FieldInspectionFieldErrors,
} from "../../lib/prototype/field-inspection-validation";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import { FieldFormView } from "../../views/FieldFormView";

export type FieldInspectionWorkHostRef = {
  submit?: () => Promise<boolean>;
  saveDraft?: () => Promise<boolean>;
  onSubmitted?: () => void;
  onSavingChange?: (saving: boolean) => void;
};

export function FieldInspectionWorkBody({
  def,
  task,
  hostRef,
}: {
  def: PartyTaskPageDef;
  task: WorkflowTask;
  hostRef: RefObject<FieldInspectionWorkHostRef | null>;
}) {
  void def;
  const { showToast } = useToast();
  const propertyId = task.propertyId ?? "";
  const { data: record } = usePoRecordQuery(task.poNumber);
  const property = record?.properties.find((p) => p.id === propertyId);

  const [draft, setDraft] = useState<FieldInspectionSubmission | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldInspectionFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    void getOrCreateFieldInspectionDraft({
      taskId: task.id,
      propertyId,
      poNumber: task.poNumber,
      propertyDisplayId:
        property != null
          ? formatPropertyDeedDisplay(property)
          : `خانة ${task.propertyOrdinal}`,
    }).then((next) => {
      if (!cancelled && next) setDraft(next);
    });
    return () => {
      cancelled = true;
    };
  }, [task.id, task.poNumber, task.propertyOrdinal, propertyId, property]);

  const locked = draft ? isFieldInspectionFormLocked(draft.status) : false;
  const formDisabled = locked;

  const persist = useCallback(
    (patch: Parameters<typeof updateFieldInspectionDraft>[1]) => {
      if (!task.id || locked) return;
      void updateFieldInspectionDraft(task.id, patch).then((next) => {
        if (next) setDraft(next);
      });
    },
    [task.id, locked],
  );

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (!draft || locked) return false;
    setSavingDraft(true);
    hostRef.current?.onSavingChange?.(true);
    const next = await updateFieldInspectionDraft(task.id, {
      propertyType: draft.propertyType,
      areaDistrict: draft.areaDistrict,
      actualAreaSqm: draft.actualAreaSqm,
      structuralCondition: draft.structuralCondition,
      hasMovableItems: draft.hasMovableItems,
      isCurrentlyRented: draft.isCurrentlyRented,
      accessDifficulty: draft.accessDifficulty,
      avgPricePerSqm: draft.avgPricePerSqm,
      marketActivityLevel: draft.marketActivityLevel,
      marketNotes: draft.marketNotes,
      responsiblePersonName: draft.responsiblePersonName,
      responsiblePersonRole: draft.responsiblePersonRole,
      signedDocumentPhotos: draft.signedDocumentPhotos,
      propertyPhotos: draft.propertyPhotos,
      generalNotes: draft.generalNotes,
    });
    setSavingDraft(false);
    hostRef.current?.onSavingChange?.(false);
    if (next) {
      setDraft(next);
      setFormError(null);
      showToast("تم حفظ مسودة المعاينة.", "success");
      return true;
    }
    const message = "تعذّر حفظ المسودة — حاول مرة أخرى";
    setFormError(message);
    showToast(message, "error");
    return false;
  }, [draft, locked, hostRef, task.id, showToast]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!draft || locked) return false;

    const errors = validateFieldInspectionSubmission(draft);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const message = firstFieldInspectionError(errors);
      setFormError(message);
      showToast(message ?? "يرجى تصحيح الحقول", "error");
      return false;
    }

    hostRef.current?.onSavingChange?.(true);
    setFormError(null);
    const result = await finalizeFieldInspectionSubmission(task.id);
    hostRef.current?.onSavingChange?.(false);

    if (result.ok) {
      setDraft(result.submission);
      hostRef.current?.onSubmitted?.();
      return true;
    }

    if (result.errors) {
      setFieldErrors(result.errors as FieldInspectionFieldErrors);
    }
    setFormError(result.message);
    showToast(result.message, "error");
    return false;
  }, [draft, locked, hostRef, task.id, showToast]);

  useEffect(() => {
    if (!hostRef.current) return;
    hostRef.current.submit = submit;
    hostRef.current.saveDraft = saveDraft;
  }, [hostRef, submit, saveDraft]);

  if (!draft) {
    return <InlineLoadingSkeleton />;
  }

  return (
    <>
      {locked ? (
        <Note tone="success">تم إرسال المعاينة — النموذج للقراءة فقط.</Note>
      ) : null}

      {formError ? (
        <Note tone="warn" role="alert">
          {formError}
        </Note>
      ) : null}

      <FieldFormView
        embedded
        value={draft}
        disabled={formDisabled}
        fieldErrors={fieldErrors}
        saving={savingDraft}
        onChange={(patch) => {
          persist(patch);
          setFieldErrors((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(patch)) {
              delete next[key as keyof FieldInspectionFieldErrors];
            }
            return next;
          });
        }}
        onSaveDraft={() => {
          void saveDraft();
        }}
        onSubmit={() => {
          void submit();
        }}
      />
    </>
  );
}
