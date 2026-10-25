"use client";

import { useEffect, useState } from "react";
import type { InspectorPhotoAttachment } from "../../lib/app-data/inspector-workspace-data";
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
  photo: InspectorPhotoAttachment | null | undefined,
  active = true,
): string | undefined {
  const [dataUrl, setDataUrl] = useState<string | undefined>(() =>
    taskId !== undefined && photoRef
      ? getInspectorPhotoDataUrl(taskId, photoRef)
      : undefined,
  );

  // New inputs: clear, or take the cached copy, during render — only a fetch waits for the effect.
  const [shownFor, setShownFor] = useState<
    readonly [boolean, string | undefined, string | undefined, typeof photo] | null
  >(null);
  if (
    !shownFor ||
    shownFor[0] !== active ||
    shownFor[1] !== taskId ||
    shownFor[2] !== photoRef ||
    shownFor[3] !== photo
  ) {
    setShownFor([active, taskId, photoRef, photo]);
    if (!active || taskId === undefined || !photoRef || !photo) {
      setDataUrl(undefined);
    } else {
      const cached = getInspectorPhotoDataUrl(taskId, photoRef);
      if (cached) setDataUrl(cached);
    }
  }

  useEffect(() => {
    if (!active || taskId === undefined || !photoRef || !photo) return;
    if (getInspectorPhotoDataUrl(taskId, photoRef)) return;
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
