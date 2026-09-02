import { describe, expect, it } from "vitest";
import {
  coordsFromLocationMapUrl,
  mapPoRecordsToMapProperties,
  resolveLivePropertyCoords,
} from "../map-live-records";
import type { PoIntakeRecord } from "../po-intake-property-model";
import { emptyProperty } from "../po-intake-property-model";

describe("map-live-records", () => {
  it("parses coords from Google Maps query URL", () => {
    expect(
      coordsFromLocationMapUrl(
        "https://www.google.com/maps/search/?api=1&query=24.7136,46.6753",
      ),
    ).toEqual({ lat: 24.7136, lng: 46.6753 });
  });

  it("falls back to city centroid when no map URL", () => {
    const { coords, coordsSource } = resolveLivePropertyCoords({
      city: "الرياض",
      deedNumber: "123",
      locationMapUrl: "",
    });
    expect(coords).not.toBeNull();
    expect(coordsSource).toBe("تقريبي (مدينة)");
  });

  it("maps PO properties with poNumber/propertyId for deep links", () => {
    const prop = {
      ...emptyProperty(),
      id: "prop-1",
      deedNumber: "310112003308",
      city: "جدة",
      district: "السلامة",
      propertyType: "أرض سكنية",
      area: "450",
    };
    const records: PoIntakeRecord[] = [
      {
        id: "wo-1",
        poNumber: "PO-100",
        assignmentType: "تنفيذ",
        promulgationDate: "",
        receivedFromEnfathAt: "",
        receivedFromEnfathTime: "",
        assignmentSpecialist: "",
        assignmentSpecialistEmail: "",
        expectedPropertyCount: 1,
        propertiesRegion: "",
        workOrderDescription: "",
        clientId: "c1",
        reportUserClientIds: [],
        clientNameAr: "منصة إنفاذ",
        dueDateAt: "",
        properties: [prop],
        createdAtUtc: "2026-08-01T10:00:00Z",
      },
    ];
    const mapped = mapPoRecordsToMapProperties(records);
    expect(mapped).toHaveLength(1);
    expect(mapped[0]!.poNumber).toBe("PO-100");
    expect(mapped[0]!.propertyId).toBe("prop-1");
    expect(mapped[0]!.refNo).toBe("PO-100");
    expect(mapped[0]!.coords).not.toBeNull();
    expect(mapped[0]!.workflowStatus).toBe("in_progress");
  });
});
