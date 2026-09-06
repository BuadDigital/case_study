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
  isInspectorPresenceToggleField,
  isInspectorRetiredFeatureKey,
  INSPECTOR_BOUNDARY_KEYS,
  firstIncompleteServiceAmenitySlotId,
  visibleInspectorFeatureFields,
  type InspectorComponentPhotoKey,
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
    | "freePhotos"
    | "featurePhotos"
    | "componentPhotos"
    | "features"
    | "movablesDescription"
    | "occupancyDescription"
    | "boundaries"
    | "_"
    ,
    string
  >
> & {
  /** Feature keys left empty (value not chosen). */
  emptyFeatureKeys?: string[];
  /** First feature key missing its required proof photo. */
  missingFeaturePhotoKey?: string;
  /** First selected service/amenity slot missing a proof photo. */
  missingDefinedPhotoSlotId?: string;
  /** First observation row missing its explanation. */
  missingObservationId?: string;
  /** First boundary marked غير مطابق without a note. */
  missingBoundaryKey?: string;
  /** First component (معرض / بئر) missing its required proof photo. */
  missingComponentPhotoKey?: InspectorComponentPhotoKey;
};

/** DOM ids used by the inspection form for auto-scroll. */
export function inspectorFieldTargetId(
  field:
    | keyof InspectorWorkspaceFieldErrors
    | `feature:${string}`
    | `feature-photo:${string}`
    | `defined-slot:${string}`
    | `observation:${string}`
    | `boundary:${string}`
    | `component-photo:${string}`,
): string {
  if (field.startsWith("feature-photo:")) {
    return `ins-feature-photo-${field.slice("feature-photo:".length)}`;
  }
  if (field.startsWith("feature:")) {
    return `ins-feature-${field.slice("feature:".length)}`;
  }
  if (field.startsWith("defined-slot:")) {
    return `ins-defined-slot-${field.slice("defined-slot:".length)}`;
  }
  if (field.startsWith("observation:")) {
    return `ins-observation-${field.slice("observation:".length)}`;
  }
  if (field.startsWith("boundary:")) {
    return `ins-boundary-${field.slice("boundary:".length)}`;
  }
  if (field.startsWith("component-photo:")) {
    return `ins-component-photo-${field.slice("component-photo:".length)}`;
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
      return `ins-${MOVABLES_DESCRIPTION_KEY}`;
    case "occupancyDescription":
      return `ins-${OCCUPANCY_DESCRIPTION_KEY}`;
    case "featurePhotos":
      return "ins-features-section";
    case "componentPhotos":
      return "ins-components-section";
    case "definedPhotos":
      return "ins-defined-photos";
    case "freePhotos":
      return "ins-property-photos";
    case "observations":
      return "ins-observations";
    case "inspectionConfirmed":
      return "ins-confirm";
    case "boundaries":
      return "ins-boundaries-section";
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
  if (errors.freePhotos) return inspectorFieldTargetId("freePhotos");
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
  if (errors.missingComponentPhotoKey) {
    return inspectorFieldTargetId(
      `component-photo:${errors.missingComponentPhotoKey}`,
    );
  }
  if (errors.componentPhotos) return inspectorFieldTargetId("componentPhotos");
  if (errors.missingBoundaryKey) {
    return inspectorFieldTargetId(`boundary:${errors.missingBoundaryKey}`);
  }
  if (errors.boundaries) return inspectorFieldTargetId("boundaries");
  if (errors.missingDefinedPhotoSlotId) {
    return inspectorFieldTargetId(
      `defined-slot:${errors.missingDefinedPhotoSlotId}`,
    );
  }
  if (errors.definedPhotos) return inspectorFieldTargetId("definedPhotos");
  if (errors.missingObservationId) {
    return inspectorFieldTargetId(`observation:${errors.missingObservationId}`);
  }
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
    .filter(
      (field) =>
        !isInspectorPresenceToggleField(field) &&
        !isInspectorRetiredFeatureKey(field.key) &&
        !(submission.featureValues[field.key] ?? "").trim(),
    )
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

  if (!options?.boundariesUnavailable) {
    const missingMismatchNotes = INSPECTOR_BOUNDARY_KEYS.filter((key) => {
      const row = submission.boundaryMatches[key];
      return Boolean(row) && row.matches === false && !row.mismatchNote.trim();
    });
    if (missingMismatchNotes.length > 0) {
      errors.boundaries = "أضف ملاحظة عدم التطابق لكل حد غير مطابق";
      errors.missingBoundaryKey = missingMismatchNotes[0];
    }
  }

  const incompleteObs = submission.observations.find((o) => !o.text.trim());
  if (incompleteObs) {
    errors.observations = "كل ملاحظة يجب أن تتضمن شرحاً";
    errors.missingObservationId = incompleteObs.id;
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
    if (componentIssue) {
      errors.componentPhotos = componentIssue;
      errors.missingComponentPhotoKey = componentIssue.includes("المعرض")
        ? "showroom"
        : "well";
    }

    const freeIssue = photoIssues.find((issue) => issue.includes("إضافية"));
    if (freeIssue) errors.freePhotos = freeIssue;

    const definedIssue = photoIssues.find(
      (issue) =>
        issue.includes("بانتظار الاعتماد") ||
        issue.includes("الخادم") ||
        issue.includes("خدمة") ||
        issue.includes("مرفق"),
    );
    if (definedIssue) {
      errors.definedPhotos = definedIssue;
      const slotId = firstIncompleteServiceAmenitySlotId(submission);
      if (slotId) errors.missingDefinedPhotoSlotId = slotId;
    }
  }

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
  "boundaries",
  "freePhotos",
  "definedPhotos",
  "observations",
  "inspectionConfirmed",
  "_",
] as const;

export function inspectorWorkspaceHasBlockingErrors(
  errors: InspectorWorkspaceFieldErrors,
): boolean {
  if ((errors.emptyFeatureKeys?.length ?? 0) > 0) return true;
  return INSPECTOR_ERROR_KEYS.some((key) => {
    const value = errors[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

export type InspectorWizardStepId = 1 | 2 | 3;

const WIZARD_STEP_ERROR_KEYS: Record<
  InspectorWizardStepId,
  readonly (keyof InspectorWorkspaceFieldErrors)[]
> = {
  1: [
    "inspectionDate",
    "inspectionTime",
    "mapLatitude",
    "mapLongitude",
    "accessContactName",
    "accessContactPhone",
    "accessContactRole",
    "accessRouteDescription",
    "freePhotos",
  ],
  2: [
    "features",
    "movablesDescription",
    "occupancyDescription",
    "featurePhotos",
    "componentPhotos",
    "boundaries",
    "definedPhotos",
  ],
  3: ["observations", "inspectionConfirmed"],
};

export function pickInspectorErrorsForWizardStep(
  errors: InspectorWorkspaceFieldErrors,
  step: InspectorWizardStepId,
): InspectorWorkspaceFieldErrors {
  const picked: InspectorWorkspaceFieldErrors = {};
  for (const key of WIZARD_STEP_ERROR_KEYS[step]) {
    const value = errors[key];
    if (typeof value === "string" && value.trim()) {
      Object.assign(picked, { [key]: value });
    }
  }
  if (step === 2) {
    if (errors.emptyFeatureKeys?.length) {
      picked.emptyFeatureKeys = errors.emptyFeatureKeys;
    }
    if (errors.missingFeaturePhotoKey) {
      picked.missingFeaturePhotoKey = errors.missingFeaturePhotoKey;
    }
    if (errors.missingDefinedPhotoSlotId) {
      picked.missingDefinedPhotoSlotId = errors.missingDefinedPhotoSlotId;
    }
    if (errors.missingBoundaryKey) {
      picked.missingBoundaryKey = errors.missingBoundaryKey;
    }
    if (errors.missingComponentPhotoKey) {
      picked.missingComponentPhotoKey = errors.missingComponentPhotoKey;
    }
  }
  if (step === 3 && errors.missingObservationId) {
    picked.missingObservationId = errors.missingObservationId;
  }
  return picked;
}

export function inspectorWizardStepForErrorTarget(
  targetId: string,
): InspectorWizardStepId {
  if (
    targetId === "ins-date" ||
    targetId === "ins-time" ||
    targetId === "ins-map-section" ||
    targetId === "ins-property-photos" ||
    targetId.startsWith("ins-access")
  ) {
    return 1;
  }
  if (
    targetId === "ins-observations" ||
    targetId === "ins-confirm" ||
    targetId.startsWith("ins-observation-")
  ) {
    return 3;
  }
  return 2;
}

export function scheduleInspectorErrorScroll(
  errors: InspectorWorkspaceFieldErrors,
  delayMs = 80,
): void {
  scheduleScrollToFormField(firstInspectorWorkspaceErrorTarget(errors), delayMs);
}

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
