"use client";

/**
 * Wizard step 1 card of `InspectorWorkspaceWizard` — the transaction's documents (deed,
 * bourse deed image, delegation letter, decree, registry, survey report…) for the inspector
 * to read on site. Read-only: preview / download only; uploads stay on their own screens.
 */

import type { PropertyDetailDocumentEntry } from "@platform/app-shared/app-data/property-detail-document-types";
import { InlineLoadingSkeleton } from "@platform/ui-kit";
import { DocumentFileLine } from "../po-intake/PropertyDocumentChecklistParts";
import { InsCard } from "../po-intake/PropertyDetailInspectionParts";
import { InspectorCard } from "./FieldInspectionWorkParts";

/** Everything but the inspector's own photos — those live in their own cards. */
export function inspectorReferenceDocuments(
  entries: readonly PropertyDetailDocumentEntry[],
): PropertyDetailDocumentEntry[] {
  return entries.filter(
    (doc) =>
      doc.documentTypeKey !== "inspection-photo" &&
      !doc.inspectionPhoto &&
      !/المعاين/.test(doc.source),
  );
}

export function InspectorTransactionDocumentsCard({
  documents,
  loading = false,
  layout = "desktop",
  hidden = false,
}: {
  documents: PropertyDetailDocumentEntry[];
  loading?: boolean;
  /** `mobile` renders the collapsible phone card used by `FieldInspectionWorkBody`. */
  layout?: "desktop" | "mobile";
  /** Mobile only: belongs to a wizard step that is not the active one. */
  hidden?: boolean;
}) {
  const body = (
    <>
      <p className="m-0 mb-2 text-[11.5px] leading-relaxed text-text-3">
        للاطلاع أثناء المعاينة: الصك وخطاب التكليف وبقية مستندات العقار كما رُفعت في البيانات
        الأولية والبورصة والمكتب الهندسي. التعديل من شاشاتها.
      </p>
      <InspectorTransactionDocumentsList documents={documents} loading={loading} />
    </>
  );
  if (layout === "mobile") {
    return (
      <InspectorCard
        title="مستندات المعاملة"
        icon="ti-files"
        layout="mobile"
        step={1}
        hidden={hidden}
        subtitle={documents.length > 0 ? `${documents.length} مستند` : "لا مستندات بعد"}
      >
        {body}
      </InspectorCard>
    );
  }
  return <InsCard title="مستندات المعاملة">{body}</InsCard>;
}

function InspectorTransactionDocumentsList({
  documents,
  loading,
}: {
  documents: PropertyDetailDocumentEntry[];
  loading: boolean;
}) {
  return (
    <>
      {loading && documents.length === 0 ? (
        <InlineLoadingSkeleton />
      ) : documents.length === 0 ? (
        <p className="m-0 rounded border border-dashed border-border px-3 py-2.5 text-[12px] text-text-3">
          لا توجد مستندات مرفوعة لهذا العقار بعد.
        </p>
      ) : (
        <div className="grid gap-1.5">
          {documents.map((doc) => (
            <DocumentFileLine key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </>
  );
}
