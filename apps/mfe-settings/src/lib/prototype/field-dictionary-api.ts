import {
  getFieldDictionary,
  saveFieldDictionary,
} from "@platform/api-client";
import {
  emptyFieldDictionaryState,
  type FieldDictionaryState,
} from "@platform/app-shared/prototype/field-dictionary";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import { apiErrorMessage } from "../settings-api-config";

export const FIELD_DICTIONARY_CHANGED_EVENT = "field-dictionary-changed";

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

  const result = await saveFieldDictionary(config, {
    fields: state.fields,
    tags: state.tags,
  });
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
