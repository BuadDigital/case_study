"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DelegationAgentInfo } from "../../lib/prototype/internal-delegation-letters";
import {
  hydrateInternalDelegationLetters,
  lettersForFocusPo,
  loadInternalDelegationLetters,
  syncInternalDelegationLetters,
} from "../../lib/prototype/internal-delegation-letters";
import type { PoIntakeRecord } from "../../lib/prototype/po-intake-data";

/** بصمة مستقرة لتجنّب إعادة المزامنة عند تغيّر مرجع المصفوفة فقط. */
function recordsFingerprint(records: PoIntakeRecord[]): string {
  return records
    .map((r) => {
      const props = r.properties
        .map(
          (p) =>
            `${p.id}:${p.court.trim()}:${p.circuit.trim() || "—"}:${p.deedNumber.trim()}`,
        )
        .join(",");
      return `${r.poNumber.trim()}[${props}]`;
    })
    .sort()
    .join("|");
}

export function useGovernmentReviewDelegationLetters(
  records: PoIntakeRecord[],
  scopeKey: string,
  focusPoNumber?: string | null,
): {
  letters: ReturnType<typeof loadInternalDelegationLetters>;
  refreshLetters: () => void;
} {
  const [letterVersion, bumpLetters] = useState(0);
  const refreshLetters = useCallback(() => bumpLetters((n) => n + 1), []);
  const key = scopeKey.trim();
  const fingerprint = useMemo(() => recordsFingerprint(records), [records]);

  useEffect(() => {
    if (!key || records.length === 0) return;
    let cancelled = false;
    void hydrateInternalDelegationLetters(key)
      .then(() => {
        if (cancelled) return;
        syncInternalDelegationLetters(records, key);
        refreshLetters();
      })
      .catch((err: unknown) => {
        console.warn("Delegation letters hydrate failed:", err);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fingerprint يمثل محتوى records
  }, [key, fingerprint, refreshLetters]);

  const letters = useMemo(() => {
    void letterVersion;
    if (!key) return [];
    return lettersForFocusPo(key, focusPoNumber);
  }, [key, focusPoNumber, letterVersion]);

  return { letters, refreshLetters };
}

export type { DelegationAgentInfo };
