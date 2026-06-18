import {
  getFieldDictionary,
  saveFieldDictionary,
  type FieldDictionaryFieldDto,
  type FieldDictionaryStateDto,
} from "@platform/api-client";
import {
  emptyFieldDictionaryState,
  fieldDictionaryHasNewKeys,
  fieldsFromCustomAssignedScreens,
  syncFieldDictionaryState,
  type FieldDictionaryAssignment,
  type FieldDictionaryField,
  type FieldDictionaryState,
} from "@platform/app-shared/prototype/field-dictionary";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import { fetchAllCustomAssignedScreens } from "../custom-screens-api";
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

async function discoverDynamicFields(): Promise<FieldDictionaryField[]> {
  const result = await fetchAllCustomAssignedScreens();
  if (result.error || result.screens.length === 0) return [];
  return fieldsFromCustomAssignedScreens(result.screens);
}

/** يبني فهرس القاموس من حقول النظام + الشاشات الديناميكية + المحفوظ. */
export async function buildSyncedFieldDictionaryState(): Promise<FieldDictionaryState> {
  const baseline = emptyFieldDictionaryState();
  let stored: FieldDictionaryState | null = null;

  const config = prototypeModulesApiConfig();
  if (config) {
    const result = await getFieldDictionary(config);
    if (result.ok && (result.data.fields.length > 0 || result.data.tags.length > 0)) {
      stored = {
        fields: result.data.fields as FieldDictionaryState["fields"],
        tags: result.data.tags,
      };
    }
  }

  const dynamicFields = await discoverDynamicFields();
  return syncFieldDictionaryState({
    catalogFields: baseline.fields,
    dynamicFields,
    stored,
    defaultTags: baseline.tags,
  });
}

export async function loadFieldDictionaryFromApi(): Promise<FieldDictionaryState> {
  const baseline = emptyFieldDictionaryState();
  let stored: FieldDictionaryState | null = null;
  let previousFields: FieldDictionaryField[] = [];

  const config = prototypeModulesApiConfig();
  if (config) {
    const result = await getFieldDictionary(config);
    if (result.ok) {
      previousFields = result.data.fields as FieldDictionaryField[];
      if (previousFields.length > 0 || result.data.tags.length > 0) {
        stored = {
          fields: previousFields,
          tags: result.data.tags,
        };
      }
    }
  }

  const dynamicFields = await discoverDynamicFields();
  const synced = syncFieldDictionaryState({
    catalogFields: baseline.fields,
    dynamicFields,
    stored,
    defaultTags: baseline.tags,
  });

  const shouldPersist =
    previousFields.length === 0 ||
    fieldDictionaryHasNewKeys(previousFields, synced.fields) ||
    previousFields.length !== synced.fields.length;

  if (!shouldPersist) return synced;

  const saved = await saveFieldDictionaryToApi(synced);
  return saved ?? synced;
}

export async function syncFieldDictionaryFromSystem(): Promise<FieldDictionaryState> {
  const synced = await buildSyncedFieldDictionaryState();
  const saved = await saveFieldDictionaryToApi(synced);
  notifyFieldDictionaryChanged();
  return saved ?? synced;
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
  const baseline = emptyFieldDictionaryState();
  const dynamicFields = await discoverDynamicFields();
  const synced = syncFieldDictionaryState({
    catalogFields: baseline.fields,
    dynamicFields,
    stored: null,
    defaultTags: baseline.tags,
  });
  const saved = await saveFieldDictionaryToApi(synced);
  return saved ?? synced;
}
