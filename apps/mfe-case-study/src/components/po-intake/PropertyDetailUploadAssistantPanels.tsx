"use client";

/** Infath upload assistant — deposit panel, expand/collapse controls, attachment list. */

import { Badge, Button } from "@platform/ui-kit";
import type { InfathUploadAttachment } from "../../lib/app-data/infath-upload-types";
import { InfazIcon } from "./InfazIcon";
import {
  attachmentIcon,
  attachmentReady,
  attachmentStatusLabel,
} from "./property-detail-upload-assistant-state";

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
  downloading,
  onDownload,
}: {
  item: InfathUploadAttachment;
  /** The file is being fetched or printed (the case-study report takes a few seconds). */
  downloading: boolean;
  onDownload: (item: InfathUploadAttachment) => void;
}) {
  const ready = attachmentReady(item);
  // «لا يوجد رفع مساحي» is an answer, not a gap: neutral, not the amber of a missing file.
  const tone = ready ? "success" : item.status === "not-needed" ? "default" : "warning";
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
        tone={tone}
        className="shrink-0 text-[10px] font-medium"
      >
        {attachmentStatusLabel(item)}
      </Badge>
      {/* The shared icon size — sm padding on a fixed 32px box squeezed the svg to ~1px. */}
      <Button
        type="button"
        size="icon"
        disabled={!ready}
        loading={downloading}
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
  downloadingIds,
  onDownload,
  onDownloadAll,
}: {
  attachments: InfathUploadAttachment[];
  /** Rows whose file is being fetched or printed right now. */
  downloadingIds: ReadonlySet<string>;
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
        {/* The glyph goes in `icon` so the spinner replaces it while files download (as a child it
            stayed beside the spinner). */}
        <Button
          type="button"
          size="sm"
          variant="primary"
          loading={downloadingIds.size > 0}
          icon={<InfazIcon name="download" />}
          onClick={onDownloadAll}
        >
          تحميل الكل
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {attachments.map((item) => (
          <InfathAttachmentRow
            key={item.id}
            item={item}
            downloading={downloadingIds.has(item.id)}
            onDownload={onDownload}
          />
        ))}
      </div>
    </section>
  );
}
