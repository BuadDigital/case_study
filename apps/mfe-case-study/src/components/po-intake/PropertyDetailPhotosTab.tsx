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
          sub="تظهر هنا الصور المعتمدة من المعاين الميداني بعد رفعها في مهمة المعاينة."
        />
      </>
    );
  }

  return (
    <>
      <SectionHeader>صور العقار</SectionHeader>
      <InfoBox icon="ℹ">
        {photos.length} صورة معتمدة من المعاين الميداني
      </InfoBox>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            className={cn(
              "group flex aspect-square flex-col overflow-hidden rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 p-0 text-start transition-colors",
              "hover:border-primary-light hover:shadow-sm",
            )}
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
              <div className="flex flex-1 items-center justify-center text-text-3">
                📷
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
