"use client";

/**
 * «مستندات ذات قيمة»: the uploader's name, the case specialist's decision and — for the
 * specialist — approve / reject. The server returns these rows only to the specialist, the
 * appraiser and the CDO; the appraiser decides their effect on the valuation.
 */

import { useState } from "react";
import { Button, Textarea, cn } from "@platform/ui-kit";
import type { PropertyDetailDocumentEntry } from "@platform/app-shared/app-data/property-detail-document-types";
import { ChecklistSectionTitle, DocumentFileLine } from "./PropertyDocumentChecklistParts";

const STATUS_LABELS = {
  pending: "بانتظار اعتماد الأخصائي",
  approved: "معتمد",
  rejected: "مرفوض",
} as const;

const STATUS_CLASSES = {
  pending: "border-[#e8d3a3] bg-[#fbf5e6] text-[#7a5a14]",
  approved: "border-[#bfdcc9] bg-[#eef7f1] text-[#2f7a4c]",
  rejected: "border-red/30 bg-danger-bg text-danger-text",
} as const;

function ValuedDocumentCard({
  entry,
  canReview,
  busy,
  onReview,
  onDelete,
}: {
  entry: PropertyDetailDocumentEntry;
  canReview: boolean;
  busy: boolean;
  onReview: (attachmentId: string, decision: "approved" | "rejected", note?: string) => Promise<boolean>;
  onDelete: (attachmentId: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const info = entry.valued;
  const status = info?.status ?? "pending";
  const attachmentId = entry.attachmentId;

  return (
    <div className="rounded border border-border bg-surface-2 px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <p className="m-0 text-[12.5px] font-semibold text-text">{info?.customLabel || entry.name}</p>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10.5px] font-bold",
            STATUS_CLASSES[status],
          )}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>
      {status === "rejected" && info?.reviewNote ? (
        <p className="m-0 mb-2 text-[11px] leading-relaxed text-danger-text">
          سبب الرفض: {info.reviewNote}
        </p>
      ) : null}
      <DocumentFileLine
        doc={entry}
        busy={busy}
        onDelete={canReview && attachmentId ? () => onDelete(attachmentId) : undefined}
      />
      {canReview && attachmentId ? (
        rejecting ? (
          <div className="mt-2 grid gap-1.5">
            <Textarea
              rows={2}
              value={note}
              maxLength={512}
              placeholder="سبب الرفض…"
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex justify-end gap-1.5">
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setRejecting(false)}>
                إلغاء
              </Button>
              <Button
                type="button"
                variant="dangerOutline"
                size="sm"
                disabled={busy || !note.trim()}
                onClick={() =>
                  void onReview(attachmentId, "rejected", note).then((ok) => {
                    if (ok) {
                      setRejecting(false);
                      setNote("");
                    }
                  })
                }
              >
                تأكيد الرفض
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            {status !== "rejected" ? (
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setRejecting(true)}>
                رفض
              </Button>
            ) : null}
            {status !== "approved" ? (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void onReview(attachmentId, "approved")}
              >
                اعتماد
              </Button>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}

export function ValuedDocumentsSection({
  entries,
  ...actions
}: {
  entries: PropertyDetailDocumentEntry[];
  canReview: boolean;
  busy: boolean;
  onReview: (attachmentId: string, decision: "approved" | "rejected", note?: string) => Promise<boolean>;
  onDelete: (attachmentId: string) => void;
}) {
  if (entries.length === 0) return null;
  const pending = entries.filter((e) => (e.valued?.status ?? "pending") === "pending").length;

  return (
    <section className="mb-3.5">
      <ChecklistSectionTitle
        title="مستندات ذات قيمة"
        hint={pending > 0 ? `${pending} بانتظار الاعتماد` : `${entries.length} مستند`}
      />
      <div className="grid gap-2">
        {entries.map((entry) => (
          <ValuedDocumentCard key={entry.id} entry={entry} {...actions} />
        ))}
      </div>
    </section>
  );
}
