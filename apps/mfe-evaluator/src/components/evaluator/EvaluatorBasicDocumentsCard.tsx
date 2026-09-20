"use client";

import { useMemo } from "react";
import { opsEmptyHint } from "@platform/ui-kit";
import {
  formatPropertyTypeLine,
  type PoPropertyIntake,
} from "@platform/app-shared/app-data/po-intake-data";
import { usePropertyDetailDocuments } from "../../lib/case-study-bridge";
import { ValCard } from "./EvaluatorHtmlPrimitives";
import { TransactionDocumentRow } from "./EvaluatorPropertyTab";

/**
 * «البيانات الأساسية» opens with what the appraiser reads first: the property type and the
 * transaction documents. Inspection photos are left out — they have their own strip further down.
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
  const typeLine = formatPropertyTypeLine(property);

  return (
    <ValCard title="الوثائق ونوع العقار">
      <div className="mb-3">
        <div className="mb-[3px] text-[10.5px] text-text-3">نوع العقار</div>
        <p className="m-0 text-[13px] font-bold text-heading">
          {typeLine || "—"}
        </p>
      </div>
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
