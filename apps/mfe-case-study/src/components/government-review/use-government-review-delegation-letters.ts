"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { InternalDelegationLetter } from "../../lib/prototype/internal-delegation-letters";
import {
  hydrateInternalDelegationLetters,
  loadInternalDelegationLetters,
  syncInternalDelegationLetters,
} from "../../lib/prototype/internal-delegation-letters";
import type { PoIntakeRecord } from "../../lib/prototype/po-intake-data";

export function useGovernmentReviewDelegationLetters(
  record: PoIntakeRecord | undefined,
): {
  letters: InternalDelegationLetter[];
  refreshLetters: () => void;
} {
  const [letterVersion, bumpLetters] = useState(0);
  const refreshLetters = useCallback(() => bumpLetters((n) => n + 1), []);

  useEffect(() => {
    if (!record) return;
    void hydrateInternalDelegationLetters(record.poNumber)
      .then(() => {
        syncInternalDelegationLetters(record);
        refreshLetters();
      })
      .catch((err: unknown) => {
        console.warn("Delegation letters hydrate failed:", err);
      });
  }, [record, refreshLetters]);

  const letters = useMemo(
    () => (record ? loadInternalDelegationLetters(record.poNumber) : []),
    [record, letterVersion],
  );

  return { letters, refreshLetters };
}
