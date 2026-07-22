"use client";

import { useEffect, useState, type ReactNode } from "react";
import { downloadAttachmentBlob } from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import {
  openTaskAttachmentPreview,
  type TaskAttachmentPreview,
} from "@platform/app-shared/prototype/task-attachments-api";
import { cn } from "@platform/design-system";

type PreviewState =
  | { status: "idle" | "loading" | "error" }
  | { status: "ready"; preview: TaskAttachmentPreview };

function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

function isPdfMime(mime: string, fileName?: string): boolean {
  if (mime === "application/pdf") return true;
  return (fileName ?? "").toLowerCase().endsWith(".pdf");
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function FileIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

/** HTML `keyAtt` colors. */
export const KEY_ATT_COLORS = {
  receipt: "#2f7a4d",
  photo: "#378add",
  letter: "#b58a3c",
  file: "#8c7857",
} as const;

export function KeyEnvelopeAttachmentPreview({
  attachmentId,
  label,
  className,
  variant = "block",
  chipColor = KEY_ATT_COLORS.file,
  attKind,
  icon,
}: {
  attachmentId: string;
  label: string;
  className?: string;
  /** `chip` — HTML file-chip that opens preview on click. */
  variant?: "block" | "chip";
  chipColor?: string;
  /** Selects icon + default color from HTML `keyAtt`. */
  attKind?: keyof typeof KEY_ATT_COLORS;
  icon?: ReactNode;
}) {
  const [state, setState] = useState<PreviewState>({ status: "idle" });
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const resolvedColor = attKind ? KEY_ATT_COLORS[attKind] : chipColor;
  const chipIcon =
    icon ?? (attKind === "photo" ? <ImageIcon /> : <FileIcon />);

  useEffect(() => {
    const id = attachmentId.trim();
    if (!id) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    void (async () => {
      const config = prototypeModulesApiConfig();
      if (!config) {
        if (!cancelled) setState({ status: "error" });
        return;
      }
      const result = await downloadAttachmentBlob(config, id);
      if (cancelled) return;
      if (!result.ok) {
        setState({ status: "error" });
        return;
      }
      try {
        const mimeType = result.data.type || "application/octet-stream";
        const dataUrl = await blobToDataUrl(result.data);
        if (cancelled) return;
        setState({
          status: "ready",
          preview: {
            attachmentId: id,
            fileName: label,
            mimeType,
            dataUrl,
            sizeBytes: result.data.size,
          },
        });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachmentId, label]);

  function openFull(preview: TaskAttachmentPreview) {
    if (!preview.dataUrl) return;
    if (isImageMime(preview.mimeType)) {
      setLightboxOpen(true);
      return;
    }
    openTaskAttachmentPreview(preview);
  }

  const lightbox =
    lightboxOpen && state.status === "ready" && state.preview.dataUrl ? (
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/72 p-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={() => setLightboxOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setLightboxOpen(false);
        }}
      >
        <img
          src={state.preview.dataUrl}
          alt={label}
          className="max-h-[90vh] max-w-[90vw] rounded-md object-contain shadow-lg"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    ) : null;

  if (variant === "chip") {
    if (state.status === "idle") return null;
    const disabled = state.status !== "ready";
    return (
      <>
        <button
          type="button"
          disabled={disabled}
          title={
            state.status === "loading"
              ? `جاري تحميل ${label}…`
              : state.status === "error"
                ? `تعذّر عرض ${label}`
                : `عرض ${label}`
          }
          className={cn(
            "inline-flex items-center gap-[7px] rounded-lg border border-border-md bg-surface-2 px-[11px] py-1.5 text-[12px] font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-60",
            className,
          )}
          style={{ color: resolvedColor }}
          onClick={() => {
            if (state.status === "ready") openFull(state.preview);
          }}
        >
          {chipIcon}
          {state.status === "loading" ? `جاري تحميل…` : label}
        </button>
        {lightbox}
      </>
    );
  }

  if (state.status === "idle") return null;

  if (state.status === "loading") {
    return (
      <div
        className={cn(
          "rounded-md border border-border bg-surface-2 px-3 py-2 text-[11px] text-text-3",
          className,
        )}
      >
        جاري تحميل {label}…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        className={cn(
          "rounded-md border border-border px-3 py-2 text-[11px] text-danger-text",
          className,
        )}
      >
        تعذّر عرض {label}
      </div>
    );
  }

  const { preview } = state;
  const isPdf = isPdfMime(preview.mimeType, preview.fileName);
  const isImage = isImageMime(preview.mimeType);

  return (
    <>
      <div className={cn("space-y-1.5", className)}>
        <div className="text-[11px] font-semibold text-text-2">{label}</div>
        {isImage && preview.dataUrl ? (
          <button
            type="button"
            className="relative block max-w-full cursor-zoom-in overflow-hidden rounded-md border border-border bg-surface-2 p-0 leading-none hover:border-primary"
            onClick={() => openFull(preview)}
            title={`عرض ${label}`}
            aria-label={`عرض المرفق: ${label}`}
          >
            <img
              src={preview.dataUrl}
              alt=""
              className="block max-h-36 max-w-full object-contain"
            />
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-[11px] font-semibold text-primary hover:border-primary"
            onClick={() => openFull(preview)}
            disabled={!preview.dataUrl}
          >
            {isPdf ? (
              <span className="rounded bg-danger px-1.5 py-0.5 text-[9px] font-bold text-white">
                PDF
              </span>
            ) : null}
            فتح {label}
          </button>
        )}
      </div>
      {lightbox}
    </>
  );
}
