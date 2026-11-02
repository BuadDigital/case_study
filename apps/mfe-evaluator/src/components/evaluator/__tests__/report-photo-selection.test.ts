import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_PROPERTY_PHOTO_MARKS,
  type PropertyDetailDocumentEntry,
} from "@platform/app-shared/app-data/property-detail-document-types";
import type { InspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";

const documents = vi.hoisted(() => ({ list: [] as PropertyDetailDocumentEntry[] }));

vi.mock("../../../lib/case-study-bridge", () => ({
  collectFieldInspectionDocumentsFromSubmission: () => documents.list,
  fetchInspectorWorkspace: vi.fn(),
}));
vi.mock("../../../lib/evaluator/valuation-report-print-attachments", () => ({
  collectInspectorPhotoAttachmentIds: () => ["meter", "front", "unlisted"],
  loadValuationReportPrintAttachments: vi.fn(),
  surveyReportAttachmentIdFromPayload: vi.fn(),
}));

import { reportPhotoSelection } from "../evaluator-report-output-helpers";

const photo = (id: string, name: string): PropertyDetailDocumentEntry => ({
  id,
  name,
  fileName: `${id}.jpg`,
  source: "المعاين الميداني",
  kind: "image",
  attachmentId: id,
});

const workspace = {} as InspectorWorkspaceDraft;

describe("the photos the report prints", () => {
  beforeEach(() => {
    documents.list = [photo("meter", "خدمة: كهرباء"), photo("front", "صور خارجية")];
  });

  it("fills the slots in the report's order, the main photo first, each with its section", () => {
    expect(reportPhotoSelection(workspace, null)).toEqual({
      inspectorPhotoIds: ["front", "meter", "unlisted"],
      photoSlotIds: [],
      sectionLabels: { front: "صور خارجية", meter: "صور أخرى" },
    });
  });

  it("prints only the specialist's choice when there is one", () => {
    const marks = { ...EMPTY_PROPERTY_PHOTO_MARKS, report: ["meter", "front"] };
    expect(reportPhotoSelection(workspace, marks).photoSlotIds).toEqual(["front", "meter"]);
  });

  it("prints a photo under the section the specialist gave it", () => {
    const marks = { ...EMPTY_PROPERTY_PHOTO_MARKS, report: ["meter"], reportSections: { meter: 2 as const } };
    const selection = reportPhotoSelection(workspace, marks);
    expect(selection.photoSlotIds).toEqual(["front", "meter"]);
    expect(selection.sectionLabels.meter).toBe("صور داخلية");
  });

  it("treats a choice whose photos are gone as no choice", () => {
    const marks = { ...EMPTY_PROPERTY_PHOTO_MARKS, report: ["gone"] };
    expect(reportPhotoSelection(workspace, marks).photoSlotIds).toEqual([]);
  });
});
