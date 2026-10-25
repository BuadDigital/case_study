import { afterEach, describe, expect, it } from "vitest";
import {
  editableText,
  focusedFieldChanged,
  hasUnsavedSections,
  resetUnsavedSectionsForTests,
  setSectionUnsaved,
} from "../unsaved-edits";

afterEach(() => resetUnsavedSectionsForTests());

describe("unsaved edits (problem 19)", () => {
  it("an adjustment cell typed in but not blurred counts as unsaved", () => {
    const cell = document.createElement("input");
    cell.value = "5";
    const atFocus = editableText(cell);
    cell.value = "7.5";
    expect(focusedFieldChanged(cell, atFocus)).toBe(true);
    cell.value = "5";
    expect(focusedFieldChanged(cell, atFocus)).toBe(false);
  });

  it("checkboxes, read-only and disabled fields hold no typed text", () => {
    const box = document.createElement("input");
    box.type = "checkbox";
    const readOnly = document.createElement("textarea");
    readOnly.readOnly = true;
    const area = document.createElement("textarea");
    area.value = "مبرر";
    expect(editableText(box)).toBeNull();
    expect(editableText(readOnly)).toBeNull();
    expect(editableText(area)).toBe("مبرر");
    expect(editableText(document.createElement("div"))).toBeNull();
  });

  it("a manual-save section reports its drafts until it saves", () => {
    expect(hasUnsavedSections()).toBe(false);
    setSectionUnsaved("final-opinion", true);
    expect(hasUnsavedSections()).toBe(true);
    setSectionUnsaved("final-opinion", false);
    expect(hasUnsavedSections()).toBe(false);
  });
});
