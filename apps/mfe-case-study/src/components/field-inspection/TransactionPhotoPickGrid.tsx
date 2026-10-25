"use client";

import type { PropertyDetailDocumentEntry } from "../../lib/app-data/property-detail-documents";

/** «اختر من صور المعاملة» body — thumbnails of the transaction's photos, or the empty text. */
export function TransactionPhotoPickGrid({
  photos,
  emptyText,
  onPick,
}: {
  photos: readonly PropertyDetailDocumentEntry[];
  emptyText: string;
  onPick: (photo: PropertyDetailDocumentEntry) => void;
}) {
  if (photos.length === 0) {
    return <p className="m-0 text-[13px] text-text-3">{emptyText}</p>;
  }
  return (
    <div className="grid max-h-[min(420px,60vh)] grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 overflow-y-auto">
      {photos.map((photo) => (
        <button
          key={photo.id}
          type="button"
          className="overflow-hidden rounded-lg border border-border bg-surface-2 p-0 text-start hover:border-gold"
          onClick={() => onPick(photo)}
        >
          <div className="relative h-[88px] w-full bg-surface-2">
            {photo.dataUrl ? (
              <img
                src={photo.dataUrl}
                alt={photo.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-text-3">
                معاينة
              </div>
            )}
          </div>
          <div className="px-2 py-1.5">
            <div className="truncate text-[11px] font-semibold text-heading">
              {photo.name}
            </div>
            <div className="truncate text-[10px] text-text-3">
              {photo.source}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
