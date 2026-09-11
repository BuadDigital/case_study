"use client";

/**
 * Documents uploaded outside the defined list: the uploader's name and reason, the review
 * state, and the actions — classify onto a defined type (specialist / supervisor) or approve /
 * reject (supervisor / management).
 */

import { useEffect, useState } from "react";
import { AppModal, Button, Label, Textarea, cn } from "@platform/ui-kit";
import type { PropertyDetailDocumentEntry } from "@platform/app-shared/app-data/property-detail-document-types";
import { ChecklistSectionTitle, DocumentFileLine } from "./PropertyDocumentChecklistParts";

const STATUS_LABEL = {
  pending: "بانتظار المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
} as const;

const STATUS_CLASS = {
  pending: "border-[#e8d3a3] bg-[#fbf5e6] text-[#7a5a14]",
  approved:
    "border-transparent bg-[color-mix(in_srgb,#3f8f5f_12%,transparent)] text-[#2f7a4d]",
  rejected: "border-red/30 bg-danger-bg text-danger-text",
} as const;

function UnlistedDocumentCard({
  entry,
  canUpload,
  canReview,
  busy,
  onClassify,
  onApprove,
  onReject,
  onDelete,
}: {
  entry: PropertyDetailDocumentEntry;
  canUpload: boolean;
  canReview: boolean;
  busy: boolean;
  onClassify: (entry: PropertyDetailDocumentEntry) => void;
  onApprove: (entry: PropertyDetailDocumentEntry) => void;
  onReject: (entry: PropertyDetailDocumentEntry) => void;
  onDelete: (attachmentId: string) => void;
}) {
  const info = entry.unlisted;
  const status = info?.reviewStatus ?? "pending";
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
          {status === "rejected" && info?.reviewNote ? (
            <p className="m-0 mt-0.5 text-[11px] text-danger-text">
              سبب الرفض: {info.reviewNote}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-bold",
            STATUS_CLASS[status],
          )}
        >
          {STATUS_LABEL[status]}
        </span>
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
      {actionable && (canUpload || canReview) ? (
        <div className="mt-2 flex flex-wrap justify-end gap-1.5">
          {canUpload ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onClassify(entry)}
            >
              تصنيف ضمن نوع معرّف
            </Button>
          ) : null}
          {canReview && status !== "approved" ? (
            <Button type="button" size="sm" disabled={busy} onClick={() => onApprove(entry)}>
              اعتماد
            </Button>
          ) : null}
          {canReview && status !== "rejected" ? (
            <Button
              type="button"
              variant="dangerOutline"
              size="sm"
              disabled={busy}
              onClick={() => onReject(entry)}
            >
              رفض
            </Button>
          ) : null}
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
  canReview: boolean;
  busy: boolean;
  onClassify: (entry: PropertyDetailDocumentEntry) => void;
  onApprove: (entry: PropertyDetailDocumentEntry) => void;
  onReject: (entry: PropertyDetailDocumentEntry) => void;
  onDelete: (attachmentId: string) => void;
}) {
  if (entries.length === 0) return null;
  const pending = entries.filter(
    (entry) => (entry.unlisted?.reviewStatus ?? "pending") === "pending",
  ).length;

  return (
    <section className="mb-3.5">
      <ChecklistSectionTitle
        title="مستندات غير معرّفة"
        hint={pending > 0 ? `${pending} بانتظار المراجعة` : `${entries.length} مستند`}
      />
      <div className="grid gap-2">
        {entries.map((entry) => (
          <UnlistedDocumentCard key={entry.id} entry={entry} {...actions} />
        ))}
      </div>
    </section>
  );
}

export function RejectUnlistedDocumentDialog({
  entry,
  busy,
  onClose,
  onConfirm,
}: {
  entry: PropertyDetailDocumentEntry | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  useEffect(() => {
    if (entry) setNote("");
  }, [entry]);

  if (!entry) return null;
  return (
    <AppModal
      open
      title="رفض المستند غير المعرّف"
      subtitle={entry.unlisted?.customLabel || entry.name}
      onClose={onClose}
      maxWidthPx={460}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={busy || note.trim().length === 0}
            onClick={() => onConfirm(note.trim())}
          >
            تأكيد الرفض
          </Button>
        </>
      }
    >
      <Label className="mb-1 text-[11px]" htmlFor="reject-unlisted-note">
        سبب الرفض *
      </Label>
      <Textarea
        id="reject-unlisted-note"
        value={note}
        rows={3}
        maxLength={512}
        onChange={(e) => setNote(e.target.value)}
      />
    </AppModal>
  );
}
