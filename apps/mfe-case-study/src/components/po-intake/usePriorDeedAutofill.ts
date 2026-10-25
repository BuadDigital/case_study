"use client";

/**
 * Prior-deed autofill for the enfath form: once the deed number settles, look
 * for an earlier registration of the same deed, clone its attachments onto
 * this property and replace the draft — once per deed identity.
 */
import { useEffect, useRef, useState } from "react";
import { useLatestRef } from "@platform/app-shared/hooks/use-latest-ref";
import { useToast } from "@platform/ui-kit";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import { clonePropertyDocumentsFromPrior } from "../../lib/app-data/assignment-doc-attachments";
import { buildPropertyFromPriorDeed } from "../../lib/app-data/po-intake-model";
import { findPriorDeedFull } from "../../lib/app-data/po-intake-reads";
import {
  fallbackPatchEntries,
  isPriorHitExcluded,
  mergeClonedDocumentNames,
  priorApplyKey,
  type PoPropertyPatch,
} from "./po-property-deed-form-state";

const PRIOR_LOOKUP_DEBOUNCE_MS = 280;

export function usePriorDeedAutofill({
  property,
  attachPo,
  priorExcludePo,
  priorExcludePropertyId,
  onPatch,
  onReplaceProperty,
}: {
  property: PoPropertyIntake;
  attachPo: string;
  priorExcludePo: string | undefined;
  priorExcludePropertyId: string | undefined;
  onPatch: PoPropertyPatch;
  onReplaceProperty?: (next: PoPropertyIntake) => void;
}): { priorPo: string | null; priorFilled: boolean } {
  const { showToast } = useToast();
  const [priorPo, setPriorPo] = useState<string | null>(null);
  const [priorFilled, setPriorFilled] = useState(false);
  /** One full auto-fill per propertyId + deed + prior PO (don't fight user edits). */
  const appliedPriorKeyRef = useRef<string | null>(null);
  const propertyRef = useLatestRef(property);

  // A cleared deed matches nothing — reset during render, before the effect would run.
  const deedNumber = property.deedNumber.trim();
  const [lookupDeed, setLookupDeed] = useState(deedNumber);
  if (lookupDeed !== deedNumber) {
    setLookupDeed(deedNumber);
    if (!deedNumber) {
      setPriorPo(null);
      setPriorFilled(false);
    }
  }

  useEffect(() => {
    const deed = property.deedNumber.trim();
    // Any non-empty deed can match a prior PO (length is not fixed).
    if (!deed) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void findPriorDeedFull(deed, priorExcludePo, priorExcludePropertyId)
        .then(async (hit) => {
          if (cancelled) return;
          const hitPo = hit?.poNumber?.trim() || null;
          if (isPriorHitExcluded(hitPo, priorExcludePo)) {
            setPriorPo(null);
            setPriorFilled(false);
            return;
          }
          setPriorPo(hitPo);
          if (!hit || !hitPo) {
            setPriorFilled(false);
            return;
          }

          const applyKey = priorApplyKey(property.id, deed, hitPo);
          if (appliedPriorKeyRef.current === applyKey) {
            setPriorFilled(true);
            return;
          }

          let next = buildPropertyFromPriorDeed(propertyRef.current, hit);

          // Clone PDF/image bytes onto this property (independent copies of prior attachments).
          const sourcePropId = hit.propertyId?.trim() ?? "";
          if (attachPo && property.id && sourcePropId && hitPo) {
            try {
              const cloned = await clonePropertyDocumentsFromPrior(
                hitPo,
                sourcePropId,
                attachPo,
                property.id,
              );
              if (cancelled) return;
              next = mergeClonedDocumentNames(next, cloned);
            } catch {
              /* keep file-name hints from prior DTO even if byte clone fails */
            }
          }
          if (cancelled) return;

          appliedPriorKeyRef.current = applyKey;
          if (onReplaceProperty) {
            onReplaceProperty(next);
          } else {
            for (const [key, value] of fallbackPatchEntries(next)) {
              onPatch(key, value as never);
            }
          }
          setPriorFilled(true);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          showToast(
            err instanceof Error ? err.message : "تعذّر التحقق من الصك السابق",
            "error",
          );
          setPriorPo(null);
          setPriorFilled(false);
        });
    }, PRIOR_LOOKUP_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Autofill once per deed identity — not on every field change after user edits.
  }, [property.deedNumber, property.id, priorExcludePo, priorExcludePropertyId, attachPo, onPatch, onReplaceProperty, showToast, propertyRef]);

  return { priorPo, priorFilled };
}
