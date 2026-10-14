"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AppModal, Button } from "@platform/ui-kit";
import {
  closeDocumentPreview,
  documentPreviewIndex,
  getDocumentPreviewSnapshot,
  registerDocumentPreviewHost,
  stepDocumentPreview,
  subscribeDocumentPreview,
  type DocumentPreviewRequest,
} from "../app-data/document-preview-store";
import { downloadAttachmentBlobOnce } from "../app-data/attachment-blob-cache";
import {
  downloadDocumentFile,
  objectUrlFromDataUrl,
} from "../app-data/download-document-file";
import { prototypeModulesApiConfig } from "../app-data/modules-api-config";

type Loaded =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; url: string };

/** Hide the built-in PDF thumbnail sidebar without dropping an existing fragment. */
function pdfPreviewFrameSrc(url: string): string {
  if (/(?:^|[#&])navpanes=/.test(url)) return url;
  const hash = url.indexOf("#");
  if (hash === -1) return `${url}#navpanes=0`;
  const fragment = url.slice(hash + 1);
  return `${url.slice(0, hash)}#${fragment}${fragment ? "&" : ""}navpanes=0`;
}

function useResolvedUrl(request: DocumentPreviewRequest | null): Loaded {
  const [state, setState] = useState<{
    forRequest: DocumentPreviewRequest | null;
    loaded: Loaded;
  }>({ forRequest: null, loaded: { status: "loading" } });

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      let url: string | null = null;
      if (request.dataUrl) {
        objectUrl = objectUrlFromDataUrl(request.dataUrl);
        url = objectUrl ?? request.dataUrl;
      } else if (request.attachmentId?.trim()) {
        const config = prototypeModulesApiConfig();
        const result = config
          ? await downloadAttachmentBlobOnce(config, request.attachmentId.trim())
          : null;
        if (result?.ok) {
          // The PDF viewer needs the right MIME type on the blob.
          const blob =
            request.kind === "pdf" && result.data.type !== "application/pdf"
              ? new Blob([result.data], { type: "application/pdf" })
              : result.data;
          objectUrl = URL.createObjectURL(blob);
          url = objectUrl;
        }
      }
      if (cancelled) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        return;
      }
      setState({
        forRequest: request,
        loaded: url ? { status: "ready", url } : { status: "error" },
      });
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [request]);

  return state.forRequest === request ? state.loaded : { status: "loading" };
}

/** Mount once near the app root — renders every `requestDocumentPreview` as a same-page dialog. */
export function DocumentPreviewHost() {
  useEffect(() => registerDocumentPreviewHost(), []);
  const request = useSyncExternalStore(
    subscribeDocumentPreview,
    getDocumentPreviewSnapshot,
    () => null,
  );
  const loaded = useResolvedUrl(request);

  useEffect(() => {
    if (!request || (request.kind !== "image" && request.kind !== "pdf")) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDocumentPreview();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        stepDocumentPreview(1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        stepDocumentPreview(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      window.removeEventListener("keydown", onKey);
    };
  }, [request]);

  if (!request) return null;

  if (request.kind === "image") {
    return <ImagePreviewLightbox request={request} loaded={loaded} />;
  }

  if (request.kind === "pdf") {
    return <PdfPreviewLightbox request={request} loaded={loaded} />;
  }

  return (
    <AppModal
      open
      stacked
      wide
      maxWidthPx={1100}
      title={request.title || request.fileName}
      onClose={closeDocumentPreview}
      footer={
        <>
          <Button
            type="button"
            variant="default"
            showActionToast={false}
            onClick={() =>
              void downloadDocumentFile({
                fileName: request.fileName,
                dataUrl: request.dataUrl,
                attachmentId: request.attachmentId,
              })
            }
          >
            تنزيل
          </Button>
          <Button
            type="button"
            variant="primary"
            showActionToast={false}
            onClick={closeDocumentPreview}
          >
            إغلاق
          </Button>
        </>
      }
    >
      <div className="flex h-[70vh] items-center justify-center overflow-hidden rounded-lg bg-surface-2">
        {loaded.status === "loading" ? (
          <span className="text-[13px] text-text-3">جاري التحميل…</span>
        ) : loaded.status === "error" ? (
          <span className="text-[13px] text-danger-text">
            تعذّر تحميل المستند — جرّب التنزيل.
          </span>
        ) : (
          <span className="text-[13px] text-text-3">
            لا تتوفر معاينة لهذا النوع من الملفات — استخدم التنزيل.
          </span>
        )}
      </div>
    </AppModal>
  );
}

/**
 * A PDF fills the whole window like the photo lightbox — no white dialog frame around it.
 * A slim dark bar on top carries the title, download and close; the viewer takes the rest.
 */
function PdfPreviewLightbox({
  request,
  loaded,
}: {
  request: DocumentPreviewRequest;
  loaded: Loaded;
}) {
  const caption = request.title || request.fileName;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={caption}
      className="fixed inset-0 z-[var(--z-modal)] flex flex-col bg-[rgba(8,16,28,0.92)]"
    >
      <div className="flex h-12 shrink-0 items-center gap-3 px-3">
        <button
          type="button"
          aria-label="إغلاق"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-xl text-white hover:bg-black/70"
          onClick={closeDocumentPreview}
        >
          ×
        </button>
        <button
          type="button"
          className="rounded-full bg-black/50 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-black/70"
          onClick={() =>
            void downloadDocumentFile({
              fileName: request.fileName,
              dataUrl: request.dataUrl,
              attachmentId: request.attachmentId,
            })
          }
        >
          تنزيل
        </button>
        <p className="m-0 min-w-0 flex-1 truncate text-end text-[13px] font-semibold text-white/90">
          {caption}
        </p>
      </div>
      {loaded.status === "ready" ? (
        <iframe
          title={request.fileName}
          // Chromium/Edge open the thumbnail sidebar by default. navpanes=0
          // keeps that gray pane closed so only the page is shown.
          src={pdfPreviewFrameSrc(loaded.url)}
          className="min-h-0 w-full flex-1 border-0"
        />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center text-[13px] text-white/80">
          {loaded.status === "error"
            ? "تعذّر تحميل المستند — جرّب التنزيل."
            : "جاري التحميل…"}
        </div>
      )}
    </div>
  );
}

function ImagePreviewLightbox({
  request,
  loaded,
}: {
  request: DocumentPreviewRequest;
  loaded: Loaded;
}) {
  const index = documentPreviewIndex(request);
  const total = request.gallery?.length ?? 0;
  const caption = request.title || request.fileName;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={caption}
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center overflow-hidden bg-[rgba(8,16,28,0.92)]"
      onClick={closeDocumentPreview}
    >
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
        <button
          type="button"
          aria-label="إغلاق"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-xl text-white hover:bg-black/70"
          onClick={closeDocumentPreview}
        >
          ×
        </button>
        <button
          type="button"
          className="rounded-full bg-black/50 px-3 py-2 text-[13px] font-semibold text-white hover:bg-black/70"
          onClick={(event) => {
            event.stopPropagation();
            void downloadDocumentFile({
              fileName: request.fileName,
              dataUrl: request.dataUrl,
              attachmentId: request.attachmentId,
            });
          }}
        >
          تنزيل
        </button>
      </div>
      {loaded.status === "ready" ? (
        // Native pixels only: max-* shrinks a large photo into the window
        // and never stretches a smaller one, so it stays sharp and inside the viewport.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={loaded.url}
          alt={caption}
          className="block h-auto max-h-full min-h-0 w-auto max-w-full min-w-0 object-contain"
          onClick={(event) => event.stopPropagation()}
        />
      ) : (
        <span className="text-[13px] text-white/80">
          {loaded.status === "error"
            ? "تعذّر تحميل الصورة — جرّب التنزيل."
            : "جاري التحميل…"}
        </span>
      )}
      {index > 0 ? (
        <button
          type="button"
          aria-label="الصورة السابقة"
          className="absolute top-1/2 right-3 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
          onClick={(event) => {
            event.stopPropagation();
            stepDocumentPreview(-1);
          }}
        >
          <PreviewChevron direction="right" />
        </button>
      ) : null}
      {index >= 0 && index < total - 1 ? (
        <button
          type="button"
          aria-label="الصورة التالية"
          className="absolute top-1/2 left-3 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
          onClick={(event) => {
            event.stopPropagation();
            stepDocumentPreview(1);
          }}
        >
          <PreviewChevron direction="left" />
        </button>
      ) : null}
      <p className="pointer-events-none absolute inset-x-0 bottom-0 z-20 m-0 bg-gradient-to-t from-black/70 to-transparent px-16 py-4 text-center text-[12px] leading-relaxed text-white/90">
        {total > 1 ? `${index + 1} من ${total} · ` : null}
        {caption}
      </p>
    </div>
  );
}

function PreviewChevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden
    >
      {direction === "right" ? (
        <path d="m9 6 6 6-6 6" />
      ) : (
        <path d="m15 6-6 6 6 6" />
      )}
    </svg>
  );
}
