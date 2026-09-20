"use client";

/** Presentational rows of the governed documents checklist — no queries, no commands. */

import type { ReactNode } from "react";
import { Button, cn } from "@platform/ui-kit";
import type { PropertyDetailDocumentEntry } from "@platform/app-shared/app-data/property-detail-document-types";
import {
  downloadPropertyDetailDocument,
  openPropertyDetailDocumentPreview,
} from "../../lib/app-data/property-detail-documents";
import type {
  PropertyDocumentChecklistGroup,
  PropertyDocumentChecklistRow,
} from "../../lib/app-data/property-document-checklist";
import { ltrValueClass } from "./PropertyDetailFields";
import { docKindLabel, isGeneratedFileName } from "./po-property-detail-tabs-state";

export function ChecklistSectionTitle({
  title,
  hint,
}: {
  title: string;
  hint?: ReactNode;
}) {
  return (
    <div className="mb-[7px] flex items-center gap-2">
      <span className="text-xs font-bold text-heading">{title}</span>
      {hint ? <span className="text-[10.5px] text-text-3">{hint}</span> : null}
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}

export function DocumentFileLine({
  doc,
  busy,
  onDelete,
}: {
  doc: PropertyDetailDocumentEntry;
  busy?: boolean;
  onDelete?: () => void;
}) {
  const showFileName =
    doc.fileName.trim().length > 0 && !isGeneratedFileName(doc.fileName);

  return (
    <div className="flex items-center justify-between gap-2.5 rounded border border-border bg-surface px-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="inline-flex h-[26px] min-w-[26px] shrink-0 items-center justify-center rounded-md border border-border bg-[color-mix(in_srgb,#a4906f_14%,transparent)] px-1.5 text-[10px] font-extrabold text-[#8c7857]"
          aria-hidden
        >
          {docKindLabel(doc)}
        </span>
        <span className="inline-flex min-w-0 flex-col gap-px">
          <span className="truncate text-[12px] font-semibold text-text">{doc.name}</span>
          <span className="truncate text-[10.5px] text-text-3">
            {doc.source}
            {showFileName ? (
              <>
                {" · "}
                <bdi dir="ltr" className={ltrValueClass}>
                  {doc.fileName}
                </bdi>
              </>
            ) : null}
          </span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {onDelete ? (
          <Button
            type="button"
            variant="dangerOutline"
            size="sm"
            disabled={busy}
            onClick={onDelete}
          >
            حذف
          </Button>
        ) : null}
        {doc.kind === "image" || doc.kind === "pdf" ? (
          <button
            type="button"
            className="rounded-md border border-border-md bg-surface px-3 py-1 text-[11px] font-bold text-text-2 max-lg:min-h-11"
            onClick={() => openPropertyDetailDocumentPreview(doc)}
          >
            معاينة
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-md border border-border-md bg-surface px-3 py-1 text-[11px] font-bold text-text-2 max-lg:min-h-11"
          onClick={() => downloadPropertyDetailDocument(doc)}
        >
          تنزيل
        </button>
      </div>
    </div>
  );
}

function rowStatusText(row: PropertyDocumentChecklistRow): string {
  if (row.documents.length > 0) return `${row.documents.length} مستند`;
  if (row.satisfiedBy) return `مستوفى عبر «${row.satisfiedBy}»`;
  if (row.missing) return "مطلوب — لم يُرفع بعد";
  return row.type.uploadableFromTab ? "لم يُرفع" : "يُرفع من الجهة المختصة";
}

function RowStatusIcon({ row }: { row: PropertyDocumentChecklistRow }) {
  const done = row.documents.length > 0 || Boolean(row.satisfiedBy);
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border text-[12px] font-bold",
        done &&
          "border-transparent bg-[color-mix(in_srgb,#3f8f5f_12%,transparent)] text-[#2f7a4d]",
        !done && row.missing && "border-red/30 bg-danger-bg text-danger-text",
        !done && !row.missing && "border-border-md text-text-3",
      )}
    >
      {done ? "✓" : row.missing ? "!" : "○"}
    </span>
  );
}

export function ChecklistRowView({
  row,
  canUpload,
  busy,
  onUpload,
  onDelete,
}: {
  row: PropertyDocumentChecklistRow;
  canUpload: boolean;
  busy: boolean;
  onUpload: (typeKey: string) => void;
  onDelete: (attachmentId: string) => void;
}) {
  return (
    <div
      className={cn(
        "rounded border border-border bg-surface-2 px-3 py-2.5",
        row.missing && "border-red/30",
      )}
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <RowStatusIcon row={row} />
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-semibold text-text">
              {row.label}
              {row.required ? <span className="text-danger-text"> *</span> : null}
            </span>
            <span
              className={cn(
                "block text-[10.5px]",
                row.missing ? "text-danger-text" : "text-text-3",
              )}
            >
              {rowStatusText(row)}
            </span>
          </span>
        </div>
        {canUpload && row.type.uploadableFromTab ? (
          // Only rows with a document on file reach this component now
          // (ChecklistGroupSection filters the rest out), so this is always
          // "add another of this type" — never the missing-doc prompt.
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onUpload(row.type.key)}
          >
            إضافة
          </Button>
        ) : null}
      </div>
      {row.documents.length > 0 ? (
        <div className="mt-2 grid gap-1.5">
          {row.documents.map((doc) => (
            <DocumentFileLine
              key={doc.id}
              doc={doc}
              busy={busy}
              onDelete={
                canUpload && doc.governed && doc.attachmentId
                  ? () => onDelete(doc.attachmentId!)
                  : undefined
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Every document on file across all checklist groups, as one flat list —
 * no «الملكية والنظامية» / «التكليف والأطراف» category split, no count
 * badge, no rows for the still-missing types. The top-of-tab «+ إضافة
 * مستند» stays the one way to add a document.
 */
export function ChecklistRowsList({
  groups,
  canUpload,
  busy,
  onUpload,
  onDelete,
}: {
  groups: PropertyDocumentChecklistGroup[];
  canUpload: boolean;
  busy: boolean;
  onUpload: (typeKey: string) => void;
  onDelete: (attachmentId: string) => void;
}) {
  const uploadedRows = groups
    .flatMap((group) => group.rows)
    .filter((row) => row.documents.length > 0);
  if (uploadedRows.length === 0) return null;
  return (
    <section className="mb-3.5">
      <div className="grid gap-2">
        {uploadedRows.map((row) => (
          <ChecklistRowView
            key={row.type.key}
            row={row}
            canUpload={canUpload}
            busy={busy}
            onUpload={onUpload}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}
