"use client";

/**
 * Step-3 card: photo-documented property observations plus the client
 * declaration checkbox. Lifted out of `FieldInspectionWorkBody` as one
 * self-contained section — same markup, state stays with the parent.
 */
import {
  Button,
  Note,
  Textarea,
  cn,
  formControlClassName,
  opsInsetPanel,
  type ToastTone,
} from "@platform/ui-kit";
import { InspectorPhotoFilePicker } from "./InspectorPhotoFilePicker";
import { InspectorStampedPhotoThumb } from "./InspectorStampedPhotoThumb";
import {
  clearInspectorPhotoDataUrl,
  uploadInspectorPhotoFromFile,
} from "../../lib/app-data/inspector-photo-upload";
import { hasAnyPartyPhone } from "../../lib/app-data/documentary-workflow-gates";
import {
  INSPECTOR_OBSERVATION_CATEGORIES,
  newObservationId,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import type { InspectorWorkspaceFieldErrors } from "../../lib/app-data/inspector-workspace-validation";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import type { RoleId } from "@platform/types";
import { InsBadge, InspectorCard } from "./FieldInspectionWorkParts";
import type { updateInspectorWorkspace } from "../../lib/app-data/inspector-workspace-commands";

export function InspectorObservationsSection({
  activeStep,
  cardLayout,
  draft,
  fieldErrors,
  keyAvailability,
  layout,
  locked,
  mobile,
  onRegisterFailure,
  persist,
  photoStamp,
  property,
  role,
  showToast,
}: {
  activeStep: number;
  cardLayout: "desktop" | "mobile";
  draft: InspectorWorkspaceDraft;
  fieldErrors: InspectorWorkspaceFieldErrors;
  keyAvailability: { keyAvailable: boolean };
  layout: "desktop" | "mobile";
  locked: boolean;
  mobile: boolean;
  onRegisterFailure?: () => void;
  persist: (patch: Parameters<typeof updateInspectorWorkspace>[1]) => void;
  photoStamp: string;
  property?: PoPropertyIntake;
  role: RoleId;
  showToast: (message: string, tone?: ToastTone) => void;
}) {
  const liveDraft = draft;
  return (
    <div id="ins-observations">
  <InspectorCard
    title={mobile ? "الملاحظات المصوّرة" : "ملاحظات العقار الموثّقة بالصور"}
    hidden={activeStep !== 3}
    icon="ti-camera-plus"
    badge={
      mobile ? undefined : (
        <InsBadge label="شرح + صورة لكل ملاحظة" tone="danger" />
      )
    }
    layout={cardLayout}
    step={3}
    subtitle={mobile ? "شرح + صورة" : undefined}
  >
    {mobile ? null : (
      <p className="mb-3 text-[11px] leading-relaxed text-text-3">
        كل ملاحظة على العقار يجب أن تتضمّن{" "}
        <strong>شرحاً نصياً وصورة توثيقية بجانبها</strong>. أضِف ملاحظة
        منفصلة لكل عيب أو ميزة أو حالة تستدعي التوثيق — لا يُقبل إرسال
        المعاينة دون إرفاق صورة لكل ملاحظة.
      </p>
    )}
    {!mobile && draft.observations.length === 0 ? (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-text-3">
        لا توجد ملاحظات — اضغط «إضافة ملاحظة موثّقة».
      </p>
    ) : null}
    {draft.observations.map((obs) => {
      const obsPhotoRef = `observation:${obs.id}`;

      if (mobile) {
        return (
          <div
            key={obs.id}
            className={cn(opsInsetPanel, "mb-2.5 flex gap-2.5 p-2.5")}
          >
            <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-border bg-surface">
              {obs.photo?.fileName ? (
                <InspectorStampedPhotoThumb
                  stamp={photoStamp}
                  taskId={draft.taskId}
                  photoRef={obsPhotoRef}
                  attachment={obs.photo}
                  onClear={
                    locked
                      ? undefined
                      : () => {
                          clearInspectorPhotoDataUrl(
                            draft.taskId,
                            obsPhotoRef,
                          );
                          persist({
                            observations: draft.observations.map((o) =>
                              o.id === obs.id ? { ...o, photo: null } : o,
                            ),
                          });
                        }
                  }
                />
              ) : (
                <InspectorPhotoFilePicker
                  label="صورة"
                  disabled={locked}
                  className="size-full [&_button]:h-full [&_button]:min-h-0 [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-0 [&_button]:py-0 [&_button]:text-[10px]"
                  onFilesSelected={async (files) => {
                    const file = files[0];
                    if (!file) return false;
                    const result = await uploadInspectorPhotoFromFile(
                      draft.taskId,
                      obsPhotoRef,
                      file,
                      {
                        draft: liveDraft,
                        deedNumber: property?.deedNumber,
                      },
                    );
                    if (!result.ok) {
                      throw new Error(result.error);
                    }
                    persist({
                      observations: draft.observations.map((o) =>
                        o.id === obs.id
                          ? { ...o, photo: result.attachment }
                          : o,
                      ),
                    });
                  }}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {obs.category ? (
                <span className="inline-block rounded-full bg-[var(--gold-soft,color-mix(in_srgb,var(--gold)_18%,transparent))] px-2.5 py-0.5 text-[11px] font-bold text-[var(--gold-d,#a4906f)]">
                  {obs.category}
                </span>
              ) : (
                <div className="mb-1 flex flex-wrap gap-1.5">
                  {INSPECTOR_OBSERVATION_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={locked}
                      className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-text-2"
                      onClick={() =>
                        persist({
                          observations: draft.observations.map((o) =>
                            o.id === obs.id ? { ...o, category: c } : o,
                          ),
                        })
                      }
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <Textarea
                rows={2}
                placeholder="اشرح الملاحظة..."
                value={obs.text}
                disabled={locked}
                onChange={(e) =>
                  persist({
                    observations: draft.observations.map((o) =>
                      o.id === obs.id ? { ...o, text: e.target.value } : o,
                    ),
                  })
                }
                className="mt-1.5 min-h-[52px] w-full resize-y border-0 bg-transparent p-0 text-[13px] leading-relaxed text-text-2 outline-none"
              />
              <button
                type="button"
                disabled={locked}
                className="mt-1 text-[12px] font-semibold text-danger-text"
                onClick={() =>
                  persist({
                    observations: draft.observations.filter(
                      (o) => o.id !== obs.id,
                    ),
                  })
                }
              >
                حذف
              </button>
            </div>
          </div>
        );
      }

      return (
      <div
        key={obs.id}
        className="relative mb-2.5 flex flex-col items-stretch gap-3.5 rounded-lg border border-border bg-surface-2 p-3 sm:flex-row"
      >
        <div className="flex w-full shrink-0 flex-col items-center justify-center sm:w-[116px]">
          {obs.photo?.fileName ? (
            <InspectorStampedPhotoThumb
              stamp={photoStamp}
              taskId={draft.taskId}
              photoRef={obsPhotoRef}
              attachment={obs.photo}
              onClear={
                locked
                  ? undefined
                  : () => {
                      clearInspectorPhotoDataUrl(
                        draft.taskId,
                        obsPhotoRef,
                      );
                      persist({
                        observations: draft.observations.map((o) =>
                          o.id === obs.id ? { ...o, photo: null } : o,
                        ),
                      });
                    }
              }
            />
          ) : (
            <InspectorPhotoFilePicker
              label="إرفاق صورة توثيقية"
              disabled={locked}
              className="h-[116px] flex-col border-2 py-2"
              onFilesSelected={async (files) => {
                const file = files[0];
                if (!file) return false;
                const result = await uploadInspectorPhotoFromFile(
                  draft.taskId,
                  obsPhotoRef,
                  file,
                  {
                    draft: liveDraft,
                    deedNumber: property?.deedNumber,
                  },
                );
                if (!result.ok) {
                  throw new Error(result.error);
                }
                persist({
                  observations: draft.observations.map((o) =>
                    o.id === obs.id
                      ? { ...o, photo: result.attachment }
                      : o,
                  ),
                });
              }}
            />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 pe-8 sm:pe-0">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-text-2">
              نوع الملاحظة
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px] transition-colors",
                  obs.category === ""
                    ? "border-primary bg-gold-soft text-primary"
                    : "border-border bg-surface text-text-2 hover:border-primary/40",
                )}
                onClick={() =>
                  persist({
                    observations: draft.observations.map((o) =>
                      o.id === obs.id ? { ...o, category: "" } : o,
                    ),
                  })
                }
              >
                بدون تحديد
              </button>
              {INSPECTOR_OBSERVATION_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px] transition-colors",
                    obs.category === c
                      ? "border-primary bg-gold-soft text-primary"
                      : "border-border bg-surface text-text-2 hover:border-primary/40",
                  )}
                  onClick={() =>
                    persist({
                      observations: draft.observations.map((o) =>
                        o.id === obs.id ? { ...o, category: c } : o,
                      ),
                    })
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            rows={2}
            placeholder="اشرح الملاحظة..."
            value={obs.text}
            onChange={(e) =>
              persist({
                observations: draft.observations.map((o) =>
                  o.id === obs.id ? { ...o, text: e.target.value } : o,
                ),
              })
            }
            className={cn(formControlClassName, "min-h-[62px] text-xs")}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-danger-text"
              onClick={() =>
                persist({
                  observations: draft.observations.filter(
                    (o) => o.id !== obs.id,
                  ),
                })
              }
            >
              حذف الملاحظة
            </Button>
          </div>
        </div>
        <button
          type="button"
          className="absolute end-3 top-3 text-text-3 hover:text-danger-text sm:hidden"
          title="حذف"
          onClick={() =>
            persist({
              observations: draft.observations.filter(
                (o) => o.id !== obs.id,
              ),
            })
          }
        >
          <i className="ti ti-trash" aria-hidden />
        </button>
      </div>
      );
    })}
    {mobile ? (
      <button
        type="button"
        disabled={locked}
        className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-[var(--gold-d,#a4906f)] bg-[color-mix(in_srgb,var(--gold)_8%,transparent)] font-inherit text-[14px] font-bold text-[var(--gold-d,#a4906f)]"
        onClick={() =>
          persist({
            observations: [
              ...draft.observations,
              {
                id: newObservationId(),
                category: "",
                text: "",
                photo: null,
              },
            ],
          })
        }
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        إضافة ملاحظة موثّقة بالصورة
      </button>
    ) : (
      <Button
        type="button"
        variant="default"
        size="sm"
        className="mt-1"
        onClick={() =>
          persist({
            observations: [
              ...draft.observations,
              {
                id: newObservationId(),
                category: "",
                text: "",
                photo: null,
              },
            ],
          })
        }
      >
        <i className="ti ti-plus" aria-hidden /> إضافة ملاحظة موثّقة
      </Button>
    )}
    <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text-2">
      <input
        type="checkbox"
        className="mt-0.5"
        id="ins-vacant-land"
        checked={draft.vacantLand}
        onChange={(e) => persist({ vacantLand: e.target.checked })}
      />
      <span>هل الموقع أرض فضاء؟</span>
    </label>
    {!draft.vacantLand && !keyAvailability.keyAvailable ? (
      <Note tone="info" className="mt-3">
        المفتاح غير مُسلَّم بعد (معلومة من ظرف المفاتيح) — يمكنك إتمام
        المعاينة. إن كان الدخول متعذراً بسبب المفتاح سجّل تعذراً.
        {onRegisterFailure ? (
          <div className="mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRegisterFailure}
            >
              تسجيل تعذر المفتاح
            </Button>
          </div>
        ) : null}
      </Note>
    ) : null}
    <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text-2">
      <input
        type="checkbox"
        className="mt-0.5"
        id="ins-client-declaration"
        checked={draft.clientDeclarationSigned}
        onChange={(e) => {
          const signed = e.target.checked;
          const hasPhone = hasAnyPartyPhone(property?.contacts);
          if (signed && !hasPhone && !draft.declarationPhoneSatisfied) {
            showToast(
              "لا يمكن توقيع إقرار العميل بدون جوال لأحد الأطراف.",
              "error",
            );
            return;
          }
          persist({
            clientDeclarationSigned: signed,
            declarationPhoneSatisfied:
              draft.declarationPhoneSatisfied || (signed && hasPhone),
          });
        }}
      />
      <span>
        تم توقيع إقرار العميل / صحة الموقع (يتطلب جوال أحد الأطراف عند
        أول توقيع)
      </span>
    </label>
    <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber bg-amber-light p-3 text-xs leading-relaxed text-text-2">
      <input
        type="checkbox"
        className="mt-0.5"
        id="ins-confirm"
        checked={draft.inspectionConfirmed}
        onChange={(e) =>
          persist({ inspectionConfirmed: e.target.checked })
        }
      />
      <span>
        أُقرّ بأنني قمت بالمعاينة الميدانية للموقع، وأن كل ملاحظة موثّقة
        بصورة من الطبيعة، وأتحمّل مسؤولية صحة البيانات.
      </span>
    </label>
    {fieldErrors.inspectionConfirmed ? (
      <p className="mt-1 text-[10px] text-danger-text" role="alert">
        {fieldErrors.inspectionConfirmed}
      </p>
    ) : null}
    {fieldErrors.observations ? (
      <p className="mt-1 text-[10px] text-danger-text" role="alert">
        {fieldErrors.observations}
      </p>
    ) : null}
  </InspectorCard>
    </div>
  );
}
