"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AppModal, Button } from "@platform/ui-kit";
import {
  closeDocumentPreview,
  getDocumentPreviewSnapshot,
  registerDocumentPreviewHost,
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

  if (!request) return null;

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
        ) : request.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={loaded.url}
            alt={request.fileName}
            className="max-h-full max-w-full object-contain"
          />
        ) : request.kind === "pdf" ? (
          <iframe
            title={request.fileName}
            src={loaded.url}
            className="h-full w-full border-0 bg-surface"
          />
        ) : (
          <span className="text-[13px] text-text-3">
            لا تتوفر معاينة لهذا النوع من الملفات — استخدم التنزيل.
          </span>
        )}
      </div>
    </AppModal>
  );
}
