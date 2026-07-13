"use client";

import { cn } from "@platform/design-system";
import { EmptyState, InfoBox, SectionHeader } from "./PropertyDetailFields";
import {
  openPropertyDetailDocumentPreview,
  type PropertyDetailDocumentEntry,
} from "../../lib/prototype/property-detail-documents";

export function PropertyDetailPhotosTab({
  photos,
}: {
  photos: PropertyDetailDocumentEntry[];
}) {
  if (photos.length === 0) {
    return (
      <>
        <SectionHeader>صور العقار</SectionHeader>
        <EmptyState
          icon="📷"
          title="لا توجد صور مرفوعة"
          sub="تظهر هنا صور المعاين الميداني بعد رفعها واعتمادها في مهمة المعاينة — ومستندات الصور الأخرى إن وُجدت."
        />
      </>
    );
  }

  return (
    <>
      <SectionHeader>صور العقار</SectionHeader>
      <InfoBox icon="ℹ">
        {photos.length} صورة للعقار
      </InfoBox>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            className={cn(
              "group flex aspect-square flex-col overflow-hidden rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 p-0 text-start transition-colors",
              "hover:border-primary-light hover:shadow-sm",
              !photo.dataUrl && "cursor-default opacity-80",
            )}
            disabled={!photo.dataUrl}
            onClick={() => openPropertyDetailDocumentPreview(photo)}
          >
            {photo.dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.dataUrl}
                alt={photo.name}
                className="h-full w-full flex-1 object-cover"
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2 text-center text-text-3">
                <span aria-hidden>📷</span>
                <span className="text-[10px]">جاري التحميل…</span>
              </div>
            )}
            <div className="shrink-0 border-t border-border px-2 py-1.5">
              <div className="truncate text-[11px] font-medium text-text">
                {photo.name}
              </div>
              <div className="truncate text-[10px] text-text-3">{photo.source}</div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
