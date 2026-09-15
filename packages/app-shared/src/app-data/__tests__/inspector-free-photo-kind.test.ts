import { describe, expect, it } from "vitest";
import {
  INSPECTOR_FREE_PHOTO_CATEGORY_EXTERIOR,
  INSPECTOR_FREE_PHOTO_CATEGORY_FACADE,
  INSPECTOR_FREE_PHOTO_CATEGORY_INTERIOR,
  INSPECTOR_FREE_PHOTO_CATEGORY_OTHER,
  INSPECTOR_FREE_PHOTO_CATEGORY_SERVICE,
  buildInspectorFreePhotoCategory,
  inspectorFreePhotoKindsForParent,
  inspectorFreePhotoNeedsKind,
} from "../inspector-workspace-data";

describe("inspectorFreePhotoNeedsKind", () => {
  it("treats a parent-only bucket tag as still needing a kind", () => {
    expect(
      inspectorFreePhotoNeedsKind(INSPECTOR_FREE_PHOTO_CATEGORY_EXTERIOR),
    ).toBe(true);
    expect(
      inspectorFreePhotoNeedsKind(INSPECTOR_FREE_PHOTO_CATEGORY_INTERIOR),
    ).toBe(true);
  });

  it("treats a nested parent:kind tag as identified", () => {
    expect(
      inspectorFreePhotoNeedsKind(
        buildInspectorFreePhotoCategory(
          INSPECTOR_FREE_PHOTO_CATEGORY_EXTERIOR,
          INSPECTOR_FREE_PHOTO_CATEGORY_FACADE,
        ),
      ),
    ).toBe(false);
    expect(
      inspectorFreePhotoNeedsKind(
        buildInspectorFreePhotoCategory(
          INSPECTOR_FREE_PHOTO_CATEGORY_EXTERIOR,
          INSPECTOR_FREE_PHOTO_CATEGORY_OTHER,
        ),
      ),
    ).toBe(false);
  });
});

describe("inspectorFreePhotoKindsForParent", () => {
  it("offers facade only on exterior photos", () => {
    const exterior = inspectorFreePhotoKindsForParent(
      INSPECTOR_FREE_PHOTO_CATEGORY_EXTERIOR,
    ).map((k) => k.key);
    const interior = inspectorFreePhotoKindsForParent(
      INSPECTOR_FREE_PHOTO_CATEGORY_INTERIOR,
    ).map((k) => k.key);

    expect(exterior).toContain(INSPECTOR_FREE_PHOTO_CATEGORY_FACADE);
    expect(interior).not.toContain(INSPECTOR_FREE_PHOTO_CATEGORY_FACADE);
    expect(interior).toContain(INSPECTOR_FREE_PHOTO_CATEGORY_SERVICE);
  });
});
