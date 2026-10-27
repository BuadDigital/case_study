// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • B    New option { debounce: false }: commit on Enter / Tab / blur only, so a rationale is not
//         validated and saved while the appraiser is still typing. The commit may also return a boolean.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent } from "react";
import { COMMIT_MS, commitKeys } from "./AdjustmentsMatrixCells.styles";

/**
 * The draft every editable matrix cell keeps for itself: typing commits after `COMMIT_MS`,
 * Enter / Tab / blur commit now, Escape drops the change, and unmounting flushes what is
 * pending. An unchanged value (or no `commit`) just clears the draft; a commit that returns
 * false keeps it (save failed). `debounce: false` commits on Enter / Tab / blur only — a text
 * field (a rationale) is not validated and saved while the appraiser is still typing.
 */
export function useMatrixCellDraft(
  committed: string,
  commit: ((raw: string) => Promise<boolean> | boolean | void) | undefined,
  { debounce = true }: { debounce?: boolean } = {},
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
    if (debounce) timer.current = setTimeout(flush, COMMIT_MS);
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
