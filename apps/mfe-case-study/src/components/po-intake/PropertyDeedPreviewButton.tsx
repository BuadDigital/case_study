"use client";

import { useMemo } from "react";
import { cn, OpsIcon } from "@platform/ui-kit";
import {
  deedDocumentEntry,
  openPropertyDetailDocumentPreview,
} from "../../lib/app-data/property-detail-documents";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import { usePropertyDetailDocuments } from "../../query/property-detail-documents-query";

/** A page with lines — the deed's document. */
const DOCUMENT_ICON_PATH =
  "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8";

/**
 * The document icon beside the property's badges (Omar 2026-11-11): pressing it opens the deed in
 * a window on the same page, to read without leaving the work at hand.
 *
 * How it works: the deed is the ownership document uploaded at intake — else the real-estate
 * registry extract, else the deed image from the bourse (`deedDocumentEntry`); it opens in the
 * app's document window (the same one the documents tab uses), an image or a PDF.
 * Edge cases: no deed file on the property → the icon is greyed out and says so; the file is
 * named but not fetched yet (or the viewer may not read it) → greyed out until it arrives.
 */
export function PropertyDeedPreviewButton({
  poNumber,
  property,
  compact = false,
}: {
  poNumber: string;
  property: PoPropertyIntake;
  /** The collapsed (sticky) header: a smaller button. */
  compact?: boolean;
}) {
  // The intake documents only — no party task is read for the deed.
  const sections = usePropertyDetailDocuments({
    property,
    showDecree: false,
    poNumber,
    surveyTaskId: null,
    appraisalTaskId: null,
    inspectionTaskId: null,
  });
  const deed = useMemo(() => deedDocumentEntry(sections), [sections]);
  const ready = Boolean(deed && (deed.dataUrl || deed.attachmentId));
  const label = !deed ? "لم تُرفق صورة الصك" : ready ? "مطالعة الصك" : "جاري تحميل الصك…";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={!ready}
      data-testid="hero-deed-preview"
      onClick={() => deed && openPropertyDetailDocumentPreview(deed)}
      className={cn(
        "grid shrink-0 place-items-center rounded-md border border-border bg-surface p-0 text-heading transition-colors",
        compact ? "size-6" : "size-[30px]",
        ready ? "cursor-pointer hover:bg-row-hover" : "cursor-not-allowed text-text-3 opacity-60",
      )}
    >
      <OpsIcon path={DOCUMENT_ICON_PATH} size={compact ? 13 : 16} />
    </button>
  );
}
