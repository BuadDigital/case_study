"use client";



import { useEffect, useState } from "react";

import {

  getCachedPropertyDocMatching,

  isImageMime,

  isPdfMime,

  prefetchKeysProofDoc,

  prefetchPropertyDocAttachments,

  subscribeAssignmentDocCache,

  type CachedAssignmentDoc,

  type PropertyDocKind,

} from "../../lib/prototype/assignment-doc-attachments";

import { Button, cn } from "@platform/design-system";



export function AssignmentDocAttachment({

  poNumber,

  propertyId,

  fileName,

  variant = "detail",

  docKind = "decree",

}: {

  poNumber: string;

  propertyId: string;

  fileName?: string;

  variant?: "inline" | "detail" | "thumb" | "card" | "panel";

  docKind?: PropertyDocKind;

}) {

  const [cacheTick, setCacheTick] = useState(0);



  useEffect(() => {

    return subscribeAssignmentDocCache(() => {

      setCacheTick((n) => n + 1);

    });

  }, []);



  useEffect(() => {

    let cancelled = false;

    const load =

      docKind === "keys-proof"

        ? prefetchKeysProofDoc(poNumber, propertyId, fileName)

        : prefetchPropertyDocAttachments(poNumber, propertyId, {

            kind: docKind,

            expectedFileName: fileName,

          });

    void load.finally(() => {

      if (!cancelled) setCacheTick((n) => n + 1);

    });

    return () => {

      cancelled = true;

    };

  }, [poNumber, propertyId, docKind, fileName]);



  const cached = getCachedPropertyDocMatching(

    docKind,

    poNumber,

    propertyId,

    fileName,

  );

  // cacheTick forces a re-read after cache writes/clears.

  void cacheTick;



  const displayName = fileName?.trim() || cached?.fileName || "";

  if (!displayName) {

    return (

      <span className="text-xs font-semibold text-danger-text">غير مرفق</span>

    );

  }



  const doc: CachedAssignmentDoc = {

    fileName: displayName,

    mimeType: cached?.mimeType ?? guessMime(displayName),

    dataUrl: cached?.dataUrl,

  };



  const isPdf = isPdfMime(doc.mimeType, doc.fileName);

  const hasVisualPreview =

    Boolean(doc.dataUrl) && (isImageMime(doc.mimeType) || isPdf);



  return (

    <div

      className={cn(

        "flex flex-col items-start gap-1.5",

        variant === "inline" && "mt-2",

        variant === "card" && "flex-row items-start gap-2.5",

        variant === "panel" && "items-stretch gap-2.5",

      )}

    >

      <AttachmentPreview doc={doc} variant={variant} />

      <div

        className={cn(

          "flex min-w-0 flex-col gap-0.5",

          variant === "card" && "flex-1 pt-0.5",

          variant === "panel" && "w-full",

        )}

      >

        <span className="break-all text-[11px] text-text-2" title={doc.fileName}>

          {doc.fileName}

        </span>

        {hasVisualPreview ? (

          <span className="text-[10px] text-text-3">

            {isPdf

              ? "معاينة الصفحة الأولى — اضغط للتكبير"

              : "اضغط على الصورة للتكبير"}

          </span>

        ) : null}

        {!doc.dataUrl && isImageMime(doc.mimeType) ? (

          <span className="text-[10px] text-text-3">

            المعاينة غير متوفرة — أعد الرفع من نفس المتصفح

          </span>

        ) : null}

        {!doc.dataUrl && isPdf ? (

          <span className="text-[10px] text-text-3">

            معاينة PDF غير متوفرة — أعد الرفع من نفس المتصفح

          </span>

        ) : null}

        {!doc.dataUrl && !isImageMime(doc.mimeType) && !isPdf ? (

          <span className="text-[10px] text-text-3">

            معاينة الملف غير متوفرة

          </span>

        ) : null}

      </div>

    </div>

  );

}



function AttachmentPreview({

  doc,

  variant,

}: {

  doc: CachedAssignmentDoc;

  variant: "inline" | "detail" | "thumb" | "card" | "panel";

}) {

  const [lightboxOpen, setLightboxOpen] = useState(false);

  const isPdf = isPdfMime(doc.mimeType, doc.fileName);

  const hasVisualPreview =

    Boolean(doc.dataUrl) && (isImageMime(doc.mimeType) || isPdf);



  if (hasVisualPreview && doc.dataUrl) {

    const imgClass = cn(

      "block max-w-full bg-surface-2 object-contain",

      variant === "thumb" && "max-h-12 max-w-[72px]",

      variant === "card" && "max-h-[72px] max-w-[120px] w-auto",

      variant === "panel" &&

        "max-h-[min(420px,50vh)] h-auto w-full max-w-full rounded-[var(--radius-DEFAULT)] border border-border bg-surface object-contain",

      variant !== "thumb" &&

        variant !== "card" &&

        variant !== "panel" &&

        "max-h-40 w-auto",

    );



    return (

      <>

        <button

          type="button"

          className={cn(

            "relative block cursor-zoom-in overflow-hidden rounded-[var(--radius-DEFAULT)] border border-border bg-transparent p-0 leading-none hover:border-primary hover:shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]",

            variant === "panel" && "w-full",

          )}

          onClick={() => setLightboxOpen(true)}

          title={`عرض ${doc.fileName}`}

          aria-label={`عرض المرفق: ${doc.fileName}`}

        >

          {/* Key forces the browser to drop the previous bitmap when the file changes. */}

          <img

            key={doc.dataUrl.slice(0, 64)}

            src={doc.dataUrl}

            alt=""

            className={imgClass}

          />

          {isPdf ? (

            <span className="absolute bottom-1 start-1 rounded bg-danger px-1.5 py-0.5 text-[9px] font-bold text-white">

              PDF

            </span>

          ) : null}

        </button>



        {lightboxOpen ? (

          <div

            className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/72 p-6 backdrop-blur-sm"

            role="dialog"

            aria-modal="true"

            aria-label={doc.fileName}

            onClick={() => setLightboxOpen(false)}

            onKeyDown={(e) => {

              if (e.key === "Escape") setLightboxOpen(false);

            }}

          >

            <div

              className="flex max-h-[90vh] max-w-[min(92vw,900px)] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[0_16px_48px_rgba(0,0,0,0.25)]"

              onClick={(e) => e.stopPropagation()}

            >

              <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-3.5 py-2.5">

                <span className="break-all text-xs text-text-2">

                  {doc.fileName}

                  {isPdf ? " — الصفحة الأولى" : ""}

                </span>

                <Button

                  type="button"

                  size="sm"

                  onClick={() => setLightboxOpen(false)}

                >

                  إغلاق

                </Button>

              </div>

              <img

                key={doc.dataUrl.slice(0, 64)}

                src={doc.dataUrl}

                alt={`معاينة المرفق: ${doc.fileName}`}

                className="mx-auto block max-h-[calc(90vh-52px)] w-auto max-w-full object-contain"

              />

            </div>

          </div>

        ) : null}

      </>

    );

  }



  return (

    <div

      className={cn(

        "flex h-12 w-12 items-center justify-center rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 text-[11px] font-bold text-text-3",

        isPdf && "bg-danger-bg text-danger-text",

      )}

      aria-hidden

    >

      {isPdf ? "PDF" : "📎"}

    </div>

  );

}



function guessMime(fileName: string): string {

  const lower = fileName.toLowerCase();

  if (lower.endsWith(".png")) return "image/png";

  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";

  if (lower.endsWith(".pdf")) return "application/pdf";

  return "application/octet-stream";

}


