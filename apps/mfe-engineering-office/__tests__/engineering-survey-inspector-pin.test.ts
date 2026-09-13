import { describe, expect, it } from "vitest";
import {
  isEngineeringDefaultPin,
  withInspectorPinSeed,
  engineeringPinMismatchesInspector,
  locationPinMismatchInternalNote,
  LOCATION_PIN_MISMATCH_NOTE_PREFIX,
} from "../src/lib/engineering-survey-inspector-pin";
import { createEngineeringSurveyDraft } from "../src/lib/engineering-survey-data";
import { jeddahDefaultCoords } from "@platform/app-shared/domain/jeddah-default-coords";

describe("engineering-survey-inspector-pin", () => {
  it("detects Jeddah default seed coords", () => {
    const d = jeddahDefaultCoords();
    expect(isEngineeringDefaultPin(d.latitude, d.longitude)).toBe(true);
    expect(isEngineeringDefaultPin("21.50000", "39.20000")).toBe(false);
  });

  it("seeds map + reference from inspector pin while still on defaults", () => {
    const draft = createEngineeringSurveyDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const seeded = withInspectorPinSeed(draft, { lat: 21.5, lng: 39.2 });
    expect(seeded.latitude).toBe("21.50000");
    expect(seeded.longitude).toBe("39.20000");
    expect(seeded.inspectorReferenceLatitude).toBe("21.50000");
    expect(seeded.inspectorReferenceLongitude).toBe("39.20000");
  });

  it("does not overwrite an office pin that already moved", () => {
    const draft = createEngineeringSurveyDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
      latitude: "21.51000",
      longitude: "39.21000",
    });
    const seeded = withInspectorPinSeed(draft, { lat: 21.5, lng: 39.2 });
    expect(seeded.latitude).toBe("21.51000");
    expect(seeded.longitude).toBe("39.21000");
    expect(seeded.inspectorReferenceLatitude).toBe("21.50000");
  });

  it("flags mismatch beyond 500 m", () => {
    const result = engineeringPinMismatchesInspector({
      latitude: "21.51000",
      longitude: "39.20000",
      inspectorReferenceLatitude: "21.50000",
      inspectorReferenceLongitude: "39.20000",
    });
    expect(result.mismatch).toBe(true);
    if (result.mismatch) {
      expect(result.distanceM).toBeGreaterThan(500);
      expect(
        locationPinMismatchInternalNote(result).startsWith(
          LOCATION_PIN_MISMATCH_NOTE_PREFIX,
        ),
      ).toBe(true);
    }
  });

  it("allows match within 500 m", () => {
    const result = engineeringPinMismatchesInspector({
      latitude: "21.50010",
      longitude: "39.20000",
      inspectorReferenceLatitude: "21.50000",
      inspectorReferenceLongitude: "39.20000",
    });
    expect(result.mismatch).toBe(false);
  });
});
