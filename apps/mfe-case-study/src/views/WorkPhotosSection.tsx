"use client";

import { useMemo, useRef } from "react";
import { Button } from "@platform/ui-kit";
import { reportPhotoLimit } from "@platform/app-shared/app-data/property-detail-document-types";
import { propertyIsLand } from "@platform/app-shared/app-data/po-intake-property-model";
import { useValuationListsQuery } from "@platform/app-shared/query/valuation-lists-query";
import { PropertyDetailPhotosTab } from "../components/po-intake/PropertyDetailPhotosTab";
import { usePropertyPhotoMarks } from "../components/po-intake/usePropertyPhotoMarks";
import { useStaffAddedPhotos } from "../components/po-intake/useStaffAddedPhotos";
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
 * «إضافة صور» (Omar 2026-11-12, asked for by the study): the case staff add their own photos to the
 * ones to pick from — while the boards are editable and the inspection is sent (`useStaffAddedPhotos`).
 * The photos are marked «من الأخصائي», removed only from here, and print in the report like any
 * chosen photo (the report's photo pages carry no caption, so no source is printed there).
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

  const staffPhotos = useStaffAddedPhotos({
    inspectionTaskId: inspectionTask?.id ?? null,
    enabled: marks.canEdit,
  });
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="pt-3">
      <PropertyDetailPhotosTab
        photos={photos}
        marks={marks.marks}
        reportLimit={reportLimit}
        movablesPresent={marks.movablesPresent}
        onChangeMarks={marks.canEdit ? marks.change : undefined}
        onRemoveStaffPhoto={staffPhotos.allowed ? (photo) => void staffPhotos.remove(photo) : undefined}
        headAction={
          staffPhotos.allowed ? (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                hidden
                data-testid="work-photos-add-input"
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])];
                  // Cleared so choosing the same file again fires the change.
                  e.target.value = "";
                  void staffPhotos.add(files);
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={staffPhotos.busy}
                aria-busy={staffPhotos.busy || undefined}
                onClick={() => fileInput.current?.click()}
              >
                {staffPhotos.busy ? "جاري الرفع…" : "إضافة صور"}
              </Button>
            </>
          ) : undefined
        }
      />
    </div>
  );
}
