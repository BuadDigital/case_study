"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import {
  Badge,
  Button,
  FormRow,
  InlineLoadingSkeleton,
  Input,
  Label,
  Note,
  Select,
  Textarea,
  cn,
  formControlClassName,
  useToast,
} from "@platform/design-system";
import {
  RegField,
  RegTextarea,
} from "@platform/app-shared/registration/FormFields";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import { partyIdForRoleId } from "@settings/mfe";
import { EngineeringSurveyMap } from "@engineering-office/mfe/components/EngineeringSurveyMap";
import {
  JEDDAH_DEFAULT_LAT,
  JEDDAH_DEFAULT_LNG,
} from "@engineering-office/mfe/lib/jeddah-default-coords";
import { CaseStudyForm } from "../case-study/CaseStudyForm";
import { InspectorDefinedPhotosSection } from "./InspectorDefinedPhotosSection";
import { InspectorSubmitFooter } from "./InspectorSubmitFooter";
import { InspectorPhotoFilePicker } from "./InspectorPhotoFilePicker";
import { InspectorStampedPhotoThumb } from "./InspectorStampedPhotoThumb";
import {
  clearInspectorPhotoDataUrl,
  getInspectorPhotoDataUrl,
  uploadInspectorPhotoFromFile,
} from "../../lib/prototype/inspector-photo-upload";
import {
  boundariesMarkedUnavailable,
  formatPoDisplay,
  formatPropertyDeedDisplay,
  PROPERTY_BOUNDARY_ROWS,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import { usePoRecordQuery, useWorkflowTasksQuery } from "../../query/case-study-queries";
import {
  INSPECTOR_AMENITY_OPTIONS,
  INSPECTOR_FEATURE_FIELDS,
  INSPECTOR_OBSERVATION_CATEGORIES,
  INSPECTOR_SERVICE_OPTIONS,
  inspectorPhotoStampText,
  isInspectorWorkspaceLocked,
  newObservationId,
  parseInspectorCount,
  type InspectorComponentPhotoKey,
  type InspectorBoundaryKey,
  type InspectorWorkspaceDraft,
} from "../../lib/prototype/inspector-workspace-data";
import { finalizeInspectorWorkspace } from "../../lib/prototype/finalize-field-inspection-submission";
import {
  getOrCreateInspectorWorkspace,
  updateInspectorWorkspace,
} from "../../lib/prototype/inspector-workspace-storage";
import {
  firstInspectorWorkspaceError,
  validateInspectorWorkspace,
  type InspectorWorkspaceFieldErrors,
} from "../../lib/prototype/inspector-workspace-validation";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";

const BOUNDARY_KEYS: InspectorBoundaryKey[] = [
  "north",
  "south",
  "east",
  "west",
];

const BOUNDARY_ROW_MAP: Record<
  InspectorBoundaryKey,
  (typeof PROPERTY_BOUNDARY_ROWS)[number]
> = {
  north: PROPERTY_BOUNDARY_ROWS[0],
  south: PROPERTY_BOUNDARY_ROWS[1],
  east: PROPERTY_BOUNDARY_ROWS[2],
  west: PROPERTY_BOUNDARY_ROWS[3],
};

const CHECKBOX_ITEM =
  "flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-xs text-text-2";
const TABLE_TH =
  "border border-border bg-surface-2 px-3 py-2 text-center text-[11px] font-semibold text-text-2";
const TABLE_TD = "border border-border px-3 py-2 align-middle text-xs";

export type FieldInspectionWorkHostRef = {
  submit?: () => Promise<boolean>;
  saveDraft?: () => Promise<boolean>;
  onSubmitted?: () => void;
  onSavingChange?: (saving: boolean) => void;
};

function resolveParentCaseStudyTask(
  task: WorkflowTask,
  all: WorkflowTask[],
): WorkflowTask | null {
  if (task.kind === "case-study-property") return task;
  if (task.parentTaskId) {
    const parent = all.find((t) => t.id === task.parentTaskId);
    if (parent) return parent;
  }
  return (
    all.find(
      (t) =>
        t.kind === "case-study-property" &&
        t.poNumber === task.poNumber &&
        t.propertyId === task.propertyId,
    ) ?? null
  );
}

function InspectorCard({
  title,
  icon,
  badge,
  children,
}: {
  title: string;
  icon: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <RegistrationFormCard
      title={title}
      headerRight={
        <div className="flex shrink-0 items-center gap-2">
          <i className={`ti ${icon} text-base text-primary`} aria-hidden />
          {badge}
        </div>
      }
    >
      {children}
    </RegistrationFormCard>
  );
}

export function FieldInspectionWorkBody({
  def,
  task,
  hostRef,
  submitting = false,
  beforeSubmitFooter,
  onRegisterFailure,
}: {
  def: PartyTaskPageDef;
  task: WorkflowTask;
  hostRef: RefObject<FieldInspectionWorkHostRef | null>;
  submitting?: boolean;
  beforeSubmitFooter?: ReactNode;
  onRegisterFailure?: () => void;
}) {
  void def;
  const { showToast } = useToast();
  const propertyId = task.propertyId ?? "";
  const { data: record } = usePoRecordQuery(task.poNumber);
  const { data: workflowTasks } = useWorkflowTasksQuery();
  const property = record?.properties.find((p) => p.id === propertyId);

  const [draft, setDraft] = useState<InspectorWorkspaceDraft | null>(null);
  const [fieldErrors, setFieldErrors] = useState<InspectorWorkspaceFieldErrors>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);

  const parentTask = useMemo(
    () => resolveParentCaseStudyTask(task, workflowTasks ?? []),
    [task, workflowTasks],
  );
  const partyId = partyIdForRoleId(def.roleId);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    void getOrCreateInspectorWorkspace({
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

  const locked = draft ? isInspectorWorkspaceLocked(draft.status) : false;
  const boundariesUnavailable = property
    ? boundariesMarkedUnavailable(property.boundariesAvailability)
    : false;

  const persist = useCallback(
    (patch: Parameters<typeof updateInspectorWorkspace>[1]) => {
      if (!task.id || locked) return;
      void updateInspectorWorkspace(task.id, patch).then((next) => {
        if (next) setDraft(next);
      });
    },
    [task.id, locked],
  );

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (!draft || locked) return false;
    hostRef.current?.onSavingChange?.(true);
    const next = await updateInspectorWorkspace(task.id, {});
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

    const errors = validateInspectorWorkspace(draft, {
      boundariesUnavailable,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const message = firstInspectorWorkspaceError(errors);
      setFormError(message);
      showToast(message ?? "يرجى تصحيح الحقول", "error");
      return false;
    }

    hostRef.current?.onSavingChange?.(true);
    setFormError(null);
    const result = await finalizeInspectorWorkspace(task.id);
    hostRef.current?.onSavingChange?.(false);

    if (result.ok) {
      setDraft(result.draft);
      hostRef.current?.onSubmitted?.();
      return true;
    }

    if (result.errors) {
      setFieldErrors(result.errors as InspectorWorkspaceFieldErrors);
    }
    setFormError(result.message);
    showToast(result.message, "error");
    return false;
  }, [draft, locked, hostRef, task.id, showToast, boundariesUnavailable]);

  useEffect(() => {
    if (!hostRef.current) return;
    hostRef.current.submit = submit;
    hostRef.current.saveDraft = saveDraft;
  }, [hostRef, submit, saveDraft]);

  const captureGps = useCallback(() => {
    const place = (lat: number, lng: number) => {
      persist({
        mapLatitude: lat.toFixed(6),
        mapLongitude: lng.toFixed(6),
      });
      showToast("تم تحديد الموقع");
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => place(p.coords.latitude, p.coords.longitude),
        () =>
          showToast("تعذّر الحصول على الموقع — أدخل الإحداثيات يدوياً", "error"),
      );
    } else {
      showToast("المتصفح لا يدعم تحديد الموقع", "error");
    }
  }, [persist, showToast]);

  const handleCoordsChange = useCallback(
    (lat: string, lng: string) => {
      persist({ mapLatitude: lat, mapLongitude: lng });
    },
    [persist],
  );

  if (!draft) {
    return <InlineLoadingSkeleton />;
  }

  const photoStamp = inspectorPhotoStampText(draft);

  return (
    <div className="pb-4">
      {locked ? (
        <Note tone="success" className="mb-4">
          تم إرسال المعاينة — النموذج للقراءة فقط.
        </Note>
      ) : null}

      {formError ? (
        <Note tone="warn" role="alert" className="mb-4">
          {formError}
        </Note>
      ) : null}

      <fieldset
        disabled={locked}
        className="m-0 min-w-0 border-0 p-0 [&_*]:min-w-0"
      >
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-purple-bg bg-purple-bg px-4 py-3 text-xs leading-relaxed text-text-2">
          <i className="ti ti-info-circle mt-0.5 text-purple" aria-hidden />
          <div>
            الحقول الموسومة <Badge tone="purple">مشترك</Badge> تُجمع من المعاين
            والمكتب الهندسي معاً — يُدخل كل طرف قيمته بشكل مستقل، ويختار{" "}
            <strong>أخصائي دراسة الحالة</strong> القيمة المعتمدة النهائية.
            الحقول <Badge tone="info">من إنفاذ</Badge> تأتي تلقائياً وتحتاج
            تحققاً ميدانياً فقط.
          </div>
        </div>

        <InspectorCard
          title="بيانات العقار"
          icon="ti-home"
          badge={<Badge tone="info">من إنفاذ — للاطلاع</Badge>}
        >
          <PropertySummary property={property} task={task} draft={draft} />
        </InspectorCard>

        <InspectorCard
          title="بيانات المعاينة"
          icon="ti-clipboard-check"
          badge={<Badge tone="danger">إلزامي</Badge>}
        >
          <FormRow className="mb-4 grid-cols-1 sm:grid-cols-2">
            <RegField
              id="ins-date"
              label="تاريخ المعاينة"
              required
              type="date"
              dir="ltr"
              value={draft.inspectionDate}
              error={fieldErrors.inspectionDate}
              onChange={(v) => persist({ inspectionDate: v })}
            />
            <RegField
              id="ins-time"
              label="وقت المعاينة"
              required
              type="time"
              dir="ltr"
              value={draft.inspectionTime}
              error={fieldErrors.inspectionTime}
              onChange={(v) => persist({ inspectionTime: v })}
            />
          </FormRow>

          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-text-2">
            <span>
              موقع العقار على الخريطة (GPS){" "}
              <span className="text-danger-text">*</span>
            </span>
            <Badge tone="purple">مشترك</Badge>
            <span className="font-normal text-text-3">
              — إثبات النزول الميداني
            </span>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-text-3">
            يُستخدم الموقع للتحقق من النزول الميداني. يجب أن تتطابق الإحداثيات
            مع موقع العقار الفعلي — اضغط على الخريطة أو اسحب الدبوس لضبطه.
          </p>
          <div className="mb-3 grid grid-cols-1 items-end gap-2.5 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <Label htmlFor="ins-lat" className="text-xs">
                خط العرض (Latitude) <span className="text-danger-text">*</span>
              </Label>
              <Input
                id="ins-lat"
                dir="ltr"
                className="font-mono text-[13px]"
                disabled={locked}
                value={draft.mapLatitude}
                placeholder={JEDDAH_DEFAULT_LAT}
                onChange={(e) => persist({ mapLatitude: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ins-lng" className="text-xs">
                خط الطول (Longitude) <span className="text-danger-text">*</span>
              </Label>
              <Input
                id="ins-lng"
                dir="ltr"
                className="font-mono text-[13px]"
                disabled={locked}
                value={draft.mapLongitude}
                placeholder={JEDDAH_DEFAULT_LNG}
                onChange={(e) => persist({ mapLongitude: e.target.value })}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-[34px] whitespace-nowrap"
              disabled={locked}
              onClick={captureGps}
            >
              <i className="ti ti-current-location" aria-hidden /> موقعي الحالي
            </Button>
          </div>
          {fieldErrors.mapLatitude ? (
            <p className="mb-3 text-[11px] text-danger-text" role="alert">
              {fieldErrors.mapLatitude}
            </p>
          ) : null}
          <EngineeringSurveyMap
            latitude={draft.mapLatitude}
            longitude={draft.mapLongitude}
            disabled={locked}
            onCoordsChange={handleCoordsChange}
          />
        </InspectorCard>

        <InspectorCard
          title="نموذج التحقق الميداني — خصائص العقار"
          icon="ti-list-check"
          badge={
            <Badge tone="info">قيم افتراضية من إنفاذ — قابلة للتعديل</Badge>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <th className={cn(TABLE_TH, "w-8")}>#</th>
                  <th className={cn(TABLE_TH, "text-right")}>الحقل</th>
                  <th className={cn(TABLE_TH, "w-[180px]")}>القيمة</th>
                  <th className={cn(TABLE_TH, "w-[140px]")}>توثيق (نعم→صورة)</th>
                </tr>
              </thead>
              <tbody>
                {INSPECTOR_FEATURE_FIELDS.map((field, index) => {
                  const value = draft.featureValues[field.key] ?? "";
                  const attachment = draft.featurePhotoAttachments[field.key];
                  const photoRef = `feature:${field.key}`;
                  const photoDataUrl = attachment
                    ? getInspectorPhotoDataUrl(draft.taskId, photoRef)
                    : undefined;
                  return (
                    <tr key={field.key}>
                      <td className={cn(TABLE_TD, "text-center text-[11px] text-text-3")}>
                        {index + 1}
                      </td>
                      <td className={TABLE_TD}>
                        {field.label}
                        {field.shared ? (
                          <Badge tone="purple" className="mr-1">
                            مشترك
                          </Badge>
                        ) : null}
                      </td>
                      <td className={TABLE_TD}>
                        <Select
                          value={value}
                          onChange={(e) => {
                            const next = e.target.value;
                            persist({
                              featureValues: {
                                ...draft.featureValues,
                                [field.key]: next,
                              },
                              featurePhotoAttachments: {
                                ...draft.featurePhotoAttachments,
                                [field.key]:
                                  field.photoOnYes && next === "نعم"
                                    ? draft.featurePhotoAttachments[field.key]
                                    : null,
                              },
                            });
                            if (field.photoOnYes && next !== "نعم") {
                              clearInspectorPhotoDataUrl(draft.taskId, photoRef);
                            }
                          }}
                          className={cn(formControlClassName, "text-xs")}
                        >
                          <option value="">— اختر —</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className={cn(TABLE_TD, "text-center")}>
                        {field.photoOnYes && value === "نعم" ? (
                          attachment?.fileName ? (
                            <InspectorStampedPhotoThumb
                              compact
                              stamp={photoStamp}
                              dataUrl={photoDataUrl}
                              onClear={
                                locked
                                  ? undefined
                                  : () => {
                                      clearInspectorPhotoDataUrl(
                                        draft.taskId,
                                        photoRef,
                                      );
                                      persist({
                                        featurePhotoAttachments: {
                                          ...draft.featurePhotoAttachments,
                                          [field.key]: null,
                                        },
                                      });
                                    }
                              }
                            />
                          ) : (
                            <InspectorPhotoFilePicker
                              label="إرفاق صورة"
                              disabled={locked}
                              className="w-auto"
                              onFilesSelected={async (files) => {
                                const file = files[0];
                                if (!file) return;
                                const result =
                                  await uploadInspectorPhotoFromFile(
                                    draft.taskId,
                                    photoRef,
                                    file,
                                  );
                                if (!result.ok) {
                                  showToast(result.error, "error");
                                  return;
                                }
                                persist({
                                  featurePhotoAttachments: {
                                    ...draft.featurePhotoAttachments,
                                    [field.key]: result.attachment,
                                  },
                                });
                                showToast(
                                  "تم إرفاق الصورة مع ختم التاريخ والوقت",
                                );
                              }}
                            />
                          )
                        ) : (
                          <span className="text-xs text-text-3">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {fieldErrors.featurePhotos ? (
            <p className="mt-2 text-[10px] text-danger-text" role="alert">
              {fieldErrors.featurePhotos}
            </p>
          ) : null}
        </InspectorCard>

        <InspectorCard
          title="الموقع والوصول"
          icon="ti-road"
          badge={<Badge tone="danger">إدخال ميداني</Badge>}
        >
          <FormRow className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <RegField
              id="ins-street"
              label="اسم الشارع"
              value={draft.streetName}
              onChange={(v) => persist({ streetName: v })}
            />
            <RegField
              id="ins-main-street"
              label="أقرب شارع رئيسي"
              value={draft.mainStreetName}
              onChange={(v) => persist({ mainStreetName: v })}
            />
            <RegField
              id="ins-street-width"
              label="عرض الشارع (م)"
              type="number"
              value={draft.streetWidthM}
              onChange={(v) => persist({ streetWidthM: v })}
            />
          </FormRow>
          <RegTextarea
            id="ins-access"
            label="طريقة الوصول للعقار"
            rows={3}
            className="mt-3"
            value={draft.accessRouteDescription}
            onChange={(v) => persist({ accessRouteDescription: v })}
          />
        </InspectorCard>

        <InspectorCard
          title="مكوّنات العقار"
          icon="ti-building-estate"
          badge={<Badge tone="danger">إدخال ميداني</Badge>}
        >
          <FormRow className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["roomCount", "عدد الغرف", null],
                ["hallCount", "عدد الصالات", null],
                ["unitCount", "عدد الشقق", null],
                ["bathroomCount", "عدد دورات المياه", null],
                [
                  "showroomCount",
                  "عدد المعارض",
                  {
                    photoKey: "showroom" as InspectorComponentPhotoKey,
                    photoLabel: "إرفاق صورة المعرض",
                  },
                ],
                [
                  "wellCount",
                  "عدد الآبار",
                  {
                    photoKey: "well" as InspectorComponentPhotoKey,
                    photoLabel: "إرفاق صورة البئر",
                  },
                ],
                ["propertyAgeYears", "عمر العقار (سنوات)", null],
                ["buildLicenseNumber", "رقم رخصة البناء", null],
              ] as const
            ).map(([key, label, photoMeta]) => {
              if (key === "propertyAgeYears") {
                return (
                  <div key={key}>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <label
                        htmlFor="ins-propertyAgeYears"
                        className="text-[11px] font-semibold text-text-2"
                      >
                        {label}
                      </label>
                      <Badge tone="purple">مشترك</Badge>
                    </div>
                    <Input
                      id="ins-propertyAgeYears"
                      type="number"
                      value={draft.propertyAgeYears}
                      onChange={(e) =>
                        persist({ propertyAgeYears: e.target.value })
                      }
                      className="text-xs"
                    />
                  </div>
                );
              }

              const value = draft[key];
              const count = photoMeta ? parseInspectorCount(value) : 0;
              const attachment = photoMeta
                ? draft.componentPhotoAttachments[photoMeta.photoKey]
                : null;
              const photoRef = photoMeta
                ? `component:${photoMeta.photoKey}`
                : "";
              const photoDataUrl = attachment
                ? getInspectorPhotoDataUrl(draft.taskId, photoRef)
                : undefined;

              return (
                <div key={key}>
                  <RegField
                    id={`ins-${key}`}
                    label={label}
                    type={key === "buildLicenseNumber" ? "text" : "number"}
                    value={value}
                    onChange={(v) => {
                      const patch: Partial<InspectorWorkspaceDraft> = {
                        [key]: v,
                      };
                      if (photoMeta && parseInspectorCount(v) === 0) {
                        clearInspectorPhotoDataUrl(draft.taskId, photoRef);
                        patch.componentPhotoAttachments = {
                          ...draft.componentPhotoAttachments,
                          [photoMeta.photoKey]: null,
                        };
                      }
                      persist(patch);
                    }}
                  />
                  {photoMeta && count > 0 ? (
                    <div className="mt-1.5">
                      {attachment?.fileName ? (
                        <InspectorStampedPhotoThumb
                          compact
                          stamp={photoStamp}
                          dataUrl={photoDataUrl}
                          onClear={
                            locked
                              ? undefined
                              : () => {
                                  clearInspectorPhotoDataUrl(
                                    draft.taskId,
                                    photoRef,
                                  );
                                  persist({
                                    componentPhotoAttachments: {
                                      ...draft.componentPhotoAttachments,
                                      [photoMeta.photoKey]: null,
                                    },
                                  });
                                }
                          }
                        />
                      ) : (
                        <InspectorPhotoFilePicker
                          label={photoMeta.photoLabel}
                          disabled={locked}
                          className="w-auto"
                          onFilesSelected={async (files) => {
                            const file = files[0];
                            if (!file) return;
                            const result = await uploadInspectorPhotoFromFile(
                              draft.taskId,
                              photoRef,
                              file,
                            );
                            if (!result.ok) {
                              showToast(result.error, "error");
                              return;
                            }
                            persist({
                              componentPhotoAttachments: {
                                ...draft.componentPhotoAttachments,
                                [photoMeta.photoKey]: result.attachment,
                              },
                            });
                            showToast(
                              "تم إرفاق الصورة مع ختم التاريخ والوقت",
                            );
                          }}
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div>
              <label
                htmlFor="ins-has-annex"
                className="mb-1 block text-[11px] font-semibold text-text-2"
              >
                يوجد ملاحق؟
              </label>
              <Select
                id="ins-has-annex"
                value={draft.hasAnnex}
                onChange={(e) =>
                  persist({
                    hasAnnex: e.target.value as InspectorWorkspaceDraft["hasAnnex"],
                  })
                }
                className={cn(formControlClassName, "text-xs")}
              >
                <option value="">— اختر —</option>
                <option value="نعم">نعم</option>
                <option value="لا">لا</option>
              </Select>
            </div>
          </FormRow>
          {fieldErrors.componentPhotos ? (
            <p className="mt-2 text-[10px] text-danger-text" role="alert">
              {fieldErrors.componentPhotos}
            </p>
          ) : null}
        </InspectorCard>

        {!boundariesUnavailable && property ? (
          <InspectorCard
            title="الحدود والأطوال"
            icon="ti-vector"
            badge={
              <Badge tone="info">للمطابقة — المصدر: الأخصائي (البورصة)</Badge>
            }
          >
            <p className="mb-3 text-[11px] text-text-3">
              الحدود والأطوال يُدخلها الأخصائي عند الاستعلام عن الصك من البورصة.
              دور المعاين هنا <strong>المطابقة واكتشاف الخطأ</strong> فقط — ويطابقها
              أيضاً المكتب الهندسي.
            </p>
            {BOUNDARY_KEYS.map((key) => {
              const row = BOUNDARY_ROW_MAP[key];
              const desc = property[row.descKey]?.trim() || "—";
              const len = property[row.lenKey]?.trim() || "—";
              const match = draft.boundaryMatches[key];
              return (
                <div
                  key={key}
                  className="grid grid-cols-1 items-start gap-3 border-b border-border py-2.5 last:border-b-0 md:grid-cols-[90px_1fr_90px_minmax(200px,250px)]"
                >
                  <span className="text-xs font-semibold text-text-2">
                    {row.label}
                  </span>
                  <span className="text-xs">{desc}</span>
                  <span className="text-xs font-semibold">
                    {len !== "—" ? `${len} م` : "—"}
                  </span>
                  <div>
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={match.matches}
                        onChange={(e) =>
                          persist({
                            boundaryMatches: {
                              ...draft.boundaryMatches,
                              [key]: {
                                ...match,
                                matches: e.target.checked,
                              },
                            },
                          })
                        }
                      />
                      <span
                        className={cn(
                          "text-xs font-bold",
                          match.matches ? "text-teal-text" : "text-danger-text",
                        )}
                      >
                        {match.matches ? "مطابق" : "عدم تطابق"}
                      </span>
                    </label>
                    {!match.matches ? (
                      <Textarea
                        rows={2}
                        placeholder="ملاحظة عدم التطابق..."
                        value={match.mismatchNote}
                        onChange={(e) =>
                          persist({
                            boundaryMatches: {
                              ...draft.boundaryMatches,
                              [key]: {
                                ...match,
                                mismatchNote: e.target.value,
                              },
                            },
                          })
                        }
                        className={cn(formControlClassName, "mt-2 min-h-12 text-xs")}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </InspectorCard>
        ) : null}

        <InspectorCard
          title="الخدمات والمرافق المحيطة"
          icon="ti-plug"
          badge={<Badge tone="default">اختيار متعدد</Badge>}
        >
          <p className="mb-2 text-[11px] font-semibold text-text-2">
            الخدمات المتوفرة
          </p>
          <CheckboxGrid
            options={INSPECTOR_SERVICE_OPTIONS}
            selected={draft.services}
            onChange={(services) => persist({ services })}
          />
          <p className="mb-2 mt-4 text-[11px] font-semibold text-text-2">
            المرافق المحيطة
          </p>
          <CheckboxGrid
            options={INSPECTOR_AMENITY_OPTIONS}
            selected={draft.amenities}
            onChange={(amenities) => persist({ amenities })}
          />
        </InspectorCard>

        <InspectorCard
          title="الوصف والملاحظات"
          icon="ti-notes"
          badge={<Badge tone="default">نص حر</Badge>}
        >
          <RegTextarea
            id="ins-desc"
            label="وصف العقار"
            rows={3}
            value={draft.propertyDescription}
            onChange={(v) => persist({ propertyDescription: v })}
          />
          <RegTextarea
            id="ins-pros-cons"
            label="الإيجابيات والعيوب الظاهرة على الحي"
            rows={3}
            className="mt-3"
            value={draft.districtProsCons}
            onChange={(v) => persist({ districtProsCons: v })}
          />
          <RegTextarea
            id="ins-asset-notes"
            label="ملاحظات على الأصل"
            rows={3}
            className="mt-3"
            value={draft.assetNotes}
            onChange={(v) => persist({ assetNotes: v })}
          />
        </InspectorCard>

        <InspectorDefinedPhotosSection
          draft={draft}
          disabled={locked}
          onPatch={(patch) => persist(patch)}
        />
        {fieldErrors.definedPhotos ? (
          <p className="-mt-2 mb-4 text-[10px] text-danger-text" role="alert">
            {fieldErrors.definedPhotos}
          </p>
        ) : null}

        <InspectorCard
          title="ملاحظات العقار الموثّقة بالصور"
          icon="ti-camera-plus"
          badge={<Badge tone="danger">شرح + صورة لكل ملاحظة</Badge>}
        >
          <p className="mb-3 text-[11px] leading-relaxed text-text-3">
            كل ملاحظة على العقار يجب أن تتضمّن{" "}
            <strong>شرحاً نصياً وصورة توثيقية بجانبها</strong>. أضِف ملاحظة
            منفصلة لكل عيب أو ميزة أو حالة تستدعي التوثيق — لا يُقبل إرسال
            المعاينة دون إرفاق صورة لكل ملاحظة.
          </p>
          {draft.observations.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-text-3">
              لا توجد ملاحظات — اضغط «إضافة ملاحظة موثّقة».
            </p>
          ) : null}
          {draft.observations.map((obs) => {
            const obsPhotoRef = `observation:${obs.id}`;
            const obsPhotoDataUrl = obs.photo
              ? getInspectorPhotoDataUrl(draft.taskId, obsPhotoRef)
              : undefined;

            return (
            <div
              key={obs.id}
              className="mb-2.5 flex items-stretch gap-3.5 rounded-lg border border-border bg-surface-2 p-3"
            >
              <div className="flex w-[116px] shrink-0 flex-col items-center justify-center">
                {obs.photo?.fileName ? (
                  <InspectorStampedPhotoThumb
                    stamp={photoStamp}
                    dataUrl={obsPhotoDataUrl}
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
                      if (!file) return;
                      const result = await uploadInspectorPhotoFromFile(
                        draft.taskId,
                        obsPhotoRef,
                        file,
                      );
                      if (!result.ok) {
                        showToast(result.error, "error");
                        return;
                      }
                      persist({
                        observations: draft.observations.map((o) =>
                          o.id === obs.id
                            ? { ...o, photo: result.attachment }
                            : o,
                        ),
                      });
                      showToast("تم إرفاق الصورة مع ختم التاريخ والوقت");
                    }}
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Select
                  value={obs.category}
                  onChange={(e) =>
                    persist({
                      observations: draft.observations.map((o) =>
                        o.id === obs.id
                          ? { ...o, category: e.target.value }
                          : o,
                      ),
                    })
                  }
                  className={cn(formControlClassName, "text-xs")}
                >
                  <option value="">— نوع الملاحظة —</option>
                  {INSPECTOR_OBSERVATION_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
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
              </div>
              <button
                type="button"
                className="self-start text-text-3 hover:text-danger-text"
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

        {partyId && parentTask ? (
          <div className="mt-2 border-t-2 border-dashed border-border pt-2">
            <InspectorCard
              title="دراسة الحالة — أسئلة المصفوفة"
              icon="ti-table"
              badge={
                <Badge tone="default">من علاقة المستخدم بالمعلومة</Badge>
              }
            >
              <CaseStudyForm
                taskId={parentTask.id}
                task={parentTask}
                property={property ?? null}
                poRecord={record ?? undefined}
                requestDateSeed={record?.receivedFromEnfathAt}
                variant="party"
                partyId={partyId}
                partyChildTaskId={task.id}
                parentFormTaskId={parentTask.id}
              />
            </InspectorCard>
          </div>
        ) : null}

        {beforeSubmitFooter}

        <InspectorSubmitFooter
          disabled={locked}
          saving={submitting}
          locked={locked}
          onRegisterFailure={onRegisterFailure}
          onSubmit={() => void hostRef.current?.submit?.()}
        />
      </fieldset>
    </div>
  );
}

function PropertySummary({
  property,
  task,
  draft,
}: {
  property: PoPropertyIntake | undefined;
  task: WorkflowTask;
  draft: InspectorWorkspaceDraft;
}) {
  const rows = [
    { label: "رقم العقار", value: draft.propertyDisplayId || "—" },
    { label: "رقم أمر الشراء", value: formatPoDisplay(task.poNumber) },
    {
      label: "الحي / المدينة",
      value: property
        ? [property.district, property.city].filter(Boolean).join(" — ") || "—"
        : "—",
    },
    { label: "رقم الصك", value: property?.deedNumber?.trim() || "—" },
    {
      label: "المساحة من الصك",
      value: property?.area?.trim() ? `${property.area.trim()} م²` : "—",
    },
    { label: "اسم المالك", value: property?.ownerName?.trim() || "—" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 text-[11px] text-text-3">{row.label}</div>
          <div className="text-[13px] font-semibold text-text">{row.value}</div>
        </div>
      ))}
    </div>
  );
}

function CheckboxGrid({
  options,
  selected,
  onChange,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {options.map((opt) => {
        const checked = selected.includes(opt);
        return (
          <label key={opt} className={CHECKBOX_ITEM}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => {
                onChange(
                  checked
                    ? selected.filter((s) => s !== opt)
                    : [...selected, opt],
                );
              }}
            />
            {opt}
          </label>
        );
      })}
    </div>
  );
}
