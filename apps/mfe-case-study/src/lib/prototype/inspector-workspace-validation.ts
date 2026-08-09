import { shouldUseJeddahDefaultCoords } from "@engineering-office/mfe/lib/jeddah-default-coords";
import {
  invalidControlClass,
  resolveAllErrorMessages,
  resolveFirstErrorMessage,
  scheduleScrollToFormField,
  scrollToFormField,
  type ScrollToFormFieldOptions,
} from "@platform/app-shared/form-ux";
import {
  INSPECTOR_FEATURE_FIELDS,
  inspectorFeatureRequiresPhoto,
  listInspectorPhotoValidationIssues,
  type InspectorWorkspaceDraft,
} from "./inspector-workspace-data";

export type InspectorWorkspaceFieldErrors = Partial<
  Record<
    | "inspectionDate"
    | "inspectionTime"
    | "mapLatitude"
    | "mapLongitude"
    | "inspectionConfirmed"
    | "observations"
    | "definedPhotos"
    | "featurePhotos"
    | "componentPhotos"
    | "features"
    | "_"
    ,
    string
  >
> & {
  /** Feature keys left empty (value not chosen). */
  emptyFeatureKeys?: string[];
  /** First feature key missing its required proof photo. */
  missingFeaturePhotoKey?: string;
};

/** DOM ids used by the inspection form for auto-scroll. */
export function inspectorFieldTargetId(
  field:
    | keyof InspectorWorkspaceFieldErrors
    | `feature:${string}`
    | `feature-photo:${string}`,
): string {
  if (field.startsWith("feature-photo:")) {
    return `ins-feature-photo-${field.slice("feature-photo:".length)}`;
  }
  if (field.startsWith("feature:")) {
    return `ins-feature-${field.slice("feature:".length)}`;
  }
  switch (field) {
    case "inspectionDate":
      return "ins-date";
    case "inspectionTime":
      return "ins-time";
    case "mapLatitude":
    case "mapLongitude":
      return "ins-map-section";
    case "features":
      return "ins-features-section";
    case "featurePhotos":
      return "ins-features-section";
    case "componentPhotos":
      return "ins-components-section";
    case "definedPhotos":
      return "ins-defined-photos";
    case "observations":
      return "ins-observations";
    case "inspectionConfirmed":
      return "ins-confirm";
    default:
      return "pdInspection";
  }
}

/** First missing control to scroll/focus (document top→bottom order). */
export function firstInspectorWorkspaceErrorTarget(
  errors: InspectorWorkspaceFieldErrors,
): string | null {
  if (errors.inspectionDate) return inspectorFieldTargetId("inspectionDate");
  if (errors.inspectionTime) return inspectorFieldTargetId("inspectionTime");
  if (errors.mapLatitude || errors.mapLongitude) {
    return inspectorFieldTargetId("mapLatitude");
  }
  if (errors.emptyFeatureKeys?.[0]) {
    return inspectorFieldTargetId(`feature:${errors.emptyFeatureKeys[0]}`);
  }
  if (errors.missingFeaturePhotoKey) {
    return inspectorFieldTargetId(
      `feature-photo:${errors.missingFeaturePhotoKey}`,
    );
  }
  if (errors.features || errors.featurePhotos) {
    return inspectorFieldTargetId("features");
  }
  if (errors.componentPhotos) return inspectorFieldTargetId("componentPhotos");
  if (errors.definedPhotos) return inspectorFieldTargetId("definedPhotos");
  if (errors.observations) return inspectorFieldTargetId("observations");
  if (errors.inspectionConfirmed) {
    return inspectorFieldTargetId("inspectionConfirmed");
  }
  return null;
}

/** @deprecated Prefer `scrollToFormField` from `@platform/app-shared/form-ux`. */
export function scrollToInspectorField(
  targetId: string,
  options?: ScrollToFormFieldOptions,
): void {
  scrollToFormField(targetId, options);
}

export { scheduleScrollToFormField };

export function validateInspectorWorkspace(
  submission: InspectorWorkspaceDraft,
  options?: { boundariesUnavailable?: boolean },
): InspectorWorkspaceFieldErrors {
  const errors: InspectorWorkspaceFieldErrors = {};
  if (!submission.inspectionDate.trim()) {
    errors.inspectionDate = "تاريخ المعاينة مطلوب";
  }
  if (!submission.inspectionTime.trim()) {
    errors.inspectionTime = "وقت المعاينة مطلوب";
  }
  // Mirror FieldInspectionSubmissionValidator.ValidateGps (Saudi box + legacy sea).
  if (
    shouldUseJeddahDefaultCoords(
      submission.mapLatitude,
      submission.mapLongitude,
    )
  ) {
    errors.mapLatitude = "يجب تحديد موقع العقار (GPS)";
  }
  if (!submission.inspectionConfirmed) {
    errors.inspectionConfirmed = "يجب التأشير على إقرار المعاينة";
  }

  const emptyFeatureKeys = INSPECTOR_FEATURE_FIELDS.filter(
    (field) => !(submission.featureValues[field.key] ?? "").trim(),
  ).map((field) => field.key);
  if (emptyFeatureKeys.length > 0) {
    errors.emptyFeatureKeys = emptyFeatureKeys;
    const first = INSPECTOR_FEATURE_FIELDS.find(
      (f) => f.key === emptyFeatureKeys[0],
    );
    errors.features = first
      ? `اختر قيمة لـ «${first.label}» (${emptyFeatureKeys.length} حقل ناقص)`
      : `أكمل خصائص العقار — ${emptyFeatureKeys.length} حقل بدون اختيار`;
  }

  for (const field of INSPECTOR_FEATURE_FIELDS) {
    const value = submission.featureValues[field.key] ?? "";
    if (
      inspectorFeatureRequiresPhoto(field, value) &&
      !submission.featurePhotoAttachments[field.key]?.fileName
    ) {
      errors.missingFeaturePhotoKey = field.key;
      errors.featurePhotos = `يجب إرفاق صورة توثيقية: ${field.label}`;
      break;
    }
  }

  const incompleteObs = submission.observations.filter(
    (o) => !o.text.trim() || !o.photo?.fileName,
  );
  if (incompleteObs.length > 0) {
    errors.observations =
      "كل ملاحظة موثّقة يجب أن تتضمن شرحاً وصورة توثيقية";
  }

  const photoIssues = listInspectorPhotoValidationIssues(submission);
  if (photoIssues.length > 0) {
    if (!errors.featurePhotos) {
      const featureIssue = photoIssues.find((issue) => issue.includes("توثيقية"));
      if (featureIssue) errors.featurePhotos = featureIssue;
    }

    const componentIssue = photoIssues.find(
      (issue) => issue.includes("المعرض") || issue.includes("البئر"),
    );
    if (componentIssue) errors.componentPhotos = componentIssue;

    const definedIssue = photoIssues.find(
      (issue) =>
        issue.includes("الموثّقة") ||
        issue.includes("بانتظار الاعتماد") ||
        issue.includes("إضافية") ||
        issue.includes("الخادم") ||
        issue.includes("خدمة") ||
        issue.includes("مرفق"),
    );
    if (definedIssue) errors.definedPhotos = definedIssue;
  }

  void options?.boundariesUnavailable;
  return errors;
}

const INSPECTOR_ERROR_KEYS = [
  "inspectionDate",
  "inspectionTime",
  "mapLatitude",
  "features",
  "featurePhotos",
  "componentPhotos",
  "definedPhotos",
  "observations",
  "inspectionConfirmed",
  "_",
] as const;

export function firstInspectorWorkspaceError(
  errors: InspectorWorkspaceFieldErrors,
): string | null {
  return resolveFirstErrorMessage(
    errors as Record<string, unknown>,
    INSPECTOR_ERROR_KEYS,
  );
}

export function allInspectorWorkspaceErrors(
  errors: InspectorWorkspaceFieldErrors,
): string[] {
  return resolveAllErrorMessages(
    errors as Record<string, unknown>,
    INSPECTOR_ERROR_KEYS,
  );
}

/** @deprecated Prefer `invalidControlClass` from `@platform/app-shared/form-ux`. */
export const inspectorInvalidControlClass = invalidControlClass;
