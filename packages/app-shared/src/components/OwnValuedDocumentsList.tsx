"use client";

/**
 * What the uploader of a «مستند ذي قيمة» keeps seeing after the upload: the name they gave it, the
 * case specialist's decision and a «معاينة» button that opens the file in the shared preview dialog.
 * Listed under «إضافة مستند ذي قيمة» on the inspector / engineering-office screens. The case
 * specialist / appraiser / CDO get every valued document of the property here (the server decides),
 * and with `canReview` the specialist approves or rejects each one right from the list.
 */

import { useEffect, useState } from "react";
import { listOwnValuedDocuments, type OwnValuedDocumentDto } from "@platform/api-client";
import { Badge, Button, promptAction, useToast, type BadgeTone } from "@platform/ui-kit";
import { reviewValueDocument } from "@platform/api-client";
import { requestDocumentPreview } from "../app-data/document-preview-store";
import { previewDocumentFile } from "../app-data/download-document-file";
import { freshPrototypeModulesApiConfig } from "../app-data/modules-api-config";

const STATUS_LABELS: Record<string, string> = {
  pending: "بانتظار اعتماد الأخصائي",
  approved: "معتمد",
  rejected: "مرفوض",
};

const STATUS_TONES: Record<string, BadgeTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

function previewKind(doc: OwnValuedDocumentDto): "image" | "pdf" | "file" {
  const type = doc.contentType.toLowerCase();
  const name = doc.fileName.toLowerCase();
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (type.startsWith("image/")) return "image";
  return "file";
}

function openPreview(doc: OwnValuedDocumentDto): void {
  const shown = requestDocumentPreview({
    id: doc.id,
    fileName: doc.fileName,
    title: doc.name,
    kind: previewKind(doc),
    attachmentId: doc.id,
  });
  // No dialog host mounted (tests, isolated screens): open the file in a new tab instead.
  if (!shown) {
    const target = window.open("about:blank", "_blank");
    void previewDocumentFile({ fileName: doc.fileName, attachmentId: doc.id }, target);
  }
}

export function OwnValuedDocumentsList({
  poNumber,
  propertyId,
  reloadKey = 0,
  canReview = false,
}: {
  poNumber: string;
  propertyId: string;
  /** Bump after an upload to re-read the list. */
  reloadKey?: number;
  /** The case specialist: approve / reject from the list. */
  canReview?: boolean;
}) {
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<OwnValuedDocumentDto[]>([]);
  const [reviewed, setReviewed] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const scopeKey = `${poNumber.trim()}:${propertyId.trim()}`;
  const ready = Boolean(poNumber.trim() && propertyId.trim());

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      const config = await freshPrototypeModulesApiConfig();
      if (!config) return;
      const rows = await listOwnValuedDocuments(config, scopeKey);
      if (!cancelled) setDocuments(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, scopeKey, reloadKey, reviewed]);

  async function review(doc: OwnValuedDocumentDto, decision: "approved" | "rejected") {
    let note: string | null = null;
    if (decision === "rejected") {
      note = await promptAction({
        title: "رفض المستند",
        label: "سبب الرفض",
        required: true,
        confirmLabel: "تأكيد الرفض",
        danger: true,
      });
      if (note === null) return;
    }
    setBusyId(doc.id);
    const config = await freshPrototypeModulesApiConfig();
    const result = config
      ? await reviewValueDocument(config, doc.id, { decision, note })
      : null;
    setBusyId(null);
    if (!result?.ok) {
      showToast("تعذّر حفظ قرار الاعتماد — حاول مجدداً", "error");
      return;
    }
    showToast(decision === "approved" ? "اعتُمد المستند" : "رُفض المستند", "success");
    setReviewed((n) => n + 1);
  }

  if (documents.length === 0) return null;

  return (
    <ul
      className="m-0 mt-3 grid list-none gap-2 border-t border-border p-0 pt-3"
      aria-label="المستندات ذات القيمة التي رفعتها"
    >
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="rounded-lg border border-border bg-surface-2/50 px-3 py-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 basis-48">
              <i className="ti ti-file-text shrink-0 text-[16px] text-text-3" aria-hidden />
              <span className="min-w-0 truncate text-[12.5px] font-semibold text-heading">
                {doc.name}
              </span>
              <Badge tone={STATUS_TONES[doc.status] ?? "default"} dot className="shrink-0">
                {STATUS_LABELS[doc.status] ?? doc.status}
              </Badge>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => openPreview(doc)}>
                معاينة
              </Button>
              {canReview && doc.status !== "rejected" ? (
                <Button
                  type="button"
                  variant="dangerOutline"
                  size="sm"
                  disabled={busyId === doc.id}
                  onClick={() => void review(doc, "rejected")}
                >
                  رفض
                </Button>
              ) : null}
              {canReview && doc.status !== "approved" ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === doc.id}
                  onClick={() => void review(doc, "approved")}
                >
                  اعتماد
                </Button>
              ) : null}
            </div>
          </div>
          {doc.status === "rejected" && doc.reviewNote?.trim() ? (
            <p className="m-0 mt-1.5 text-[11.5px] leading-5 text-danger-text">
              سبب الرفض: {doc.reviewNote.trim()}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
