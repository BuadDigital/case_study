"use client";

import { useQuery } from "@tanstack/react-query";
import { useInspectorPhotoDataUrl } from "../components/field-inspection/useInspectorPhotoDataUrl";
import { fetchInspectorWorkspaceReadOnly } from "../lib/app-data/inspector-workspace-reads";
import {
  pickInspectorPrimaryPhoto,
  primaryPhotoCandidatesFromSubmission,
  type PropertyDetailDocumentEntry,
} from "../lib/app-data/property-detail-documents";
import type { PropertyPhotoMarks } from "@platform/app-shared/app-data/property-detail-document-types";

const STALE_MS = 60_000;

/**
 * The property's main photo from its inspection task alone, for a screen that
 * has no `PoPropertyIntake` and is not the task's owner (the property map).
 *
 * How it works: one read-only package read picks the photo with the same rule as
 * the basic tab, then only that photo's file is fetched.
 *
 * Edge cases: the read-only path never sends the inspector's coordinate PUT or
 * writes the inspector's cache. A viewer who may not read the task gets no photo,
 * without a retry. `url` stays empty while the file loads or if it fails, so
 * `photo` without `url` still opens the preview, which fetches on demand.
 */
export function useInspectionPrimaryPhoto(
  inspectionTaskId: string | null,
  photoMarks?: PropertyPhotoMarks,
): {
  photo: PropertyDetailDocumentEntry | null;
  url: string | undefined;
  loading: boolean;
} {
  const query = useQuery({
    queryKey: ["property-map", "primary-photo", inspectionTaskId, photoMarks?.main ?? ""],
    queryFn: async () => {
      const draft = await fetchInspectorWorkspaceReadOnly(inspectionTaskId!);
      if (!draft) return null;
      return pickInspectorPrimaryPhoto(primaryPhotoCandidatesFromSubmission(draft), photoMarks);
    },
    enabled: Boolean(inspectionTaskId),
    staleTime: STALE_MS,
    retry: false,
  });

  const photo = query.data ?? null;
  const handle = photo?.inspectionPhoto;
  const fetchedUrl = useInspectorPhotoDataUrl(
    handle?.taskId,
    handle?.photoRef,
    handle?.attachment.attachmentId ? handle.attachment : null,
    !photo?.dataUrl,
  );

  return { photo, url: photo?.dataUrl || fetchedUrl, loading: query.isLoading };
}
