"use client";

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { getPropertyKeyGate } from "@platform/api-client";
import {
  FormGroup,
  FormRow,
  InlineLoadingSkeleton,
  Label,
  Note,
  cn,
  useToast,
} from "@platform/design-system";
import {
  RegField,
  RegTextarea,
} from "@platform/app-shared/registration/FormFields";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import { usePoRecordQuery } from "../../query/case-study-queries";
import {
  canFinalizeGovernmentReviewWithGate,
  governmentReviewKeyHandedToInspectorLabel,
  governmentReviewKeysStatusLabel,
  governmentReviewVisitStatusLabel,
  isGovernmentReviewFormLocked,
  type GovernmentReviewKeyGateOverlay,
  type GovernmentReviewKeyHandedToInspector,
  type GovernmentReviewKeysStatus,
  type GovernmentReviewSubmission,
  type GovernmentReviewVisitStatus,
} from "../../lib/prototype/government-review-work-data";
import { finalizeGovernmentReviewSubmission } from "../../lib/prototype/finalize-government-review-submission";
import {
  getOrCreateGovernmentReviewDraft,
  saveGovernmentReviewSubmission,
  updateGovernmentReviewDraft,
} from "../../lib/prototype/government-review-work-storage";
import {
  isGovernmentReviewAwaitingKeyHandoff,
  isGovernmentReviewAwaitingVisit,
} from "../../lib/prototype/government-review-work-data";
import {
  firstGovernmentReviewError,
  listGovernmentReviewDocumentaryErrors,
  validateGovernmentReviewKeyHandoffPendingSave,
  validateGovernmentReviewPendingSave,
  validateGovernmentReviewSubmission,
  type GovernmentReviewFieldErrors,
} from "../../lib/prototype/government-review-work-validation";
import { governmentReviewSubmitFieldErrors } from "../../lib/prototype/documentary-workflow-gates";
import { GovernmentReviewKeysProofUpload } from "./GovernmentReviewKeysProofUpload";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";

export type GovernmentReviewWorkHostRef = {
  submit?: () => Promise<boolean>;
  onSubmitted?: () => void;
  onPendingSaved?: () => void;
  onSavingChange?: (saving: boolean) => void;
  onVisitStatusChange?: () => void;
  getFooterSaveLabel?: () => string;
  focusReviewNotes?: () => void;
};

const RADIO_GROUP = "mt-1 flex flex-wrap gap-3";
const RADIO_OPT =
  "inline-flex cursor-pointer items-center gap-1.5 text-xs text-text-2";
const CHECKBOX_OPT =
  "flex cursor-pointer items-start gap-2 text-sm text-text-2";

const VISIT_OPTIONS: {
  value: GovernmentReviewVisitStatus;
  label: string;
}[] = [
  { value: "completed", label: governmentReviewVisitStatusLabel("completed") },
  { value: "scheduled", label: governmentReviewVisitStatusLabel("scheduled") },
  { value: "blocked", label: governmentReviewVisitStatusLabel("blocked") },
];

const KEYS_OPTIONS: {
  value: GovernmentReviewKeysStatus;
  label: string;
}[] = [
  { value: "received", label: governmentReviewKeysStatusLabel("received") },
  { value: "pending", label: governmentReviewKeysStatusLabel("pending") },
  { value: "not_required", label: governmentReviewKeysStatusLabel("not_required") },
];

const KEY_HANDED_OPTIONS: {
  value: GovernmentReviewKeyHandedToInspector;
  label: string;
}[] = [
  {
    value: "yes",
    label: governmentReviewKeyHandedToInspectorLabel("yes"),
  },
  {
    value: "no",
    label: governmentReviewKeyHandedToInspectorLabel("no"),
  },
];

export function GovernmentReviewWorkBody({
  def,
  task,
  hostRef,
}: {
  def: PartyTaskPageDef;
  task: WorkflowTask;
  hostRef: RefObject<GovernmentReviewWorkHostRef | null>;
}) {
  void def;
  const { role } = usePrototype();
  const { showToast } = useToast();
  const propertyId = task.propertyId ?? "";
  const { data: record } = usePoRecordQuery(task.poNumber);
  const property = record?.properties.find((p) => p.id === propertyId);

  const [draft, setDraft] = useState<GovernmentReviewSubmission | null>(null);
  const [fieldErrors, setFieldErrors] = useState<GovernmentReviewFieldErrors>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [envelopeMissingWarning, setEnvelopeMissingWarning] = useState(false);
  const [keyGate, setKeyGate] = useState<GovernmentReviewKeyGateOverlay | null>(
    null,
  );

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    void getOrCreateGovernmentReviewDraft({
      taskId: task.id,
      propertyId,
      poNumber: task.poNumber,
      courtName: property?.court,
    }).then((next) => {
      if (!cancelled) setDraft(next);
    });
    return () => {
      cancelled = true;
    };
  }, [task.id, task.poNumber, propertyId, property?.court]);

  useEffect(() => {
    if (!draft || draft.keysStatus !== "received" || !propertyId) {
      setEnvelopeMissingWarning(false);
      return;
    }
    const config = prototypeModulesApiConfig();
    if (!config) {
      setEnvelopeMissingWarning(false);
      return;
    }
    let cancelled = false;
    void getPropertyKeyGate(config, {
      propertyId,
      poNumber: task.poNumber,
      deedNumber: property?.deedNumber,
      requestNumber: property?.requestNumber,
    }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setKeyGate(null);
        setEnvelopeMissingWarning(draft.keysStatus === "received");
        return;
      }
      const overlay: GovernmentReviewKeyGateOverlay = {
        keysStatus: result.data.keysStatus,
        keyHandedToInspector: result.data.keyHandedToInspector,
        keyAvailable: result.data.keyAvailable,
        source: result.data.source,
        envelopeMissingWarning: result.data.envelopeMissingWarning,
        studyHoldStatus: result.data.studyHoldStatus,
      };
      setKeyGate(overlay);
      setEnvelopeMissingWarning(
        Boolean(result.data.envelopeMissingWarning) ||
          (result.data.source !== "envelope" &&
            result.data.source !== "court_access"),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [
    draft?.keysStatus,
    propertyId,
    property?.deedNumber,
    property?.requestNumber,
    task.poNumber,
  ]);

  const locked = draft ? isGovernmentReviewFormLocked(draft.status) : false;
  const formDisabled = locked;

  const persist = useCallback(
    (patch: Parameters<typeof updateGovernmentReviewDraft>[1]) => {
      if (!task.id) return;
      void updateGovernmentReviewDraft(task.id, patch)
        .then((next) => {
          if (next) setDraft(next);
        })
        .catch((err: unknown) => {
          showToast(
            err instanceof Error ? err.message : "تعذّر حفظ المراجعة — حاول مرة أخرى",
            "error",
          );
        });
    },
    [task.id, showToast],
  );

  const submit = useCallback(async (): Promise<boolean> => {
    if (!draft || locked) return false;

    const awaitingVisit = isGovernmentReviewAwaitingVisit(draft.visitStatus);
    const awaitingKeyHandoff = isGovernmentReviewAwaitingKeyHandoff(draft);

    if (awaitingVisit) {
      const errors = validateGovernmentReviewPendingSave(draft);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        const message = firstGovernmentReviewError(errors);
        setFormError(message);
        showToast(message, "error");
        return false;
      }

      hostRef.current?.onSavingChange?.(true);
      setFormError(null);
      try {
        const saved = await saveGovernmentReviewSubmission(draft);
        setDraft(saved);
        showToast(
          draft.visitStatus === "scheduled"
            ? "تم الحفظ — المعاملة بالانتظار حتى تمت الزيارة"
            : "تم حفظ المراجعة",
          "success",
        );
        hostRef.current?.onPendingSaved?.();
        return true;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "تعذّر حفظ المراجعة — حاول مرة أخرى";
        setFormError(message);
        showToast(message, "error");
        return false;
      } finally {
        hostRef.current?.onSavingChange?.(false);
      }
    }

    if (awaitingKeyHandoff) {
      const errors = validateGovernmentReviewKeyHandoffPendingSave(draft);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        const message = firstGovernmentReviewError(errors);
        setFormError(message);
        showToast(message, "error");
        return false;
      }

      hostRef.current?.onSavingChange?.(true);
      setFormError(null);
      try {
        const saved = await saveGovernmentReviewSubmission(draft);
        setDraft(saved);
        showToast(
          "تم الحفظ — المعاملة قيد التنفيذ حتى تسليم المفتاح للمعاين الميداني",
          "success",
        );
        hostRef.current?.onPendingSaved?.();
        return true;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "تعذّر حفظ المراجعة — حاول مرة أخرى";
        setFormError(message);
        showToast(message, "error");
        return false;
      } finally {
        hostRef.current?.onSavingChange?.(false);
      }
    }

    if (!canFinalizeGovernmentReviewWithGate(draft, keyGate)) {
      const message =
        draft.visitStatus !== "completed"
          ? "حدّد «تمت الزيارة» لإتمام المراجعة"
          : "حدّد هل تم تسليم المفتاح للمعاين الميداني — اختر «نعم» للإتمام أو «لا» للحفظ قيد التنفيذ";
      setFormError(message);
      showToast(message, "error");
      return false;
    }

    const errors = validateGovernmentReviewSubmission(
      draft,
      {
        role,
        deedNumber: property?.deedNumber,
        requestNumber: property?.requestNumber,
        city: property?.city,
        district: property?.district,
        circuit: property?.circuit,
        poNumber: task.poNumber,
        assignmentMandateNumber: property?.assignmentMandateNumber,
        assignmentMandateDate: property?.assignmentMandateDate,
      },
      keyGate,
    );
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const message = firstGovernmentReviewError(errors);
      setFormError(message);
      showToast(message, "error");
      return false;
    }

    hostRef.current?.onSavingChange?.(true);
    setFormError(null);
    const submitted = await finalizeGovernmentReviewSubmission(task.id);
    hostRef.current?.onSavingChange?.(false);

    if (submitted) {
      setDraft(submitted);
      hostRef.current?.onSubmitted?.();
      return true;
    }
    const message = "تعذر إتمام المراجعة — حاول مرة أخرى";
    setFormError(message);
    showToast(message, "error");
    return false;
  }, [draft, locked, hostRef, task.id, task.poNumber, showToast, role, property, keyGate]);

  useEffect(() => {
    if (!hostRef.current) return;
    hostRef.current.submit = submit;
    hostRef.current.focusReviewNotes = () => {
      const field = document.getElementById("gov-review-notes") as
        | HTMLTextAreaElement
        | null;
      if (!field) return;
      field.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => field.focus(), 120);
    };
    hostRef.current.getFooterSaveLabel = () => {
      if (!draft || locked) return "حفظ وإتمام المراجعة";
      if (isGovernmentReviewAwaitingVisit(draft.visitStatus)) {
        return "حفظ والانتظار";
      }
      if (isGovernmentReviewAwaitingKeyHandoff(draft)) {
        return "حفظ — قيد التنفيذ";
      }
      return "حفظ وإتمام المراجعة";
    };
  }, [hostRef, submit, draft, locked]);

  useEffect(() => {
    hostRef.current?.onVisitStatusChange?.();
  }, [draft?.visitStatus, draft?.keyHandedToInspector, hostRef]);

  const documentaryGaps = useMemo(() => {
    const errors = governmentReviewSubmitFieldErrors({
      role,
      deedNumber: property?.deedNumber,
      requestNumber: property?.requestNumber,
      city: property?.city,
      district: property?.district,
      circuit: property?.circuit,
      poNumber: task.poNumber,
      assignmentMandateNumber: property?.assignmentMandateNumber,
      assignmentMandateDate: property?.assignmentMandateDate,
    });
    return listGovernmentReviewDocumentaryErrors(errors);
  }, [role, property, task.poNumber]);

  if (!draft) {
    return <InlineLoadingSkeleton />;
  }

  const showVisitDate = draft.visitStatus === "completed";
  const showBlockReason =
    draft.visitStatus === "blocked" ||
    (draft.visitStatus === "completed" && draft.keysStatus === "pending");
  const showKeysDescription = draft.keysStatus === "received";
  const showKeyHandoff = draft.visitStatus === "completed";
  const showCompletionConfirm =
    draft.visitStatus === "completed" &&
    (draft.keysStatus === "not_required" ||
      draft.keyHandedToInspector === "yes");

  return (
    <>
      {locked ? (
        <Note tone="success">
          تم إرسال نتيجة المراجعة — النموذج للقراءة فقط.
        </Note>
      ) : null}

      {!locked && documentaryGaps.length > 0 ? (
        <Note tone="warn" role="status" className="mb-3">
          <strong>لا يمكن إتمام التسليم بعد.</strong> بيانات العقار/التعميد
          ناقصة (يملأها أخصائي دراسة الحالة):
          <ul className="mb-0 mt-2 list-disc pr-5">
            {documentaryGaps.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </Note>
      ) : null}

      {formError ? (
        <Note tone="warn" role="alert">
          {formError}
        </Note>
      ) : null}

      <fieldset
        disabled={formDisabled}
        className={cn(
          "m-0 min-w-0 border-0 p-0",
          formDisabled &&
            "pointer-events-none select-none rounded-[10px] bg-[#F1F5F9] p-3 opacity-70 grayscale-[0.35]",
        )}
      >
        <RegistrationFormCard title="زيارة المحكمة">
          <FormGroup className="mb-3 flex flex-col gap-1">
            <Label className="text-[11px] font-semibold text-text-2">حالة الزيارة</Label>
            <div className={RADIO_GROUP}>
              {VISIT_OPTIONS.map((opt) => (
                <label key={opt.value} className={RADIO_OPT}>
                  <input
                    type="radio"
                    name="gov-visit"
                    checked={draft.visitStatus === opt.value}
                    onChange={() => {
                      persist({ visitStatus: opt.value });
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.visitStatus;
                        delete next.visitDate;
                        delete next.accessBlockReason;
                        return next;
                      });
                    }}
                  />{" "}
                  {opt.label}
                </label>
              ))}
            </div>
            {fieldErrors.visitStatus ? (
              <p className="mt-1 text-[10px] text-danger-text" role="alert">
                {fieldErrors.visitStatus}
              </p>
            ) : null}
          </FormGroup>

          <FormRow className="grid-cols-1 sm:grid-cols-2">
            <RegField
              id="gov-court"
              label="المحكمة"
              value={draft.courtName}
              placeholder="اسم المحكمة"
              onChange={(v) => persist({ courtName: v })}
            />
            {showVisitDate ? (
              <RegField
                id="gov-visit-date"
                label="تاريخ الزيارة"
                type="date"
                dir="ltr"
                value={draft.visitDate}
                error={fieldErrors.visitDate}
                onChange={(v) => {
                  persist({ visitDate: v });
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.visitDate;
                    return next;
                  });
                }}
              />
            ) : null}
          </FormRow>
        </RegistrationFormCard>

        <RegistrationFormCard title="جمع المفاتيح">
          <FormGroup className="mb-3 flex flex-col gap-1">
            <Label className="text-[11px] font-semibold text-text-2">
              حالة استلام المفاتيح
            </Label>
            <div className={RADIO_GROUP}>
              {KEYS_OPTIONS.map((opt) => (
                <label key={opt.value} className={RADIO_OPT}>
                  <input
                    type="radio"
                    name="gov-keys-status"
                    checked={draft.keysStatus === opt.value}
                    onChange={() => {
                      persist({ keysStatus: opt.value });
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.keysStatus;
                        delete next.keysDescription;
                        delete next.accessBlockReason;
                        return next;
                      });
                    }}
                  />{" "}
                  {opt.label}
                </label>
              ))}
            </div>
            {fieldErrors.keysStatus ? (
              <p className="mt-1 text-[10px] text-danger-text" role="alert">
                {fieldErrors.keysStatus}
              </p>
            ) : null}
            {envelopeMissingWarning ? (
              <Note tone="warning" className="mt-2">
                ظرف غير مسجّل لرقم الطلب — يمكن إتمام المراجعة، ويُفضّل تسجيل
                الظرف من وحدة المفاتيح لمزامنة الطوابير.
              </Note>
            ) : null}
          </FormGroup>

          {showKeysDescription ? (
            <RegTextarea
              id="gov-keys"
              label="المفاتيح المستلمة / موقع الحفظ"
              rows={3}
              placeholder="وصف المفاتيح، عددها، أو موقع تسليمها لقسم المفاتيح…"
              value={draft.keysDescription}
              error={fieldErrors.keysDescription}
              onChange={(v) => {
                persist({ keysDescription: v });
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.keysDescription;
                  return next;
                });
              }}
            />
          ) : null}

          {showBlockReason ? (
            <RegTextarea
              id="gov-block-reason"
              label="سبب التعذر / المتابعة"
              rows={2}
              placeholder="اذكر سبب تعذر الوصول أو عدم استلام المفاتيح والإجراء التالي…"
              value={draft.accessBlockReason}
              error={fieldErrors.accessBlockReason}
              onChange={(v) => {
                persist({ accessBlockReason: v });
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.accessBlockReason;
                  return next;
                });
              }}
            />
          ) : null}

          {showKeyHandoff ? (
            <FormGroup className="mb-3 mt-3 flex flex-col gap-1">
              <Label className="text-[11px] font-semibold text-text-2">
                هل تم تسليم المفتاح للمعاين الميداني؟
              </Label>
              <div className={RADIO_GROUP}>
                {KEY_HANDED_OPTIONS.map((opt) => (
                  <label key={opt.value} className={RADIO_OPT}>
                    <input
                      type="radio"
                      name="gov-key-handed"
                      checked={draft.keyHandedToInspector === opt.value}
                      onChange={() => {
                        persist({ keyHandedToInspector: opt.value });
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.keyHandedToInspector;
                          delete next.confirmed;
                          return next;
                        });
                      }}
                    />{" "}
                    {opt.label}
                  </label>
                ))}
              </div>
              {fieldErrors.keyHandedToInspector ? (
                <p className="mt-1 text-[10px] text-danger-text" role="alert">
                  {fieldErrors.keyHandedToInspector}
                </p>
              ) : (
                <p className="m-0 mt-1 text-[11px] leading-relaxed text-text-3">
                  {draft.keyHandedToInspector === "no"
                    ? "المعاملات تبقى «قيد التنفيذ» حتى تسليم المفتاح للمعاين."
                    : draft.keyHandedToInspector === "yes"
                      ? "بعد التأكيد يمكن إتمام المراجعة الحكومية."
                      : "اختر «نعم» لإتمام المعاملة أو «لا» لإبقائها قيد التنفيذ."}
                </p>
              )}
            </FormGroup>
          ) : null}
        </RegistrationFormCard>

        <RegistrationFormCard title="بيانات الرفع لإنفاذ (المراجع)">
          <RegField
            id="gov-zone"
            label="حالة منطقة العقار"
            placeholder="مثال: غير موقوفة"
            value={draft.propertyZoneStatus}
            onChange={(v) => persist({ propertyZoneStatus: v })}
          />
          {showKeysDescription ? (
            <GovernmentReviewKeysProofUpload
              label="إثبات استلام المفتاح (خطاب أو صورة)"
              files={draft.keysProofFiles}
              disabled={formDisabled}
              error={fieldErrors.keysProofFiles}
              onChange={(keysProofFiles) => {
                persist({ keysProofFiles });
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.keysProofFiles;
                  return next;
                });
              }}
            />
          ) : null}
        </RegistrationFormCard>

        <RegistrationFormCard title="ملاحظات المراجعة">
          <RegTextarea
            id="gov-review-notes"
            label="ملاحظات إضافية"
            rows={3}
            placeholder="أي ملاحظات حول زيارة المحكمة أو حالة العقار…"
            value={draft.reviewNotes}
            onChange={(v) => persist({ reviewNotes: v })}
          />

          <FormGroup className="mb-3 mt-3 flex flex-col gap-1">
            {showCompletionConfirm ? (
            <label className={CHECKBOX_OPT}>
              <input
                type="checkbox"
                className="mt-0.5"
                checked={draft.confirmed}
                onChange={(e) => {
                  persist({ confirmed: e.target.checked });
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.confirmed;
                    return next;
                  });
                }}
              />
              <span>أؤكد اكتمال المراجعة الحكومية لهذا العقار</span>
            </label>
            ) : (
              <p className="m-0 text-[11px] leading-relaxed text-text-3">
                {draft.visitStatus === "completed" &&
                draft.keyHandedToInspector === "no"
                  ? "المفتاح لم يُسلَّم بعد — احفظ لإبقاء المعاملة قيد التنفيذ، ثم اختر «نعم» بعد التسليم لإتمامها."
                  : "عند اختيار «بانتظار الموعد» أو «تعذر الوصول» يُحفظ العمل بالانتظار — لإتمام المراجعة عد لاحقاً واختر «تمت الزيارة» وسَلِّم المفتاح للمعاين."}
              </p>
            )}            {fieldErrors.confirmed ? (
              <p className="mt-1 text-[10px] text-danger-text" role="alert">
                {fieldErrors.confirmed}
              </p>
            ) : null}
          </FormGroup>
        </RegistrationFormCard>
      </fieldset>
    </>
  );
}
