"use client";

import { cn } from "@platform/ui-kit";
import type { PropertyPhotoMarks } from "@platform/app-shared/app-data/property-detail-document-types";
import { openPropertyDetailDocumentPreview } from "../../lib/app-data/property-detail-documents";
import { useInspectionPrimaryPhoto } from "../../query/inspection-primary-photo-query";

const circle =
  "grid size-[84px] shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-gold-soft text-gold-2 shadow-[0_4px_12px_-6px_rgba(18,40,76,.45)]";

function CameraGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}

/**
 * The circle at the head of a property's map card: its main inspector photo.
 *
 * How it works: the photo opens the shared preview on click. Mount it with a key
 * per record: `useInspectorPhotoDataUrl` keeps its last value until a new file
 * arrives, so reusing the instance would show the previous property's photo.
 *
 * Edge cases: a chosen photo whose file has not arrived (or failed) stays a
 * clickable camera, because the preview fetches on demand. Only a task with no
 * usable photo says «لا توجد صورة مرفقة».
 */
export function PropertyMapCardPhoto({
  inspectionTaskId,
  photoMarks,
}: {
  inspectionTaskId: string | null;
  photoMarks?: PropertyPhotoMarks;
}) {
  const { photo, url, loading } = useInspectionPrimaryPhoto(inspectionTaskId, photoMarks);

  if (!photo) {
    return (
      <div className={cn(circle, loading && "animate-pulse")}>
        {loading ? (
          <CameraGlyph />
        ) : (
          <div className="flex flex-col items-center gap-0.5 px-2 text-center">
            <CameraGlyph />
            <span className="text-[9.5px] font-semibold leading-tight text-text-3">
              لا توجد صورة مرفقة
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(circle, "cursor-zoom-in p-0")}
      aria-label="تكبير صورة العقار"
      onClick={() => openPropertyDetailDocumentPreview({ ...photo, dataUrl: url })}
    >
      {url ? (
        <img src={url} alt={photo.name} className="size-full object-cover" />
      ) : (
        <CameraGlyph />
      )}
    </button>
  );
}
