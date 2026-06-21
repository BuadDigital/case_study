import { bootstrapFieldDictionary } from "./bootstrap";
import { DEFAULT_FIELD_DICTIONARY_TAGS } from "./tags";
import type { FieldDictionaryState } from "./types";

export function emptyFieldDictionaryState(): FieldDictionaryState {
  return {
    fields: bootstrapFieldDictionary(),
    tags: [...DEFAULT_FIELD_DICTIONARY_TAGS],
  };
}
