"use client";

import { useMemo, useState } from "react";
import { Spinner, cn, useToast } from "@platform/design-system";
import { InfoBox } from "./PropertyDetailFields";
import {
  openPropertyDetailDocumentPreview,
  type PropertyDetailDocumentEntry,
} from "../../lib/prototype/property-detail-documents";
import { openPropertyPhotosPdfPrint } from "../../lib/prototype/property-photos-pdf";

/**
 * Case Study.html photos tab fixed groups (always shown, placeholders when empty).
 * `count` = placeholder tile count when no real photos match the group.
 */
const HTML_PHOTO_GROUPS: {
  title: string;
  source: string;
  placeholderCount: number;
  match: (photo: PropertyDetailDocumentEntry) => boolean;
}[] = [
  {
    title: "صورة العقار الرئيسية",
    source: "المعاين",
    placeholderCount: 1,
    match: (p) => /رئيس|main|primary/i.test(`${p.name} ${p.fileName}`),
  },
  {
    title: "صور العقار الخارجية",
    source: "المعاين",
    placeholderCount: 4,
    match: (p) => /خارج|واجهة|front|exterior|sides?/i.test(`${p.name} ${p.fileName}`),
  },
  {
    title: "صور العقار من الداخل",
    source: "المعاين",
    placeholderCount: 6,
    match: (p) => /داخل|interior|inside|floor|أرض/i.test(`${p.name} ${p.fileName}`),
  },
  {
    title: "صور عدادات الكهرباء",
    source: "المعاين",
    placeholderCount: 2,
    match: (p) => /كهرب|elec|عداد/i.test(`${p.name} ${p.fileName}`),
  },
  {
    title: "صور الآبار",
    source: "المكتب الهندسي",
    placeholderCount: 2,
    match: (p) => /بئر|آبار|well/i.test(`${p.name} ${p.fileName}`),
  },
  {
    title: "صور المشتملات",
    source: "المعاين",
    placeholderCount: 3,
    match: (p) => /مشتمل|ملحق|annex|مرافق/i.test(`${p.name} ${p.fileName}`),
  },
];

function PlaceholderTile() {
  return (
    <div className="relative grid h-[110px] place-items-center overflow-hidden rounded border border-border bg-surface-2">
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-3, #8a8d96)"
        strokeWidth="1.5"
        aria-hidden
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <path d="m4 17 5-5 4 4 3-2 4 4" />
      </svg>
    </div>
  );
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
        <div className="flex h-full w-full items-center justify-center text-text-3">
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

function buildDisplayGroups(photos: PropertyDetailDocumentEntry[]) {
  const used = new Set<string>();
  const groups = HTML_PHOTO_GROUPS.map((def) => {
    const items = photos.filter((p) => {
      if (used.has(p.id)) return false;
      if (!def.match(p)) return false;
      used.add(p.id);
      return true;
    });
    return {
      title: def.title,
      source: def.source,
      items,
      placeholderCount: def.placeholderCount,
    };
  });

  const leftovers = photos.filter((p) => !used.has(p.id));
  if (leftovers.length > 0) {
    groups.push({
      title: "صور أخرى",
      source: leftovers[0]?.source || "—",
      items: leftovers,
      placeholderCount: 0,
    });
  }

  return groups;
}

/**
 * Case Study.html photos tab — fixed group headers + placeholder tiles when empty.
 */
export function PropertyDetailPhotosTab({
  photos,
  title = "صور العقار",
}: {
  photos: PropertyDetailDocumentEntry[];
  title?: string;
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => buildDisplayGroups(photos), [photos]);

  const displayTotal =
    photos.length > 0
      ? photos.length
      : HTML_PHOTO_GROUPS.reduce((n, g) => n + g.placeholderCount, 0);

  const downloadable = photos.filter((p) => p.dataUrl);

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="text-[11.5px] text-text-3">
          إجمالي {displayTotal} صورة
          {photos.length === 0 ? " (بانتظار الرفع)" : null}
        </div>
        <button
          type="button"
          disabled={busy || downloadable.length === 0}
          aria-busy={busy || undefined}
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
          {busy ? (
            <Spinner />
          ) : (
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
          )}
          {busy ? "جاري التجهيز…" : "تنزيل الصور PDF"}
        </button>
      </div>

      {groups.map((group) => {
        const tileCount =
          group.items.length > 0
            ? group.items.length
            : group.placeholderCount;
        return (
          <div key={`${group.source}-${group.title}`} className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-bold text-heading">{group.title}</span>
              <span className="text-[10.5px] text-text-3">
                {tileCount} صورة · {group.source}
              </span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
              {group.items.length > 0
                ? group.items.map((photo) => (
                    <PhotoTile key={photo.id} photo={photo} />
                  ))
                : Array.from({ length: group.placeholderCount }, (_, i) => (
                    <PlaceholderTile key={`${group.title}-ph-${i}`} />
                  ))}
            </div>
          </div>
        );
      })}

      <InfoBox icon="ℹ">
        الصور مرفوعة من النظام بواسطة المعاين أو الطرف المختص — هذا التبويب
        للاستعراض فقط.
      </InfoBox>
    </>
  );
}
