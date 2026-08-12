import { describe, expect, it } from "vitest";
import {
  filterInspectorPhotoFiles,
} from "../inspector-photo-drop";

describe("filterInspectorPhotoFiles", () => {
  it("keeps image mime types and common extensions", () => {
    const files = [
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.heic", { type: "" }),
      new File(["c"], "notes.pdf", { type: "application/pdf" }),
    ];
    const kept = filterInspectorPhotoFiles(files);
    expect(kept.map((f) => f.name)).toEqual(["a.jpg", "b.heic"]);
  });
});
