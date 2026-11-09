"use client";

import { useEffect, useState } from "react";
import {
  getCachedPropertyDocMatching,
  primePropertyDocMetadata,
  subscribeAssignmentDocCache,
  type PropertyDocKind,
} from "../../lib/app-data/assignment-doc-attachments";

/**
 * A property document's display name: the name its uploader gave it (an unlisted document's
 * «اسم المستند»), else its file name — for the closed file stack's «آخرها» line (Omar 2026-11-09).
 *
 * How it works: reads the shared document cache and re-reads on every cache change; loads the
 * property's document metadata once (no file download) so the name is there while the stack is closed.
 * Edge cases: an unnamed document, or one whose metadata has not arrived yet, shows the file name.
 */
export function CachedDocName({
  kind,
  poNumber,
  propertyId,
  fileName,
}: {
  kind: PropertyDocKind;
  poNumber: string;
  propertyId: string;
  fileName: string;
}) {
  const [, setTick] = useState(0);
  useEffect(() => subscribeAssignmentDocCache(() => setTick((n) => n + 1)), []);
  useEffect(() => {
    void primePropertyDocMetadata(poNumber, propertyId);
  }, [poNumber, propertyId]);
  const label = getCachedPropertyDocMatching(kind, poNumber, propertyId, fileName)?.customLabel;
  return <>{label || fileName}</>;
}
