"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import {
  FormGroup,
  FormRow,
  InlineLoadingSkeleton,
  Label,
  Note,
  useToast,
} from "@platform/design-system";
import {
  RegField,
  RegTextarea,
} from "@platform/app-shared/registration/FormFields";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import { usePoRecordQuery } from "../../query/case-study-queries";
import {
  governmentReviewKeysStatusLabel,
  governmentReviewVisitStatusLabel,
  isGovernmentReviewFormLocked,
  type GovernmentReviewKeysStatus,
  type GovernmentReviewSubmission,
  type GovernmentReviewVisitStatus,
} from "../../lib/prototype/government-review-work-data";
import { finalizeGovernmentReviewSubmission } from "../../lib/prototype/finalize-government-review-submission";
import {
  getOrCreateGovernmentReviewDraft,
  updateGovernmentReviewDraft,
} from "../../lib/prototype/government-review-work-storage";
import {
  firstGovernmentReviewError,
  validateGovernmentReviewSubmission,
  type GovernmentReviewFieldErrors,
} from "../../lib/prototype/government-review-work-validation";
import { GovernmentReviewKeysProofUpload } from "./GovernmentReviewKeysProofUpload";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";

export type GovernmentReviewWorkHostRef = {
  submit?: () => Promise<boolean>;
  onSubmitted?: () => void;
  onSavingChange?: (saving: boolean) => void;
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
  const { showToast } = useToast();
  const propertyId = task.propertyId ?? "";
  const { data: record } = usePoRecordQuery(task.poNumber);
  const property = record?.properties.find((p) => p.id === propertyId);

  const [draft, setDraft] = useState<GovernmentReviewSubmission | null>(null);
  const [fieldErrors, setFieldErrors] = useState<GovernmentReviewFieldErrors>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);

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

    const errors = validateGovernmentReviewSubmission(draft);
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
  }, [draft, locked, hostRef, task.id, showToast]);

  useEffect(() => {
    if (!hostRef.current) return;
    hostRef.current.submit = submit;
  }, [hostRef, submit]);

  if (!draft) {
    return <InlineLoadingSkeleton />;
  }

  const showVisitDate = draft.visitStatus === "completed";
  const showBlockReason =
    draft.visitStatus === "blocked" ||
    (draft.visitStatus === "completed" && draft.keysStatus === "pending");
  const showKeysDescription = draft.keysStatus === "received";

  return (
    <>
      {locked ? (
        <Note tone="success">
          تم إرسال نتيجة المراجعة — النموذج للقراءة فقط.
        </Note>
      ) : null}

      {formError ? (
        <Note tone="warn" role="alert">
          {formError}
        </Note>
      ) : null}

      <fieldset disabled={formDisabled} className="contents">
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
            {fieldErrors.confirmed ? (
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
