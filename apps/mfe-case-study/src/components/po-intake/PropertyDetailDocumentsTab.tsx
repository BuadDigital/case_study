"use client";

/**
 * Documents tab of `PoPropertyDetailTabs` — the governed document checklist: every defined
 * document type that applies to the property, what is on file for each, missing required
 * documents, unlisted documents and inspection photos.
 * Behaviour lives in `usePropertyDocumentsWorkflow`; the model in `property-document-checklist`.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { fetchPropertyOutputVersions } from "../../lib/app-data/governed-property-documents-reads";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import type {
  PropertyDetailDocumentEntry,
  PropertyDetailDocumentSection,
} from "../../lib/app-data/property-detail-documents";
import { InfoBox } from "./PropertyDetailFields";
import {
  ChecklistRowsList,
  DocumentFileLine,
} from "./PropertyDocumentChecklistParts";
import { seesPropertyOutputReports } from "./PropertyOutputReportButtons";
import { UnlistedDocumentsSection } from "./PropertyDocumentUnlistedSection";
import { ValuedDocumentsSection } from "./PropertyDocumentValuedSection";
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

      <ChecklistRowsList
        groups={checklist.groups}
        canUpload={workflow.canUpload}
        busy={workflow.busy}
        onUpload={(typeKey) => setDialog({ mode: "upload", typeKey })}
        onDelete={(attachmentId) => void workflow.remove(attachmentId)}
      />

      <UnlistedDocumentsSection
        entries={checklist.unlisted}
        canUpload={workflow.canUpload}
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
        onDelete={(attachmentId) => void workflow.remove(attachmentId)}
      />

      <ValuedDocumentsSection
        entries={checklist.valued}
        canReview={workflow.canReviewValued}
        busy={workflow.busy}
        onReview={workflow.reviewValued}
        onDelete={(attachmentId) => void workflow.remove(attachmentId)}
      />

      <OutputVersionsSection propertyId={property.id} />

      <PropertyDocumentUploadDialog
        state={dialog}
        options={workflow.uploadOptions}
        busy={workflow.busy}
        onClose={() => setDialog(null)}
        onUpload={workflow.upload}
        onClassify={workflow.reclassify}
      />
    </>
  );
}

/**
 * «مخرجات المعاملة» (Omar 2026-11-18): every kept version of the case-study report (as delivered to Enfaz),
 * the final valuation report and the deposit certificate — read only, newest first; an older version says
 * «حلّت محلها نسخة أحدث». The header icons open the newest only.
 * Edge cases: the external parties do not see it (as the header icons); nothing kept → nothing shown.
 */
function OutputVersionsSection({ propertyId }: { propertyId: string }) {
  const { role } = useAppAccess();
  const visible = seesPropertyOutputReports(role);
  const { data = [] } = useQuery({
    queryKey: ["property-output-versions", propertyId],
    queryFn: () => fetchPropertyOutputVersions(propertyId),
    enabled: visible && Boolean(propertyId),
    staleTime: 60_000,
  });
  if (!visible || data.length === 0) return null;
  return (
    <section className="mt-4" data-testid="output-versions">
      <p className="m-0 mb-2 text-[12.5px] font-bold text-heading">مخرجات المعاملة</p>
      <div className="flex flex-col gap-1.5">
        {data.map((entry) => (
          <div key={entry.id} className={entry.superseded ? "opacity-75" : undefined}>
            <DocumentFileLine doc={entry} />
            {entry.superseded ? (
              <p className="m-0 mt-0.5 text-[10.5px] text-text-3">حلّت محلها نسخة أحدث</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
