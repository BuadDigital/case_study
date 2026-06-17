import {
  getFieldDictionary,
  saveFieldDictionary,
  type FieldDictionaryFieldDto,
  type FieldDictionaryStateDto,
} from "@platform/api-client";
import {
  emptyFieldDictionaryState,
  type FieldDictionaryAssignment,
  type FieldDictionaryField,
  type FieldDictionaryState,
} from "@platform/app-shared/prototype/field-dictionary";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import { apiErrorMessage } from "../settings-api-config";

export const FIELD_DICTIONARY_CHANGED_EVENT = "field-dictionary-changed";

function toAssignmentDto(
  assignment: FieldDictionaryAssignment,
): FieldDictionaryFieldDto["assignments"][number] {
  return {
    role: assignment.role,
    screens: assignment.screens,
    mode: assignment.mode,
    required: assignment.required ?? false,
    final: assignment.final ?? false,
  };
}

function toFieldDto(field: FieldDictionaryField): FieldDictionaryFieldDto {
  return {
    id: field.id,
    ref: field.ref,
    key: field.key,
    name: field.name,
    type: field.type,
    tags: field.tags,
    source: field.source ?? null,
    parent: field.parent ?? null,
    child: field.child ?? null,
    persisted: field.persisted,
    assignments: field.assignments.map(toAssignmentDto),
  };
}

function toStateDto(
  state: FieldDictionaryState,
): Pick<FieldDictionaryStateDto, "fields" | "tags"> {
  return {
    fields: state.fields.map(toFieldDto),
    tags: state.tags,
  };
}

export function notifyFieldDictionaryChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FIELD_DICTIONARY_CHANGED_EVENT));
  }
}

export async function loadFieldDictionaryFromApi(): Promise<FieldDictionaryState> {
  const config = prototypeModulesApiConfig();
  if (!config) return emptyFieldDictionaryState();

  const result = await getFieldDictionary(config);
  if (!result.ok) {
    console.warn(apiErrorMessage(result.kind, "Field dictionary API"));
    return emptyFieldDictionaryState();
  }

  if (result.data.fields.length === 0 && result.data.tags.length === 0) {
    return emptyFieldDictionaryState();
  }

  return {
    fields: result.data.fields as FieldDictionaryState["fields"],
    tags: result.data.tags,
  };
}

export async function saveFieldDictionaryToApi(
  state: FieldDictionaryState,
): Promise<FieldDictionaryState | null> {
  const config = prototypeModulesApiConfig();
  if (!config) return null;

  const result = await saveFieldDictionary(config, toStateDto(state));
  if (!result.ok) {
    console.warn(apiErrorMessage(result.kind, "Field dictionary API"));
    return null;
  }

  const saved: FieldDictionaryState = {
    fields: result.data.fields as FieldDictionaryState["fields"],
    tags: result.data.tags,
  };
  notifyFieldDictionaryChanged();
  return saved;
}

export async function resetFieldDictionaryOnApi(): Promise<FieldDictionaryState> {
  const empty = emptyFieldDictionaryState();
  const saved = await saveFieldDictionaryToApi(empty);
  return saved ?? empty;
}
