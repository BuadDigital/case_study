"use client";

import { useMemo, useState } from "react";
import { cn, useToast } from "@platform/design-system";
import { EmptyState, InfoBox } from "./PropertyDetailFields";
import {
  openPropertyDetailDocumentPreview,
  type PropertyDetailDocumentEntry,
} from "../../lib/prototype/property-detail-documents";
import { openPropertyPhotosPdfPrint } from "../../lib/prototype/property-photos-pdf";

function groupPhotos(
  photos: PropertyDetailDocumentEntry[],
): { title: string; source: string; items: PropertyDetailDocumentEntry[] }[] {
  const map = new Map<
    string,
    { title: string; source: string; items: PropertyDetailDocumentEntry[] }
  >();
  for (const photo of photos) {
    const key = `${photo.source}::${photo.name}`;
    const existing = map.get(key);
    if (existing) {
      existing.items.push(photo);
    } else {
      map.set(key, {
        title: photo.name.trim() || "صور العقار",
        source: photo.source,
        items: [photo],
      });
    }
  }
  return [...map.values()];
}

function PhotoTile({ photo }: { photo: PropertyDetailDocumentEntry }) {
  const canOpen = Boolean(photo.dataUrl);
  return (
    <button
      type="button"
      className={cn(
        "relative h-[110px] overflow-hidden rounded border border-border bg-surface-2 p-0",
        canOpen ? "cursor-pointer" : "cursor-default opacity-80",
      )}
      disabled={!canOpen}
      onClick={() => openPropertyDetailDocumentPreview(photo)}
      aria-label={photo.name}
    >
      {photo.dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.dataUrl}
          alt={photo.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-text-3">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="8.5" cy="9.5" r="1.5" />
            <path d="m4 17 5-5 4 4 3-2 4 4" />
          </svg>
        </div>
      )}
    </button>
  );
}

export function PropertyDetailPhotosTab({
  photos,
  title = "صور العقار",
}: {
  photos: PropertyDetailDocumentEntry[];
  title?: string;
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => groupPhotos(photos), [photos]);

  if (photos.length === 0) {
    return (
      <EmptyState
        icon="📷"
        title="لا توجد صور مرفوعة"
        sub="تظهر هنا صور المعاين الميداني بعد رفعها واعتمادها في مهمة المعاينة — ومستندات الصور الأخرى إن وُجدت."
      />
    );
  }

  const downloadable = photos.filter((p) => p.dataUrl);

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="text-[11.5px] text-text-3">
          إجمالي {photos.length} صورة
        </div>
        {downloadable.length > 0 ? (
          <button
            type="button"
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-md bg-surface px-3.5 py-1.5 text-[11.5px] font-bold text-text-2 disabled:opacity-50"
            onClick={() => {
              setBusy(true);
              showToast("يجري تجهيز ملف PDF بصور العقار للتنزيل…", "info");
              const ok = openPropertyPhotosPdfPrint(downloadable, title);
              if (!ok) {
                showToast(
                  "تعذّر فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة ثم أعد المحاولة.",
                  "error",
                );
              }
              window.setTimeout(() => setBusy(false), 800);
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            تنزيل الصور PDF
          </button>
        ) : null}
      </div>

      {groups.map((group) => (
        <div key={`${group.source}-${group.title}`} className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-bold text-heading">{group.title}</span>
            <span className="text-[10.5px] text-text-3">
              {group.items.length} صورة · {group.source}
            </span>
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
            {group.items.map((photo) => (
              <PhotoTile key={photo.id} photo={photo} />
            ))}
          </div>
        </div>
      ))}

      <InfoBox icon="ℹ">
        الصور مرفوعة من النظام بواسطة المعاين أو الطرف المختص — هذا التبويب
        للاستعراض فقط.
      </InfoBox>
    </>
  );
}
