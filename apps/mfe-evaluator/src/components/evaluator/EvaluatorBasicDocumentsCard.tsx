"use client";

import { useMemo } from "react";
import { opsEmptyHint } from "@platform/ui-kit";
import type { PoPropertyIntake } from "@platform/app-shared/app-data/po-intake-property-model";
import { usePropertyDetailDocuments } from "../../lib/case-study-bridge";
import { ValCard } from "./EvaluatorHtmlPrimitives";
import { TransactionDocumentRow } from "./EvaluatorPropertyTab";

/**
 * «مستندات المعاملة» — the last block of the appraiser's summary (2026-11-15: it opened the section,
 * with the property type the page's header already names). Inspection photos are left out — they
 * have their own strip above.
 */
export function EvaluatorBasicDocumentsCard({
  property,
  poNumber,
  surveyTaskId,
  inspectionTaskId,
  appraisalTaskId,
}: {
  property: PoPropertyIntake;
  poNumber: string;
  surveyTaskId: string | null;
  inspectionTaskId: string | null;
  appraisalTaskId: string | null;
}) {
  const sections = usePropertyDetailDocuments({
    property,
    showDecree: true,
    poNumber,
    surveyTaskId,
    appraisalTaskId,
    inspectionTaskId,
  });
  const docs = useMemo(
    () =>
      sections
        .flatMap((section) => section.documents)
        .filter(
          (doc) =>
            !doc.inspectionPhoto && doc.documentTypeKey !== "inspection-photo",
        ),
    [sections],
  );

  return (
    <ValCard title="مستندات المعاملة">
      {docs.length === 0 ? (
        <p className={opsEmptyHint}>لا توجد مستندات مرفوعة بعد لهذه المعاملة.</p>
      ) : (
        <div className="grid gap-2">
          {docs.map((doc) => (
            <TransactionDocumentRow key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </ValCard>
  );
}
