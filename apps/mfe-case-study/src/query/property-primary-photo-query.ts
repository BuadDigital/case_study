"use client";

/**
 * The basic tab's primary photo without the documents fan-out.
 *
 * `usePropertyDetailDocuments` is gated on the media tabs (fanout doc,
 * 2026-09-04), but the overview still shows one photo on a cold load. This
 * hook spends at most three requests for it: the property's `for-property`
 * metadata list, the inspector workspace read when an inspection task exists,
 * and exactly one blob — the entry `pickPrimaryPropertyDetailPhoto` would pick
 * once everything is hydrated. Both the metadata and the blob land in the same
 * caches the full prefetch reads, so opening a media tab later reuses them.
 */
import { useEffect, useRef, useState } from "react";
import {
  hydrateCachedPropertyDocPreview,
  primePropertyDocMetadata,
  subscribeAssignmentDocCache,
} from "../lib/app-data/assignment-doc-attachments";
import { prefetchInspectorPhoto } from "../lib/app-data/inspector-photo-upload";
import {
  FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
  loadInspectorWorkspace,
} from "../lib/app-data/inspector-workspace-model";
import { fetchInspectorWorkspace } from "../lib/app-data/inspector-workspace-reads";
import type { PoPropertyIntake } from "../lib/app-data/po-intake-data";
import {
  collectPrimaryPhotoCandidates,
  pickPrimaryPropertyDetailPhoto,
  type PropertyDetailDocumentEntry,
} from "../lib/app-data/property-detail-documents";

export function usePropertyPrimaryPhoto(input: {
  property: PoPropertyIntake;
  showDecree: boolean;
  poNumber: string;
  inspectionTaskId: string | null;
  enabled?: boolean;
}): PropertyDetailDocumentEntry | null {
  const { property, showDecree, poNumber, inspectionTaskId, enabled = true } =
    input;

  const pick = () =>
    pickPrimaryPropertyDetailPhoto(
      collectPrimaryPhotoCandidates({
        property,
        showDecree,
        poNumber,
        inspectionTaskId,
      }),
    );
  // Live ref so the effect keys on primary keys, not on the property object's identity.
  const pickRef = useRef(pick);
  pickRef.current = pick;

  const [photo, setPhoto] = useState<PropertyDetailDocumentEntry | null>(() =>
    enabled ? pick() : null,
  );

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const refresh = () => {
      if (!cancelled) setPhoto(pickRef.current());
    };

    void (async () => {
      await Promise.all([
        primePropertyDocMetadata(poNumber, property.id),
        inspectionTaskId && !loadInspectorWorkspace(inspectionTaskId)
          ? fetchInspectorWorkspace(inspectionTaskId)
          : Promise.resolve(null),
      ]);
      if (cancelled) return;

      const candidate = pickRef.current();
      if (candidate?.dataUrl) {
        refresh();
        return;
      }
      if (candidate?.inspectionPhoto) {
        const { taskId, photoRef, attachment } = candidate.inspectionPhoto;
        await prefetchInspectorPhoto(taskId, photoRef, attachment);
      } else if (candidate?.attachmentId) {
        await hydrateCachedPropertyDocPreview(
          poNumber,
          property.id,
          candidate.attachmentId,
        );
      }
      refresh();
    })();

    const unsubDocs = subscribeAssignmentDocCache(refresh);
    window.addEventListener(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      unsubDocs();
      window.removeEventListener(
        FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
        refresh,
      );
    };
  }, [
    enabled,
    // Property key, not identity — see usePropertyDetailDocuments.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    property.id,
    showDecree,
    poNumber,
    inspectionTaskId,
  ]);

  return photo;
}
