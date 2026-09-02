"use client";

import { useMemo, useState } from "react";
import { Spinner, cn, useToast } from "@platform/ui-kit";
import { InfoBox } from "./PropertyDetailFields";
import {
  openPropertyDetailDocumentPreview,
  type PropertyDetailDocumentEntry,
} from "../../lib/app-data/property-detail-documents";
import { openPropertyPhotosPdfPrint } from "../../lib/app-data/property-photos-pdf";

/**
 * Case Study.html photo groups — sections always listed; empty groups hide tiles
 * (no decorative placeholders).
 */
const MAIN_PHOTO_RE = /رئيس|main|primary/i;
const EXTERIOR_PHOTO_RE = /خارج|واجهة|front|exterior|sides?/i;
const INTERIOR_PHOTO_RE = /داخل|interior|inside|floor|أرض/i;
const METER_PHOTO_RE = /كهرب|elec|عداد/i;
const WELL_PHOTO_RE = /بئر|آبار|well/i;
const ANNEX_PHOTO_RE = /مشتمل|ملحق|annex|مرافق/i;

const HTML_PHOTO_GROUPS: {
  title: string;
  source: string;
  match: (photo: PropertyDetailDocumentEntry) => boolean;
}[] = [
  {
    title: "صورة العقار الرئيسية",
    source: "المعاين",
    match: (p) => MAIN_PHOTO_RE.test(`${p.name} ${p.fileName}`),
  },
  {
    title: "صور العقار الخارجية",
    source: "المعاين",
    match: (p) => EXTERIOR_PHOTO_RE.test(`${p.name} ${p.fileName}`),
  },
  {
    title: "صور العقار من الداخل",
    source: "المعاين",
    match: (p) => INTERIOR_PHOTO_RE.test(`${p.name} ${p.fileName}`),
  },
  {
    title: "صور عدادات الكهرباء",
    source: "المعاين",
    match: (p) => METER_PHOTO_RE.test(`${p.name} ${p.fileName}`),
  },
  {
    title: "صور الآبار",
    source: "المكتب الهندسي",
    match: (p) => WELL_PHOTO_RE.test(`${p.name} ${p.fileName}`),
  },
  {
    title: "صور المشتملات",
    source: "المعاين",
    match: (p) => ANNEX_PHOTO_RE.test(`${p.name} ${p.fileName}`),
  },
];

function PhotoTile({ photo }: { photo: PropertyDetailDocumentEntry }) {
  const canOpen = Boolean(photo.dataUrl);
  return (
    <div>
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
    </div>
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
    };
  });

  const leftovers = photos.filter((p) => !used.has(p.id));
  if (leftovers.length > 0) {
    groups.push({
      title: "صور أخرى",
      source: leftovers[0]?.source || "—",
      items: leftovers,
    });
  }

  // Only sections that actually have photos.
  return groups.filter((g) => g.items.length > 0);
}

/**
 * Photos tab — real attachments only (no empty-slot placeholders).
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

  const downloadable = photos.filter((p) => p.dataUrl);

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="text-[11.5px] text-text-3">
          {photos.length > 0
            ? `إجمالي ${photos.length} صورة`
            : "لا توجد صور مرفوعة بعد"}
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

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-10 text-center text-[13px] text-text-3">
          بانتظار رفع صور المعاينة من المعاين أو الطرف المختص.
        </div>
      ) : (
        groups.map((group) => (
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
        ))
      )}

      <InfoBox icon="ℹ">
        الصور مرفوعة من النظام بواسطة المعاين أو الطرف المختص — هذا التبويب
        للاستعراض فقط.
      </InfoBox>
    </>
  );
}
