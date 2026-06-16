import { bootstrapFieldDictionary } from "./bootstrap";
import { DEFAULT_FIELD_DICTIONARY_TAGS } from "./tags";
import type { FieldDictionaryField, FieldDictionaryState } from "./types";

const STORAGE_KEY = "evalFieldDictionary_v1";

export function emptyFieldDictionaryState(): FieldDictionaryState {
  return {
    fields: bootstrapFieldDictionary(),
    tags: [...DEFAULT_FIELD_DICTIONARY_TAGS],
  };
}

export function loadFieldDictionaryState(): FieldDictionaryState {
  if (typeof window === "undefined") return emptyFieldDictionaryState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyFieldDictionaryState();
    const parsed = JSON.parse(raw) as FieldDictionaryState;
    if (!Array.isArray(parsed.fields) || !Array.isArray(parsed.tags)) {
      return emptyFieldDictionaryState();
    }
    return parsed;
  } catch {
    return emptyFieldDictionaryState();
  }
}

export function saveFieldDictionaryState(state: FieldDictionaryState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetFieldDictionaryState(): FieldDictionaryState {
  const state = emptyFieldDictionaryState();
  saveFieldDictionaryState(state);
  return state;
}

export function updateFieldDictionaryFields(
  fields: FieldDictionaryField[],
  current: FieldDictionaryState,
): FieldDictionaryState {
  return { ...current, fields };
}

export function updateFieldDictionaryTags(
  tags: string[],
  current: FieldDictionaryState,
): FieldDictionaryState {
  return { ...current, tags };
}
