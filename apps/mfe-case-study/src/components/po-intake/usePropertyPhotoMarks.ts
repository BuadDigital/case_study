"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { savePropertyPhotoMarks } from "@platform/api-client";
import { canManageWorkOrders } from "@platform/app-shared/app-data/runtime-access";
import { useLatestRef } from "@platform/app-shared/hooks/use-latest-ref";
import { createKeyedWriteQueue } from "@platform/app-shared/lib/keyed-write-queue";
import { useToast } from "@platform/ui-kit";
import {
  EMPTY_PROPERTY_PHOTO_MARKS,
  REPORT_PHOTO_LIMIT,
  togglePropertyPhotoMark,
  type PropertyPhotoMark,
  type PropertyPhotoMarks,
} from "@platform/app-shared/app-data/property-detail-document-types";
import { loadCaseStudyReportDraftOrThrow } from "../../lib/app-data/case-study-report-reads";
import {
  notifyWorkOrderPropertyChanged,
  requireWorkOrdersApiConfig,
  resolveApiError,
} from "../../lib/work-orders-api-config";

/** Every press sends the whole set, so the saves of one property run one after another. */
const markWrites = createKeyedWriteQueue();

/**
 * The specialist's marks on the property's photos, for the photos tab.
 *
 * How it works: a press shows at once, then saves; the last save of a burst tells the property's
 * readers (the main photo, the map) to read again.
 * Edge cases: a refused or failed save returns to what the server holds and says why. Editing is
 * open to work-order managers until the study report is issued; the server refuses after that too.
 * The report's limit counts only photos still on the property, so a marked photo that was retaken
 * cannot use up a slot nobody can clear.
 */
export function usePropertyPhotoMarks({
  poNumber,
  propertyId,
  stored,
  studyTaskId,
  enabled,
}: {
  poNumber: string;
  propertyId: string;
  stored: PropertyPhotoMarks | undefined;
  studyTaskId: string | null;
  /** The photos tab was opened; the study report is read only then. */
  enabled: boolean;
}) {
  const { showToast } = useToast();
  const canManage = canManageWorkOrders();
  const [marks, setMarks] = useState(stored ?? EMPTY_PROPERTY_PHOTO_MARKS);
  const [saving, setSaving] = useState(0);
  const [seenStored, setSeenStored] = useState(stored);
  if (seenStored !== stored && saving === 0) {
    setSeenStored(stored);
    setMarks(stored ?? EMPTY_PROPERTY_PHOTO_MARKS);
  }
  const marksRef = useLatestRef(marks);

  const study = useQuery({
    queryKey: ["property-photo-marks", "study-report", studyTaskId],
    queryFn: () => loadCaseStudyReportDraftOrThrow(studyTaskId!),
    enabled: enabled && canManage && Boolean(studyTaskId),
    staleTime: 30_000,
    retry: false,
  });

  const toggle = (id: string, mark: PropertyPhotoMark, liveIds: readonly string[]) => {
    const current = {
      ...marksRef.current,
      report: marksRef.current.report.filter((item) => liveIds.includes(item)),
    };
    if (
      mark === "report" &&
      !current.report.includes(id) &&
      current.report.length >= REPORT_PHOTO_LIMIT
    ) {
      showToast(`التقرير يطبع ${REPORT_PHOTO_LIMIT} صورة كحد أقصى`, "error");
      return;
    }

    const next = togglePropertyPhotoMark(current, id, mark);
    marksRef.current = next;
    setMarks(next);
    setSaving((count) => count + 1);
    void markWrites
      .enqueue(propertyId, () =>
        savePropertyPhotoMarks(requireWorkOrdersApiConfig(), poNumber, propertyId, next),
      )
      .then((result) => {
        setSaving((count) => count - 1);
        if (result.ok) {
          void markWrites.awaitIdle(propertyId).then(() => notifyWorkOrderPropertyChanged(poNumber));
          return;
        }
        marksRef.current = stored ?? EMPTY_PROPERTY_PHOTO_MARKS;
        setMarks(marksRef.current);
        showToast(resolveApiError(result.kind, result.errors, "تعذّر حفظ تمييز الصورة"), "error");
      });
  };

  return {
    marks,
    canEdit: canManage && !study.isLoading && study.data?.status !== "issued",
    toggle,
  };
}
