import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useUnsavedEditsGuard } from "../useUnsavedEditsGuard";
import {
  hasUnsavedSections,
  resetUnsavedSectionsForTests,
  setSectionUnsaved,
} from "../../../lib/evaluator/unsaved-edits";

afterEach(() => resetUnsavedSectionsForTests());

describe("useUnsavedEditsGuard (round 2)", () => {
  it("a hidden section keeps its flag while the window lives; the window unmount clears them", () => {
    const root = { current: document.createElement("div") };
    const { unmount } = renderHook(() => useUnsavedEditsGuard(root, () => false));
    setSectionUnsaved("final-opinion", true);
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    unmount();
    expect(hasUnsavedSections()).toBe(false);
  });
});
