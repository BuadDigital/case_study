"use client";

import { ValuedDocumentUploadButton } from "@platform/app-shared/components/ValuedDocumentUploadButton";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { canReviewValuedDocuments } from "../../lib/app-data/po-roles";

/**
 * «مستندات ذات قيمة» — the inspector uploads a document with a value found on site (a valuation
 * of machines or movables…); the case-study specialist reviews it and the appraiser decides its
 * effect.
 *
 * How it works: one line of explanation plus the shared `ValuedDocumentUploadButton`; whether the
 * viewer may also review is read from their access (`canReviewValuedDocuments`).
 *
 * Edge cases: shared 2026-11-04 by the desktop wizard (step 3) and the phone body (step 3) —
 * the phone had no way to upload one. The host card decides when it shows (editable only).
 */
export function InspectorValuedDocumentsField({
  poNumber,
  propertyId,
}: {
  poNumber: string;
  propertyId: string;
}) {
  const { access } = useAppAccess();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="m-0 min-w-0 flex-1 basis-64 text-[11.5px] leading-relaxed text-text-3">
        مستند يحمل قيمة وجدته في الموقع (مثل تقييم للآلات أو المنقولات) — يراجعه أخصائي
        دراسة الحالة ويقرر المقيّم أثره.
      </p>
      <ValuedDocumentUploadButton
        poNumber={poNumber}
        propertyId={propertyId}
        canReview={canReviewValuedDocuments(access)}
      />
    </div>
  );
}
