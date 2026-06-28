import {
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
    | "_"
    ,
    string
  >
>;

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
  if (!submission.mapLatitude.trim() || !submission.mapLongitude.trim()) {
    errors.mapLatitude = "يجب تحديد موقع العقار (GPS)";
  }
  if (!submission.inspectionConfirmed) {
    errors.inspectionConfirmed = "يجب التأشير على إقرار المعاينة";
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
    const featureIssue = photoIssues.find((issue) => issue.includes("توثيقية"));
    if (featureIssue) errors.featurePhotos = featureIssue;

    const componentIssue = photoIssues.find(
      (issue) =>
        issue.includes("عدد المعارض") || issue.includes("عدد الآبار"),
    );
    if (componentIssue) errors.componentPhotos = componentIssue;

    const definedIssue = photoIssues.find(
      (issue) =>
        issue.includes("الموثّقة") ||
        issue.includes("بانتظار الاعتماد") ||
        issue.includes("إضافية"),
    );
    if (definedIssue) errors.definedPhotos = definedIssue;
  }

  void options?.boundariesUnavailable;
  return errors;
}

export function firstInspectorWorkspaceError(
  errors: InspectorWorkspaceFieldErrors,
): string | null {
  const general = errors._?.trim();
  if (general) return general;
  for (const value of Object.values(errors)) {
    if (value?.trim()) return value.trim();
  }
  return null;
}

export function allInspectorWorkspaceErrors(
  errors: InspectorWorkspaceFieldErrors,
): string[] {
  const list: string[] = [];
  const general = errors._?.trim();
  if (general) list.push(general);
  for (const value of Object.values(errors)) {
    if (value?.trim() && value !== general) list.push(value.trim());
  }
  return list;
}
