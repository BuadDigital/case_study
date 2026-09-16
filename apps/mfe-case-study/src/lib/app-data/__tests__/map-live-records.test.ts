import { describe, expect, it } from "vitest";
import type {
  FieldInspectionWorkspaceListItemDto,
  ValuationRequestDto,
} from "@platform/api-client";
import {
  coordsFromLocationMapUrl,
  fillValuersFromAppraisalTasks,
  inspectorPinsByPropertyId,
  mapPoRecordsToMapProperties,
  resolveLivePropertyCoords,
  valuationsByPropertyId,
} from "../map-live-records";
import type { PoIntakeRecord } from "../po-intake-property-model";
import { emptyProperty } from "../po-intake-property-model";

function sampleRecord(propertyId = "prop-1"): PoIntakeRecord[] {
  const prop = {
    ...emptyProperty(),
    id: propertyId,
    deedNumber: "310112003308",
    city: "جدة",
    district: "السلامة",
    propertyType: "أرض سكنية",
    area: "450",
  };
  return [
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
}

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

  it("prefers the inspector pin over the city centroid", () => {
    const { coords, coordsSource } = resolveLivePropertyCoords(
      {
        city: "الرياض",
        deedNumber: "123",
        locationMapUrl: "",
      },
      { lat: 21.5433, lng: 39.1728 },
    );
    expect(coords).toEqual({ lat: 21.5433, lng: 39.1728 });
    expect(coordsSource).toBe("معاينة");
  });

  it("maps PO properties with poNumber/propertyId for deep links", () => {
    const mapped = mapPoRecordsToMapProperties(sampleRecord());
    expect(mapped).toHaveLength(1);
    expect(mapped[0]!.poNumber).toBe("PO-100");
    expect(mapped[0]!.propertyId).toBe("prop-1");
    expect(mapped[0]!.refNo).toBe("PO-100");
    expect(mapped[0]!.coords).not.toBeNull();
    expect(mapped[0]!.workflowStatus).toBe("in_progress");
  });

  it("wires inspector pin and issued valuation onto the map card", () => {
    const workspaces: FieldInspectionWorkspaceListItemDto[] = [
      {
        workflowTaskId: "task-1",
        propertyId: "PROP-1",
        poNumber: "PO-100",
        inspectionDate: "2026-08-20",
        inspectionTime: null,
        status: "submitted",
        requiredPhotoSlots: 4,
        completedPhotoSlots: 4,
        pendingPhotoApprovals: 0,
        observationCount: 1,
        attachmentCount: 0,
        submittedAtUtc: "2026-08-20T10:00:00Z",
        updatedAtUtc: "2026-08-20T10:00:00Z",
        mapLatitude: 21.5433,
        mapLongitude: 39.1728,
      },
    ];
    const valuations: ValuationRequestDto[] = [
      {
        id: "vr-1",
        displayId: "VR-1",
        propId: "prop-1",
        area: "جدة",
        type: "أرض",
        appraiser: "م. خالد العتيبي",
        status: "done",
        date: "2026-09-01",
        issueDate: "2026-09-10",
        finalOpinionValue: 1850000,
      },
    ];
    const mapped = mapPoRecordsToMapProperties(sampleRecord(), {
      inspectorPins: inspectorPinsByPropertyId(workspaces),
      valuations: valuationsByPropertyId(valuations),
    });
    expect(mapped[0]!.coords).toEqual({ lat: 21.5433, lng: 39.1728 });
    expect(mapped[0]!.coordsSource).toBe("معاينة");
    expect(mapped[0]!.valuer).toBe("م. خالد العتيبي");
    expect(mapped[0]!.valuationDate).toBe("2026-09-01");
    expect(mapped[0]!.issueDate).toBe("2026-09-10");
    expect(mapped[0]!.finalValue).toBe(1850000);
    expect(mapped[0]!.workflowStatus).toBe("issued");
  });

  it("fills the valuer from the appraisal task when no valuation request exists", () => {
    const mapped = mapPoRecordsToMapProperties(sampleRecord(), {
      valuations: fillValuersFromAppraisalTasks(
        valuationsByPropertyId([]),
        [
          {
            kind: "property-appraisal",
            propertyId: "prop-1",
            assigneeName: "أ. فهد الشمري",
          },
        ],
      ),
    });
    expect(mapped[0]!.valuer).toBe("أ. فهد الشمري");
    expect(mapped[0]!.workflowStatus).toBe("in_progress");
    expect(mapped[0]!.finalValue).toBeNull();
  });
});
