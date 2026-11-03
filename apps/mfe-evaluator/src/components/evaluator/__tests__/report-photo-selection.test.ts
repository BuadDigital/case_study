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

  it("prints no photo while the specialist chose none", () => {
    expect(reportPhotoSelection(workspace, null)).toEqual({
      inspectorPhotoIds: ["front", "meter", "unlisted"],
      photoSlotIds: [],
      movablesSlotIds: [],
    });
  });

  it("prints the specialist's board in its order", () => {
    const marks = { ...EMPTY_PROPERTY_PHOTO_MARKS, report: ["meter", "front"], reportOrdered: true };
    expect(reportPhotoSelection(workspace, marks).photoSlotIds).toEqual(["meter", "front"]);
  });

  it("prints the chosen movables in their own section", () => {
    documents.list = [...documents.list, photo("sofa", "صورة توثيقية — منقولات")];
    const marks = { ...EMPTY_PROPERTY_PHOTO_MARKS, movables: ["sofa"] };
    expect(reportPhotoSelection(workspace, marks).movablesSlotIds).toEqual(["sofa"]);
    expect(reportPhotoSelection(workspace, null).movablesSlotIds).toEqual([]);
  });

  it("treats a choice whose photos are gone as no choice", () => {
    const marks = { ...EMPTY_PROPERTY_PHOTO_MARKS, report: ["gone"], reportOrdered: true };
    expect(reportPhotoSelection(workspace, marks).photoSlotIds).toEqual([]);
  });
});
