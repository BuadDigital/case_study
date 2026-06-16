import type {
  FieldAssignmentReliability,
  FieldDictionaryAssignment,
  FieldDictionaryField,
  FieldDictionaryLayer,
  FieldReliabilityMode,
} from "./types";

export const FIELD_DICTIONARY_LAYERS: FieldDictionaryLayer[] = [
  "frontend",
  "backend",
];

export const FIELD_DICTIONARY_LAYER_LABELS: Record<
  FieldDictionaryLayer,
  string
> = {
  frontend: "الواجهة",
  backend: "الخادم (API)",
};

/** يحدّد إن كان الحقل من نماذج الواجهة أم من كيان API/قاعدة البيانات. */
export function fieldDictionaryLayer(
  field: FieldDictionaryField,
): FieldDictionaryLayer {
  if (
    field.key.startsWith("WorkOrderProperty.") ||
    field.key.startsWith("PropertyContact.")
  ) {
    return "backend";
  }
  return "frontend";
}

export function assignmentMode(
  assignment: FieldDictionaryAssignment,
): "input" | "view" {
  return assignment.mode === "view" ? "view" : "input";
}

export function inputAssignments(
  field: FieldDictionaryField,
): FieldDictionaryAssignment[] {
  return field.assignments.filter(
    (assignment) => assignmentMode(assignment) === "input",
  );
}

export function fieldReliabilityMode(
  field: FieldDictionaryField,
): FieldReliabilityMode {
  const inputs = inputAssignments(field);
  const hasFinal = inputs.some((assignment) => assignment.final);
  const hasNonFinal = inputs.some((assignment) => !assignment.final);
  return hasFinal && hasNonFinal ? "متعدد" : "واحد";
}

export function assignmentReliability(
  field: FieldDictionaryField,
  assignment: FieldDictionaryAssignment,
): FieldAssignmentReliability {
  const hasFinal = inputAssignments(field).some((item) => item.final);
  if (!hasFinal) return "معتمد";
  return assignment.final ? "معتمد" : "أولي";
}

export function fieldRoles(field: FieldDictionaryField): string[] {
  return [...new Set(field.assignments.map((assignment) => assignment.role))];
}

export function fieldScreens(field: FieldDictionaryField): string[] {
  const screens: string[] = [];
  field.assignments.forEach((assignment) => {
    assignment.screens.forEach((screenId) => {
      if (!screens.includes(screenId)) screens.push(screenId);
    });
  });
  return screens;
}

export function nextFieldRef(fields: FieldDictionaryField[]): string {
  let max = 0;
  fields.forEach((field) => {
    const numeric = parseInt(field.ref.replace(/[^0-9]/g, ""), 10);
    if (numeric > max) max = numeric;
  });
  return `FLD-${String(max + 1).padStart(3, "0")}`;
}
