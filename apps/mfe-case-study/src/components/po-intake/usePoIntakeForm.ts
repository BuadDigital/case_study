"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@platform/design-system";
import {
  type AssignmentType,
  type PoIntakeRecord,
} from "../../lib/prototype/po-intake-data";
import {
  buildPoRecord,
  clearPoDraft,
  hydratePoDraft,
  PO_INTAKE_DRAFT_SAVE_FAILED_EVENT,
  poRecordExists,
  savePoDraft,
  savePoRecord,
} from "../../lib/prototype/po-intake-storage";
import {
  collectRequiredErrors,
  hasFieldErrors,
  mergeFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/registration/registration-utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function usePoIntakeForm(onComplete: (record: PoIntakeRecord) => void) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [draftReady, setDraftReady] = useState(false);

  const [poNumber, setPoNumber] = useState("");
  const [promulgationDate, setPromulgationDate] = useState("");
  const [assignmentType, setAssignmentType] = useState<AssignmentType | "">("");
  const [assignmentSpecialist, setAssignmentSpecialist] = useState("");
  const [assignmentSpecialistEmail, setAssignmentSpecialistEmail] = useState("");
  const [expectedPropertyCount, setExpectedPropertyCount] = useState("1");
  const [workOrderDescription, setWorkOrderDescription] = useState("");

  useEffect(() => {
    void hydratePoDraft()
      .then((draft) => {
        if (draft) {
          setPoNumber(draft.poNumber);
          setPromulgationDate(draft.promulgationDate);
          setAssignmentType(draft.assignmentType || "");
          setAssignmentSpecialist(draft.assignmentSpecialist);
          setAssignmentSpecialistEmail(draft.assignmentSpecialistEmail);
          const count = draft.expectedPropertyCount;
          setExpectedPropertyCount(count && count > 0 ? String(count) : "1");
          setWorkOrderDescription(draft.workOrderDescription ?? "");
        }
        setDraftReady(true);
      })
      .catch((error) => {
        showToast(
          error instanceof Error
            ? error.message
            : "تعذّر تحميل مسودة أمر العمل",
          "error",
        );
        setDraftReady(true);
      });
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const error = (event as CustomEvent<{ error?: string }>).detail?.error;
      showToast(error ?? "تعذّر حفظ مسودة أمر العمل", "error");
    };
    window.addEventListener(PO_INTAKE_DRAFT_SAVE_FAILED_EVENT, handler);
    return () =>
      window.removeEventListener(PO_INTAKE_DRAFT_SAVE_FAILED_EVENT, handler);
  }, [showToast]);

  const isDirty = useMemo(
    () =>
      !!poNumber.trim() ||
      !!promulgationDate ||
      !!assignmentType ||
      !!assignmentSpecialist.trim() ||
      !!assignmentSpecialistEmail.trim() ||
      !!workOrderDescription.trim() ||
      expectedPropertyCount !== "1",
    [
      poNumber,
      promulgationDate,
      assignmentType,
      assignmentSpecialist,
      assignmentSpecialistEmail,
      workOrderDescription,
      expectedPropertyCount,
    ],
  );

  useEffect(() => {
    if (!draftReady) return;
    savePoDraft({
      step: 1,
      poNumber,
      promulgationDate,
      assignmentType,
      assignmentSpecialist,
      assignmentSpecialistEmail,
      expectedPropertyCount: Math.max(
        1,
        parseInt(expectedPropertyCount, 10) || 1,
      ),
      propertiesRegion: "",
      workOrderDescription,
    });
  }, [
    draftReady,
    poNumber,
    promulgationDate,
    assignmentType,
    assignmentSpecialist,
    assignmentSpecialistEmail,
    expectedPropertyCount,
    workOrderDescription,
  ]);

  function clearErrors() {
    setFieldErrors({});
    setFormError(null);
  }

  async function validateHeader(): Promise<boolean> {
    clearErrors();
    const errors = mergeFieldErrors(
      collectRequiredErrors(
        {
          poNumber,
          promulgationDate,
          assignmentType,
        },
        ["poNumber", "promulgationDate", "assignmentType"],
      ),
    );
    if (
      assignmentSpecialistEmail.trim() &&
      !EMAIL_RE.test(assignmentSpecialistEmail.trim())
    ) {
      errors.assignmentSpecialistEmail = "صيغة الإيميل غير صالحة";
    }
    const count = parseInt(expectedPropertyCount, 10);
    if (!Number.isFinite(count) || count < 1) {
      errors.expectedPropertyCount = "عدد العقارات يجب أن يكون 1 على الأقل";
    }
    if (hasFieldErrors(errors)) {
      setFieldErrors(errors);
      setFormError("يرجى تعبئة بيانات أمر العمل");
      return false;
    }
    if (await poRecordExists(poNumber)) {
      setFieldErrors({ poNumber: "رقم PO مسجّل مسبقاً في النظام" });
      return false;
    }
    return true;
  }

  async function save() {
    if (!(await validateHeader())) return;

    setSaving(true);
    clearErrors();

    const record = buildPoRecord({
      poNumber: poNumber.trim(),
      assignmentType: assignmentType as AssignmentType,
      promulgationDate,
      assignmentSpecialist: assignmentSpecialist.trim(),
      assignmentSpecialistEmail: assignmentSpecialistEmail.trim(),
      expectedPropertyCount: Math.max(1, parseInt(expectedPropertyCount, 10) || 1),
      propertiesRegion: "",
      workOrderDescription: workOrderDescription.trim(),
      properties: [],
    });

    const result = await savePoRecord(record);
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      if (result.errors) setFieldErrors(result.errors);
      return;
    }

    await clearPoDraft();
    onComplete(result.data);
  }

  return {
    saving,
    formError,
    fieldErrors,
    isDirty,
    poNumber,
    setPoNumber,
    promulgationDate,
    setPromulgationDate,
    assignmentType,
    setAssignmentType,
    assignmentSpecialist,
    setAssignmentSpecialist,
    assignmentSpecialistEmail,
    setAssignmentSpecialistEmail,
    expectedPropertyCount,
    setExpectedPropertyCount,
    workOrderDescription,
    setWorkOrderDescription,
    save,
  };
}
