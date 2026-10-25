"use client";

import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent } from "react";
import { COMMIT_MS, commitKeys } from "./AdjustmentsMatrixCells.styles";

/**
 * The draft every editable matrix cell keeps for itself: typing commits after `COMMIT_MS`,
 * Enter / Tab / blur commit now, Escape drops the change, and unmounting flushes what is
 * pending. An unchanged value (or no `commit`) just clears the draft; a commit that returns
 * false keeps it (save failed).
 */
export function useMatrixCellDraft(
  committed: string,
  commit: ((raw: string) => Promise<boolean> | void) | undefined,
) {
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);

  function clearTimer() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function flush() {
    const raw = pending.current;
    pending.current = null;
    clearTimer();
    if (raw == null) return;
    if (raw === committed || !commit) {
      setDraft(null);
      return;
    }
    void Promise.resolve(commit(raw)).then((ok) => {
      if (ok !== false) setDraft((d) => (d === raw ? null : d));
    });
  }

  const flushOnUnmount = useEffectEvent(flush);
  useEffect(() => () => flushOnUnmount(), []);

  function change(raw: string) {
    setDraft(raw);
    pending.current = raw;
    clearTimer();
    timer.current = setTimeout(flush, COMMIT_MS);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    commitKeys(e, flush, () => {
      pending.current = null;
      clearTimer();
      setDraft(null);
    });
  }

  return { text: draft ?? committed, change, flush, onKeyDown };
}
