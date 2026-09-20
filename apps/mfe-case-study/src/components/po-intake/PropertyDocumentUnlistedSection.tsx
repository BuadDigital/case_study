"use client";

/**
 * Documents uploaded outside the defined list: the uploader's name and reason, and the
 * action — classify onto a defined type (specialist / supervisor).
 */

import { Button } from "@platform/ui-kit";
import type { PropertyDetailDocumentEntry } from "@platform/app-shared/app-data/property-detail-document-types";
import { ChecklistSectionTitle, DocumentFileLine } from "./PropertyDocumentChecklistParts";

function UnlistedDocumentCard({
  entry,
  canUpload,
  busy,
  onClassify,
  onDelete,
}: {
  entry: PropertyDetailDocumentEntry;
  canUpload: boolean;
  busy: boolean;
  onClassify: (entry: PropertyDetailDocumentEntry) => void;
  onDelete: (attachmentId: string) => void;
}) {
  const info = entry.unlisted;
  const actionable = Boolean(entry.attachmentId);

  return (
    <div className="rounded border border-border bg-surface-2 px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-[12.5px] font-semibold text-text">
            {info?.customLabel || entry.name}
          </p>
          {info?.customReason ? (
            <p className="m-0 mt-0.5 text-[11px] leading-relaxed text-text-2">
              السبب: {info.customReason}
            </p>
          ) : null}
        </div>
      </div>
      <DocumentFileLine
        doc={entry}
        busy={busy}
        onDelete={
          canUpload && entry.governed && entry.attachmentId
            ? () => onDelete(entry.attachmentId!)
            : undefined
        }
      />
      {actionable && canUpload ? (
        <div className="mt-2 flex flex-wrap justify-end gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onClassify(entry)}
          >
            تصنيف ضمن نوع معرّف
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function UnlistedDocumentsSection({
  entries,
  ...actions
}: {
  entries: PropertyDetailDocumentEntry[];
  canUpload: boolean;
  busy: boolean;
  onClassify: (entry: PropertyDetailDocumentEntry) => void;
  onDelete: (attachmentId: string) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <section className="mb-3.5">
      <ChecklistSectionTitle
        title="مستندات غير معرّفة"
        hint={`${entries.length} مستند`}
      />
      <div className="grid gap-2">
        {entries.map((entry) => (
          <UnlistedDocumentCard key={entry.id} entry={entry} {...actions} />
        ))}
      </div>
    </section>
  );
}
