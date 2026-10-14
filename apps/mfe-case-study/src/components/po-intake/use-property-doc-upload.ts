"use client";

/**
 * Per-field document upload with the name written only after the server stored the file.
 * A rejected or failed upload leaves the field empty and tells the user why, so a required
 * check can never pass on a name without a file behind it.
 */

import { useCallback, useState } from "react";
import { useToast } from "@platform/ui-kit";

type DocCacheResult = { ok: true; fileName?: string } | { ok: false; error: string };

export function usePropertyDocUpload() {
  const { showToast } = useToast();
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());

  const run = useCallback(
    async (
      key: string,
      file: File,
      task: () => Promise<DocCacheResult>,
      onStored: (storedFileName: string) => void,
      failureMessage: string,
    ) => {
      setPending((s) => new Set(s).add(key));
      try {
        const result = await task();
        if (result.ok) onStored(result.fileName ?? file.name);
        else showToast(result.error, "error");
      } catch {
        showToast(failureMessage, "error");
      } finally {
        setPending((s) => {
          const next = new Set(s);
          next.delete(key);
          return next;
        });
      }
    },
    [showToast],
  );

  const isUploading = useCallback((key: string) => pending.has(key), [pending]);

  return { run, isUploading };
}
