import { bootstrapFieldDictionary } from "./bootstrap";
import { DEFAULT_FIELD_DICTIONARY_TAGS } from "./tags";
import type { FieldDictionaryField, FieldDictionaryState } from "./types";

/** In-memory only — persistence is via `/api/field-dictionary`. */
let memoryState: FieldDictionaryState | null = null;

export function emptyFieldDictionaryState(): FieldDictionaryState {
  return {
    fields: bootstrapFieldDictionary(),
    tags: [...DEFAULT_FIELD_DICTIONARY_TAGS],
  };
}

export function loadFieldDictionaryState(): FieldDictionaryState {
  return memoryState ?? emptyFieldDictionaryState();
}

export function saveFieldDictionaryState(state: FieldDictionaryState): void {
  memoryState = state;
}

export function resetFieldDictionaryState(): FieldDictionaryState {
  const state = emptyFieldDictionaryState();
  memoryState = state;
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
