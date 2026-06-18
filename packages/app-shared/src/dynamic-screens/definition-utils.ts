import type {
  DynamicScreenDefinition,
  DynamicScreenField,
  DynamicScreenFieldBinding,
  DynamicScreenStatus,
} from "@platform/types";

export function newDynamicFieldId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `fld-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyDynamicScreenDefinition(
  code = "SCR-01",
  ownerRole = "",
): DynamicScreenDefinition {
  return {
    code,
    ownerRole,
    status: "مخططة",
    fields: [],
    bindings: [],
  };
}

export function resolveDynamicScreenStatus(
  bindings: DynamicScreenFieldBinding[],
): DynamicScreenStatus {
  return bindings.length > 0 ? "موجودة" : "مخططة";
}

export function nextDynamicFieldRef(fields: DynamicScreenField[]): string {
  let max = 0;
  fields.forEach((field) => {
    const numeric = parseInt(field.ref.replace(/[^0-9]/g, ""), 10);
    if (numeric > max) max = numeric;
  });
  return `FLD-${String(max + 1).padStart(3, "0")}`;
}

export function nextDynamicScreenCode(codes: string[]): string {
  let max = 0;
  codes.forEach((code) => {
    const numeric = parseInt(code.replace(/[^0-9]/g, ""), 10);
    if (numeric > max) max = numeric;
  });
  return `SCR-${String(max + 1).padStart(2, "0")}`;
}

export function fieldById(
  definition: DynamicScreenDefinition,
  fieldId: string,
): DynamicScreenField | undefined {
  return definition.fields.find((field) => field.id === fieldId);
}

export function bindingForField(
  definition: DynamicScreenDefinition,
  fieldId: string,
): DynamicScreenFieldBinding | undefined {
  return definition.bindings.find((binding) => binding.fieldId === fieldId);
}
