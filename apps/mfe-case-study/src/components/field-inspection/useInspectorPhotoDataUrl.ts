"use client";

import { useEffect, useState } from "react";
import type { InspectorSlotPhoto } from "../../lib/app-data/inspector-workspace-data";
import {
  getInspectorPhotoDataUrl,
  prefetchInspectorPhoto,
} from "../../lib/app-data/inspector-photo-upload";

/**
 * Preview data URL of one inspector photo: the cached copy right away, otherwise
 * fetched once. Cleared while `active` is false or there is no task / ref / photo.
 */
export function useInspectorPhotoDataUrl(
  taskId: string | undefined,
  photoRef: string | undefined,
  photo: InspectorSlotPhoto | null | undefined,
  active = true,
): string | undefined {
  const [dataUrl, setDataUrl] = useState<string | undefined>(() =>
    taskId !== undefined && photoRef
      ? getInspectorPhotoDataUrl(taskId, photoRef)
      : undefined,
  );

  useEffect(() => {
    if (!active || taskId === undefined || !photoRef || !photo) {
      setDataUrl(undefined);
      return;
    }
    const cached = getInspectorPhotoDataUrl(taskId, photoRef);
    if (cached) {
      setDataUrl(cached);
      return;
    }
    let cancelled = false;
    void prefetchInspectorPhoto(taskId, photoRef, photo)
      .then((url) => {
        if (!cancelled && url) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [active, taskId, photoRef, photo]);

  return dataUrl;
}
