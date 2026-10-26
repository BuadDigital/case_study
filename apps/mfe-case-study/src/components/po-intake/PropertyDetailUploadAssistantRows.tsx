"use client";

/** Infath upload assistant — copyable field rows, area blocks and the collapsible section. */

import { Badge, Button, cn } from "@platform/ui-kit";
import { ltrValueClass } from "./PropertyDetailFields";
import type {
  InfathUploadField,
  InfathUploadSection,
} from "../../lib/app-data/infath-upload-types";
import { InfazIcon } from "./InfazIcon";
import {
  INFATH_EMPTY_VALUE,
  areaCopyKey,
  fieldCopyKey,
  infathFieldAction,
  infathFieldHasValue,
  type CopyKey,
} from "./property-detail-upload-assistant-state";

/**
 * Icon-only copy / download button of the Infath upload assistant.
 *
 * How it works: the shared `size="icon"` Button (32px box, no padding, 18px glyph in the
 * heading colour) with a check when `done`, else a download icon when `file`, else a copy icon.
 * `done` is the parent's «just copied» flag (`flashKey`), so the check shows only for
 * `COPIED_FLASH_MS` after a copy; the row's tint is driven separately by `copied`.
 *
 * Edge cases (fixed 2026-10-20):
 * - `size="sm"` added `px-3.5` and a `p-0` class on top did not win (`cn` only joins classes),
 *   so the svg was squeezed to ~1px and the button looked empty → the shared icon size.
 * - The check used to stay forever and read as a stuck state → it now clears after 2 s.
 * - The success colour on the svg needs `!` because the icon size already colours the svg.
 */
function CopyButton({
  done,
  file,
  title,
  onClick,
}: {
  done?: boolean;
  file?: boolean;
  title: string;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="default"
      className={cn(
        // `!` because the icon size already colours the svg (cn does not merge).
        done &&
          "border-success bg-success-bg hover:bg-success-bg [&>svg]:!text-success-text",
      )}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {done ? (
        <InfazIcon name="check" />
      ) : file ? (
        <InfazIcon name="download" />
      ) : (
        <InfazIcon name="copy" />
      )}
    </Button>
  );
}

function InfathFieldRow({
  field,
  isRefSection,
  copied,
  justCopied,
  onCopy,
  onDownload,
}: {
  field: InfathUploadField;
  isRefSection: boolean;
  /** Copied at some point in this visit — the row keeps its tint. */
  copied: boolean;
  /** Copied just now — the button shows its check for a moment. */
  justCopied: boolean;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const state = field.state ?? "";
  const hasValue = infathFieldHasValue(field.value);
  const isRef = field.type === "ref";
  const fieldAction = infathFieldAction(field);

  let action = null;
  if (fieldAction === "download") {
    action = <CopyButton file title="تحميل المرفق" onClick={onDownload} />;
  } else if (fieldAction === "copy") {
    action = <CopyButton done={justCopied} title="نسخ" onClick={onCopy} />;
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-[var(--radius-DEFAULT)] border border-border bg-surface px-3 py-2.5",
        !isRefSection && state === "cf" && "border-success/40 bg-success-bg/40",
        !isRefSection && state === "un" && "border-warning/40 bg-warning-bg/30",
        copied && "border-primary/40 bg-info-bg/50",
        isRef && "border-dashed bg-surface-2",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[11px] font-semibold text-text-2">{field.label}</div>
        <div>
          {hasValue ? (
            <div className="text-[13px] font-medium text-text">
              {field.type === "file" ? (
                <bdi dir="ltr" className={ltrValueClass}>
                  {field.value}
                </bdi>
              ) : (
                field.value
              )}
            </div>
          ) : (
            <div className="text-[13px] text-text-3">{INFATH_EMPTY_VALUE}</div>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

function InfathAreaBlock({
  field,
  copied,
  justCopied,
  onCopy,
}: {
  field: InfathUploadField;
  copied: boolean;
  justCopied: boolean;
  onCopy: () => void;
}) {
  const hasValue = infathFieldHasValue(field.value);

  // The block keeps its tint once copied (progress marker); only the button's check is transient.
  return (
    <div
      className={cn(
        "rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 p-3",
        copied && "border-primary/40 bg-info-bg/50",
      )}
    >
      {field.label ? (
        <div className="mb-2">
          <span className="text-[11px] font-semibold text-text-2">{field.label}</span>
        </div>
      ) : null}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed text-text">
          {hasValue ? field.value : INFATH_EMPTY_VALUE}
        </div>
        {hasValue ? (
          <CopyButton done={justCopied} title="نسخ" onClick={onCopy} />
        ) : null}
      </div>
    </div>
  );
}

export function InfathSectionBlock({
  section,
  collapsed,
  copiedKeys,
  flashKey = null,
  onToggle,
  onCopyField,
  onCopyArea,
  onDownloadFile,
}: {
  section: InfathUploadSection;
  collapsed: boolean;
  copiedKeys: Set<CopyKey>;
  /** The key copied within the last moment — its button shows the check. */
  flashKey?: CopyKey | null;
  onToggle: () => void;
  onCopyField: (key: CopyKey, text: string) => void;
  onCopyArea: (key: CopyKey, text: string) => void;
  onDownloadFile: (fileName: string) => void;
}) {
  const isRef = Boolean(section.conditional);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[var(--radius-DEFAULT)] border border-border bg-surface",
        isRef && "border-dashed bg-surface-2",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2.5 border-0 bg-transparent px-3.5 py-3 text-start font-[inherit] text-inherit"
        aria-expanded={!collapsed}
        onClick={onToggle}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold text-text-2">
          {section.num}
        </span>
        <h3 className="m-0 min-w-0 flex-1 text-sm font-semibold text-text">
          {section.title}
        </h3>
        {section.badge ? (
          <Badge
            tone={isRef ? "default" : "primary"}
            className="text-[10px] font-medium"
          >
            {section.badge}
          </Badge>
        ) : null}
        <InfazIcon
          name="chevron"
          className={cn(
            "shrink-0 text-text-3 transition-transform",
            collapsed && "-rotate-90",
          )}
        />
      </button>

      {!collapsed && section.fields.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 px-3.5 pb-3.5 sm:grid-cols-2">
          {section.fields.map((field) => {
            const key = fieldCopyKey(section.id, field.id);
            return (
              <InfathFieldRow
                key={key}
                field={field}
                isRefSection={isRef}
                copied={copiedKeys.has(key)}
                justCopied={flashKey === key}
                onCopy={() => onCopyField(key, field.value)}
                onDownload={() => onDownloadFile(field.value)}
              />
            );
          })}
        </div>
      ) : null}

      {!collapsed && section.areas.length > 0 ? (
        <div className="flex flex-col gap-2 px-3.5 pb-3.5">
          {section.areas.map((field) => {
            const key = areaCopyKey(section.id, field.id);
            return (
              <InfathAreaBlock
                key={key}
                field={field}
                copied={copiedKeys.has(key)}
                justCopied={flashKey === key}
                onCopy={() => onCopyArea(key, field.value)}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
