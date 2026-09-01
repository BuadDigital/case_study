import { shouldUseJeddahDefaultCoords } from "@platform/app-shared/domain/jeddah-default-coords";
import {
  invalidControlClass,
  resolveFirstErrorMessage,
  scheduleScrollToFormField,
  scrollToFormField,
  type ScrollToFormFieldOptions,
} from "@platform/app-shared/form-ux";
import {
  ACCESS_CONTACT_NAME_LABEL,
  ACCESS_CONTACT_PHONE_LABEL,
  ACCESS_CONTACT_ROLE_LABEL,
  ACCESS_ROUTE_DESCRIPTION_REQUIRED,
  MOVABLES_DESCRIPTION_KEY,
  OCCUPANCY_DESCRIPTION_KEY,
  isCommercialShopInspectionContext,
  isLandInspectionContext,
  isMovablesPresent,
  isOccupied,
  listInspectorPhotoValidationIssues,
  sanitizeInspectorDraftForLand,
  visibleInspectorFeatureFields,
  type InspectorWorkspaceDraft,
} from "./inspector-workspace-data";

export type InspectorWorkspaceFieldErrors = Partial<
  Record<
    | "inspectionDate"
    | "inspectionTime"
    | "mapLatitude"
    | "mapLongitude"
    | "accessRouteDescription"
    | "accessContactName"
    | "accessContactPhone"
    | "accessContactRole"
    | "inspectionConfirmed"
    | "observations"
    | "definedPhotos"
    | "featurePhotos"
    | "componentPhotos"
    | "features"
    | "movablesDescription"
    | "occupancyDescription"
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
    case "accessRouteDescription":
    case "accessContactName":
      return "ins-access-name";
    case "accessContactPhone":
      return "ins-access-phone";
    case "accessContactRole":
      return "ins-access-role";
    case "features":
      return "ins-features-section";
    case "movablesDescription":
      return `ins-feature-${MOVABLES_DESCRIPTION_KEY}`;
    case "occupancyDescription":
      return `ins-${OCCUPANCY_DESCRIPTION_KEY}`;
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
  if (errors.accessContactName) {
    return inspectorFieldTargetId("accessContactName");
  }
  if (errors.accessContactPhone) {
    return inspectorFieldTargetId("accessContactPhone");
  }
  if (errors.accessContactRole) {
    return inspectorFieldTargetId("accessContactRole");
  }
  if (errors.accessRouteDescription) {
    return inspectorFieldTargetId("accessRouteDescription");
  }
  if (errors.emptyFeatureKeys?.[0]) {
    return inspectorFieldTargetId(`feature:${errors.emptyFeatureKeys[0]}`);
  }
  if (errors.movablesDescription) {
    return inspectorFieldTargetId("movablesDescription");
  }
  if (errors.occupancyDescription) {
    return inspectorFieldTargetId("occupancyDescription");
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
  rawSubmission: InspectorWorkspaceDraft,
  options?: {
    boundariesUnavailable?: boolean;
    classification?: string | null;
    propertyType?: string | null;
    includeRetiredFeatureKeys?: readonly string[];
    specialistProofServicesOnly?: boolean;
  },
): InspectorWorkspaceFieldErrors {
  const errors: InspectorWorkspaceFieldErrors = {};
  const submission = sanitizeInspectorDraftForLand(rawSubmission, {
    classification: options?.classification,
    propertyType: options?.propertyType,
  });
  const isLand = isLandInspectionContext({
    vacantLand: submission.vacantLand,
    assetSubject: submission.featureValues.assetSubject,
    classification: options?.classification,
    propertyType: options?.propertyType,
  });
  const isShop = isCommercialShopInspectionContext({
    vacantLand: submission.vacantLand,
    assetSubject: submission.featureValues.assetSubject,
    classification: options?.classification,
    propertyType: options?.propertyType,
  });
  const featureFields = visibleInspectorFeatureFields(isLand, {
    includeRetiredKeys: options?.includeRetiredFeatureKeys,
  });
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
  if (!submission.accessContactName.trim()) {
    errors.accessContactName = `${ACCESS_CONTACT_NAME_LABEL} مطلوب`;
  }
  if (!submission.accessContactPhone.trim()) {
    errors.accessContactPhone = `${ACCESS_CONTACT_PHONE_LABEL} مطلوب`;
  }
  if (!submission.accessContactRole.trim()) {
    errors.accessContactRole = `${ACCESS_CONTACT_ROLE_LABEL} مطلوبة`;
  }
  if (
    errors.accessContactName ||
    errors.accessContactPhone ||
    errors.accessContactRole
  ) {
    errors.accessRouteDescription = ACCESS_ROUTE_DESCRIPTION_REQUIRED;
  }
  if (!submission.inspectionConfirmed) {
    errors.inspectionConfirmed = "يجب التأشير على إقرار المعاينة";
  }

  const emptyFeatureKeys = featureFields
    .filter((field) => !(submission.featureValues[field.key] ?? "").trim())
    .map((field) => field.key);
  if (emptyFeatureKeys.length > 0) {
    errors.emptyFeatureKeys = emptyFeatureKeys;
    const first = featureFields.find((f) => f.key === emptyFeatureKeys[0]);
    errors.features = first
      ? `اختر قيمة لـ «${first.label}» (${emptyFeatureKeys.length} حقل ناقص)`
      : `أكمل خصائص العقار — ${emptyFeatureKeys.length} حقل بدون اختيار`;
  }

  if (isMovablesPresent(submission.featureValues)
    && !(submission.featureValues[MOVABLES_DESCRIPTION_KEY] ?? "").trim()) {
    errors.movablesDescription = "وصف المنقولات مطلوب عند اختيار «نعم»";
  }

  if (isOccupied(submission.featureValues)
    && !(submission.featureValues[OCCUPANCY_DESCRIPTION_KEY] ?? "").trim()) {
    errors.occupancyDescription = "سبب الإشغال مطلوب عند اختيار «مشغول»";
  }

  const incompleteObs = submission.observations.filter((o) => !o.text.trim());
  if (incompleteObs.length > 0) {
    errors.observations = "كل ملاحظة يجب أن تتضمن شرحاً";
  }

  const photoIssues = listInspectorPhotoValidationIssues(submission, {
    isLand,
    isShop,
    specialistProofServicesOnly: options?.specialistProofServicesOnly,
  });
  if (photoIssues.length > 0) {
    const featureIssue = photoIssues.find((issue) => issue.includes("توثيقية"));
    if (featureIssue) {
      errors.featurePhotos = featureIssue;
      const photoField = featureFields.find((field) =>
        featureIssue.includes(field.label),
      );
      if (photoField) errors.missingFeaturePhotoKey = photoField.key;
    }

    const componentIssue = photoIssues.find(
      (issue) => issue.includes("المعرض") || issue.includes("البئر"),
    );
    if (componentIssue) errors.componentPhotos = componentIssue;

    const definedIssue = photoIssues.find(
      (issue) =>
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
  "accessContactName",
  "accessContactPhone",
  "accessContactRole",
  "accessRouteDescription",
  "features",
  "movablesDescription",
  "occupancyDescription",
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

/** @deprecated Prefer `invalidControlClass` from `@platform/app-shared/form-ux`. */
export const inspectorInvalidControlClass = invalidControlClass;
