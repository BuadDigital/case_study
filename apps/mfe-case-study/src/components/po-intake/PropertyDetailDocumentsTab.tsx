"use client";

/**
 * Documents tab of `PoPropertyDetailTabs` — the governed document checklist: every defined
 * document type that applies to the property, what is on file for each, missing required
 * documents, unlisted documents under review, inspection photos and valuation outputs.
 * Behaviour lives in `usePropertyDocumentsWorkflow`; the model in `property-document-checklist`.
 */

import { useState } from "react";
import { Button } from "@platform/ui-kit";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import type {
  PropertyDetailDocumentEntry,
  PropertyDetailDocumentSection,
} from "../../lib/app-data/property-detail-documents";
import { InfoBox } from "./PropertyDetailFields";
import {
  ChecklistGroupSection,
  InspectionPhotosSection,
  ValuationOutputsSection,
} from "./PropertyDocumentChecklistParts";
import {
  RejectUnlistedDocumentDialog,
  UnlistedDocumentsSection,
} from "./PropertyDocumentUnlistedSection";
import {
  PropertyDocumentUploadDialog,
  type PropertyDocumentDialogState,
} from "./PropertyDocumentUploadDialog";
import { usePropertyDocumentsWorkflow } from "./usePropertyDocumentsWorkflow";

export function DocumentsTab({
  sections,
  property,
  poNumber,
}: {
  sections: PropertyDetailDocumentSection[];
  property: PoPropertyIntake;
  poNumber: string;
}) {
  const workflow = usePropertyDocumentsWorkflow({ sections, property, poNumber });
  const { checklist } = workflow;
  const [dialog, setDialog] = useState<PropertyDocumentDialogState | null>(null);
  const [rejecting, setRejecting] = useState<PropertyDetailDocumentEntry | null>(null);

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-[12.5px] font-bold text-heading">المستندات المعرّفة للعقار</p>
          <p className="m-0 text-[11px] text-text-3">
            {workflow.propertyType
              ? `حسب نوع العقار: ${workflow.propertyType}`
              : "نوع العقار غير محدد — تظهر كل المستندات"}
          </p>
        </div>
        {workflow.canUpload ? (
          <Button
            type="button"
            size="sm"
            disabled={workflow.busy}
            onClick={() => setDialog({ mode: "upload" })}
          >
            + إضافة مستند
          </Button>
        ) : null}
      </div>

      {checklist.missingRequired.length > 0 ? (
        <div
          role="status"
          className="mb-3.5 rounded-md border border-red/30 bg-danger-bg px-3 py-2 text-[11.5px] text-danger-text"
        >
          مستندات إلزامية لم تُرفع بعد: {checklist.missingRequired.join("، ")}
        </div>
      ) : null}

      {workflow.loadFailed ? (
        <InfoBox icon="!">تعذّر تحميل المستندات المرفوعة من هذا التبويب — حدّث الصفحة.</InfoBox>
      ) : null}

      {checklist.groups.map((group) => (
        <ChecklistGroupSection
          key={group.key}
          group={group}
          canUpload={workflow.canUpload}
          busy={workflow.busy}
          onUpload={(typeKey) => setDialog({ mode: "upload", typeKey })}
          onDelete={(attachmentId) => void workflow.remove(attachmentId)}
        />
      ))}

      <UnlistedDocumentsSection
        entries={checklist.unlisted}
        canUpload={workflow.canUpload}
        canReview={workflow.canReview}
        busy={workflow.busy}
        onClassify={(entry) =>
          setDialog({
            mode: "classify",
            attachmentId: entry.attachmentId!,
            fileName: entry.fileName,
            customLabel: entry.unlisted?.customLabel,
            customReason: entry.unlisted?.customReason,
          })
        }
        onApprove={(entry) => void workflow.approve(entry.attachmentId!)}
        onReject={setRejecting}
        onDelete={(attachmentId) => void workflow.remove(attachmentId)}
      />

      <InspectionPhotosSection photos={checklist.photos} />
      <ValuationOutputsSection rows={checklist.outputs} />

      <p className="m-0 text-[11.5px] leading-relaxed text-text-3">
        كل مستند على العقار يُعرَّف بنوعه من القائمة المعرّفة. التقرير المساحي يُرفع من
        المكتب الهندسي، وصور المعاينة من المعاين، وتقرير التقييم من المقيّم. المستند غير
        المعرّف للحالات النادرة ويخضع لمراجعة مشرف القسم.
      </p>

      <PropertyDocumentUploadDialog
        state={dialog}
        options={workflow.uploadOptions}
        busy={workflow.busy}
        onClose={() => setDialog(null)}
        onUpload={workflow.upload}
        onClassify={workflow.reclassify}
      />
      <RejectUnlistedDocumentDialog
        entry={rejecting}
        busy={workflow.busy}
        onClose={() => setRejecting(null)}
        onConfirm={(note) => {
          const attachmentId = rejecting?.attachmentId;
          if (!attachmentId) return;
          void workflow.reject(attachmentId, note).then((ok) => {
            if (ok) setRejecting(null);
          });
        }}
      />
    </>
  );
}
