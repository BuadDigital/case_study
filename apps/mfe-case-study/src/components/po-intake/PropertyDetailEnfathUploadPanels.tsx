"use client";

/** Infath upload assistant — deposit panel, expand/collapse controls, attachment list. */

import { Badge, Button } from "@platform/ui-kit";
import type { InfathUploadAttachment } from "../../lib/app-data/infath-upload-types";
import type { InfathDepositDraft } from "../../lib/app-data/infath-deposit-storage";
import { InfazIcon } from "./InfazIcon";
import {
  attachmentIcon,
  attachmentReady,
  attachmentStatusLabel,
} from "./property-detail-enfath-upload-state";

export function InfathDepositPanel({
  draft,
  onPatch,
}: {
  draft: InfathDepositDraft;
  onPatch: (patch: Partial<InfathDepositDraft>) => void;
}) {
  return (
    <section className="rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 p-3.5">
      <p className="m-0 mb-2 text-[13px] font-bold text-text">
        إيداع التقرير في الهيئة
      </p>
      <p className="m-0 mb-3 text-[11px] leading-relaxed text-text-3">
        رمز الإيداع حقل إدخال، وشهادة الإيداع مرفق — مستقلان عن استلام
        الأخصائي لتقرير التقييم.
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-text-2">
          رمز إيداع التقرير
          <input
            className="h-9 rounded-md border border-border bg-surface px-2.5 text-[13px] font-normal"
            dir="ltr"
            value={draft.depositCode}
            onChange={(e) => onPatch({ depositCode: e.target.value })}
            placeholder="أدخل رمز الإيداع…"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-text-2">
          شهادة الإيداع
          <input
            type="file"
            className="text-[12px] font-normal"
            onChange={(e) => {
              const file = e.target.files?.[0];
              onPatch({
                depositCertificateName: file?.name ?? "",
              });
            }}
          />
          {draft.depositCertificateName ? (
            <span className="text-[11px] font-normal text-text-3" dir="ltr">
              {draft.depositCertificateName}
            </span>
          ) : null}
        </label>
      </div>
    </section>
  );
}

export function InfathCollapseControls({
  onSetAllCollapsed,
}: {
  onSetAllCollapsed: (collapse: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={() => onSetAllCollapsed(false)}>
        <InfazIcon name="expand" />
        توسيع الكل
      </Button>
      <Button type="button" size="sm" onClick={() => onSetAllCollapsed(true)}>
        <InfazIcon name="collapse" />
        طي الكل
      </Button>
    </div>
  );
}

function InfathAttachmentRow({
  item,
  onDownload,
}: {
  item: InfathUploadAttachment;
  onDownload: (item: InfathUploadAttachment) => void;
}) {
  const ready = attachmentReady(item);
  return (
    <div className="flex items-center gap-2.5 rounded-[var(--radius-DEFAULT)] border border-border bg-surface px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-DEFAULT)] bg-surface-2 text-text-2">
        <InfazIcon name={attachmentIcon(item)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-text">{item.name}</div>
        <div className="text-[10px] text-text-3">← {item.infathTarget}</div>
      </div>
      <Badge
        tone={ready ? "success" : "warning"}
        className="shrink-0 text-[10px] font-medium"
      >
        {attachmentStatusLabel(ready, item.conditional)}
      </Badge>
      <Button
        type="button"
        size="sm"
        className="h-8 w-8 shrink-0 p-0"
        disabled={!ready}
        onClick={() => onDownload(item)}
        aria-label={`تحميل ${item.name}`}
      >
        <InfazIcon name="download" />
      </Button>
    </div>
  );
}

export function InfathAttachmentsPanel({
  attachments,
  onDownload,
  onDownloadAll,
}: {
  attachments: InfathUploadAttachment[];
  onDownload: (item: InfathUploadAttachment) => void;
  onDownloadAll: () => void;
}) {
  return (
    <section className="rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 p-3.5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-text">
          <InfazIcon name="paperclip" />
          مرفقات الرفع (PDF) — نزّلها ثم ارفعها في إنفاذ
        </div>
        <Button type="button" size="sm" variant="primary" onClick={onDownloadAll}>
          <InfazIcon name="download" />
          تحميل الكل
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {attachments.map((item) => (
          <InfathAttachmentRow key={item.id} item={item} onDownload={onDownload} />
        ))}
      </div>
    </section>
  );
}
