"use client";

import { useMemo } from "react";
import { reportPhotoLimit } from "@platform/app-shared/app-data/property-detail-document-types";
import { propertyIsLand } from "@platform/app-shared/app-data/po-intake-property-model";
import { useValuationListsQuery } from "@platform/app-shared/query/valuation-lists-query";
import { PropertyDetailPhotosTab } from "../components/po-intake/PropertyDetailPhotosTab";
import { usePropertyPhotoMarks } from "../components/po-intake/usePropertyPhotoMarks";
import { listPropertyDetailPhotos } from "../lib/app-data/property-detail-documents";
import type { PoIntakeRecord, PoPropertyIntake } from "../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../lib/app-data/tasks";
import { useWorkDeedDocuments } from "./use-work-deed-documents";

/**
 * The work page's «صور التقرير» section (Omar 2026-11-09: moved here from the details page's photos
 * tab) — the specialist's board of the report's photos, the movables board when the inspector found
 * movables, and the inspector's photos to pick from.
 *
 * How it works: the deed's documents give the photos; `usePropertyPhotoMarks` holds and saves the
 * boards, exactly as the photos tab did; the report's photo count comes from the settings.
 * Edge cases: the boards are editable until the study report is issued (the hook's rule — the server
 * refuses after it too); a viewer who may not manage work orders sees them read-only. Mounted on the
 * section's first open, so the photos are read only then.
 */
export function WorkPhotosSection({
  record,
  property,
  task,
  studyTask,
  tasks,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  /** The deed's own case-study task. */
  task: WorkflowTask | null;
  /** The task holding the transaction's study — its issue closes the boards. */
  studyTask: WorkflowTask | null;
  tasks: WorkflowTask[];
}) {
  const { inspectionTask, documentSections } = useWorkDeedDocuments({ record, property, task, tasks });
  const photos = useMemo(() => listPropertyDetailPhotos(documentSections), [documentSections]);
  const { data: valuationLists } = useValuationListsQuery();
  const reportLimit = reportPhotoLimit(valuationLists, propertyIsLand(property));
  const marks = usePropertyPhotoMarks({
    poNumber: record.poNumber,
    propertyId: property.id,
    stored: property.photoMarks,
    studyTaskId: studyTask?.id ?? null,
    inspectionTaskId: inspectionTask?.id ?? null,
    enabled: true,
    reportLimit,
  });

  return (
    <div className="pt-3">
      <PropertyDetailPhotosTab
        photos={photos}
        marks={marks.marks}
        reportLimit={reportLimit}
        movablesPresent={marks.movablesPresent}
        onChangeMarks={marks.canEdit ? marks.change : undefined}
      />
    </div>
  );
}
