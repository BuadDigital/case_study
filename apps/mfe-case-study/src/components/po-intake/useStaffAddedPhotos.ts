"use client";

import { useCallback, useState } from "react";
import { useToast } from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import type { InspectorFreePhoto } from "@platform/app-shared/app-data/inspector-workspace-data";
import type { PropertyDetailDocumentEntry } from "@platform/app-shared/app-data/property-detail-document-types";
import { freePhotoRef } from "../field-inspection/inspector-wizard-state";
import { allocateInspectorPhotoId } from "../../lib/app-data/inspector-photo-id";
import { uploadInspectorPhotoFromFile } from "../../lib/app-data/inspector-photo-upload";
import { updateInspectorWorkspace } from "../../lib/app-data/inspector-workspace-commands";
import { loadInspectorWorkspaceSnapshot } from "../../lib/app-data/inspector-workspace-reads";
import { canAcceptPartyWork } from "../../lib/app-data/po-roles";
import {
  staffAddedPhoto,
  staffPhotoAddRefusal,
  withoutStaffPhoto,
} from "../../lib/app-data/staff-added-photos";

/**
 * Adding and removing the case staff's own photos on a sent inspection — the work page's «إضافة صور»
 * (Omar 2026-11-12).
 *
 * How it works: each file is processed and uploaded like an inspection photo but without the field
 * stamp, then all of them are appended to the inspection's free photos in ONE save (the server's
 * correction of a sent inspection, open to every case specialist — so one timeline row per batch).
 * The inspection's cache change refreshes the photo lists by itself. Removing takes the photo out of
 * the free photos; the boards drop it on their own since they keep live photos only.
 * Edge cases: no inspection, or one still with the inspector (draft / returned) → refused with the
 * reason, nothing uploaded; a file that fails is named in the toast and the rest are still saved; a
 * failed save leaves the files uploaded but unlisted, and says so; only the staff's own photos can
 * be removed. `enabled` is the host's window (the boards' own: until the study report is issued).
 */
export function useStaffAddedPhotos({
  inspectionTaskId,
  enabled,
}: {
  inspectionTaskId: string | null;
  enabled: boolean;
}) {
  const { showToast } = useToast();
  const { access, viewerDisplayName } = useAppAccess();
  const [busy, setBusy] = useState(false);
  const allowed = enabled && Boolean(inspectionTaskId) && canAcceptPartyWork(access);

  const add = useCallback(
    async (files: File[]) => {
      if (!allowed || !inspectionTaskId || files.length === 0) return;
      setBusy(true);
      try {
        const draft = await loadInspectorWorkspaceSnapshot(inspectionTaskId);
        const refusal = staffPhotoAddRefusal(draft);
        if (refusal || !draft) {
          showToast(refusal ?? "تعذّر قراءة المعاينة", "error");
          return;
        }
        const added: InspectorFreePhoto[] = [];
        let failure: string | null = null;
        for (const file of files) {
          const id = allocateInspectorPhotoId(draft);
          const result = await uploadInspectorPhotoFromFile(inspectionTaskId, freePhotoRef(id), file, {
            noStamp: true,
          });
          if (!result.ok) {
            failure = result.error;
            continue;
          }
          added.push(
            staffAddedPhoto({
              id,
              attachment: result.attachment,
              addedByName: viewerDisplayName,
              nowIso: new Date().toISOString(),
            }),
          );
        }
        if (added.length > 0) {
          // Against the inspection as it is when the uploads end, so nothing saved meanwhile is lost.
          await updateInspectorWorkspace(
            inspectionTaskId,
            (current) => ({ freePhotos: [...current.freePhotos, ...added] }),
            { allowWhenSubmitted: true, immediate: true },
          );
          showToast(
            added.length === 1 ? "أُضيفت الصورة — اخترها للتقرير من اللوحة" : `أُضيفت ${added.length} صور — اخترها للتقرير من اللوحة`,
            "success",
          );
        }
        if (failure) showToast(failure, "error");
      } catch (err) {
        showToast(err instanceof Error && err.message ? err.message : "تعذّر حفظ الصور المضافة", "error");
      } finally {
        setBusy(false);
      }
    },
    [allowed, inspectionTaskId, showToast, viewerDisplayName],
  );

  const remove = useCallback(
    async (photo: PropertyDetailDocumentEntry) => {
      const id = photo.addedByStaff?.freePhotoId;
      if (!allowed || !inspectionTaskId || id == null) return;
      setBusy(true);
      try {
        await updateInspectorWorkspace(
          inspectionTaskId,
          (current) => ({ freePhotos: withoutStaffPhoto(current.freePhotos, id) }),
          { allowWhenSubmitted: true, immediate: true },
        );
        showToast("حُذفت الصورة", "success");
      } catch (err) {
        showToast(err instanceof Error && err.message ? err.message : "تعذّر حذف الصورة", "error");
      } finally {
        setBusy(false);
      }
    },
    [allowed, inspectionTaskId, showToast],
  );

  return { allowed, busy, add, remove };
}
