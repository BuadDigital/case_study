"use client";

import { useEffect, useMemo, useState } from "react";
import { Spinner, cn, useToast } from "@platform/ui-kit";
import {
  ELECTRICITY_PHOTO_RE,
  EXTERIOR_PHOTO_RE,
  INTERIOR_PHOTO_RE,
  REPORT_PHOTO_LIMIT,
  WATER_PHOTO_RE,
  photoMarkId,
  propertyPhotoRole,
  reportPhotoIds,
  type PropertyPhotoMark,
  type PropertyPhotoMarks,
} from "@platform/app-shared/app-data/property-detail-document-types";
import {
  isInspectorGlancePhoto,
  openPropertyDetailDocumentPreview,
  orderPropertyPhotos,
  pickInspectorPrimaryPhoto,
  type PropertyDetailDocumentEntry,
} from "../../lib/app-data/property-detail-documents";
import {
  getInspectorPhotoDataUrl,
  prefetchInspectorPhoto,
} from "../../lib/app-data/inspector-photo-upload";
import { openPropertyPhotosPdfPrint } from "../../lib/app-data/property-photos-pdf";

/**
 * Case Study.html photo groups — sections always listed; empty groups hide tiles
 * (no decorative placeholders).
 */
const WELL_PHOTO_RE = /بئر|آبار|well/i;
const ANNEX_PHOTO_RE = /مشتمل|ملحق|annex|مرافق/i;

/** A photo's group: the specialist's mark first, its name only when it holds no mark. */
type PhotoGroupContext = {
  primaryId: string | null;
  marks: PropertyPhotoMarks | null | undefined;
};
const byName =
  (pattern: RegExp) =>
  (photo: PropertyDetailDocumentEntry, { marks }: PhotoGroupContext) =>
    !propertyPhotoRole(photo, marks) && pattern.test(`${photo.name} ${photo.fileName}`);
const byRole =
  (role: "electricity" | "water", pattern: RegExp) =>
  (photo: PropertyDetailDocumentEntry, context: PhotoGroupContext) =>
    propertyPhotoRole(photo, context.marks) === role || byName(pattern)(photo, context);

const HTML_PHOTO_GROUPS: {
  title: string;
  source: string;
  match: (photo: PropertyDetailDocumentEntry, context: PhotoGroupContext) => boolean;
}[] = [
  {
    title: "صورة العقار الرئيسية",
    source: "المعاين",
    match: (p, { primaryId }) => p.id === primaryId,
  },
  {
    title: "صور العقار الخارجية",
    source: "المعاين",
    match: byName(EXTERIOR_PHOTO_RE),
  },
  {
    title: "صور العقار من الداخل",
    source: "المعاين",
    match: byName(INTERIOR_PHOTO_RE),
  },
  {
    title: "صور عدادات الكهرباء",
    source: "المعاين",
    match: byRole("electricity", ELECTRICITY_PHOTO_RE),
  },
  {
    title: "صور عدادات الماء",
    source: "المعاين",
    match: byRole("water", WATER_PHOTO_RE),
  },
  {
    title: "صور الآبار",
    source: "المكتب الهندسي",
    match: byName(WELL_PHOTO_RE),
  },
  {
    title: "صور المشتملات",
    source: "المعاين",
    match: byName(ANNEX_PHOTO_RE),
  },
];

const PHOTO_MARK_ACTIONS: { mark: PropertyPhotoMark; icon: string; label: string }[] = [
  { mark: "main", icon: "ti-home", label: "الصورة الرئيسية" },
  { mark: "electricity", icon: "ti-bolt", label: "عداد كهرباء" },
  { mark: "water", icon: "ti-droplet", label: "عداد ماء" },
  { mark: "report", icon: "ti-printer", label: "في التقرير" },
];

function photoHoldsMark(
  photo: PropertyDetailDocumentEntry,
  marks: PropertyPhotoMarks | null | undefined,
  mark: PropertyPhotoMark,
): boolean {
  if (mark === "report") return Boolean(marks?.report.includes(photoMarkId(photo)));
  return propertyPhotoRole(photo, marks) === mark;
}

/**
 * The marks on one photo: a badge for everyone who opens the tab and, for the specialist, the
 * icons that set them.
 *
 * How it works: the icons sit beside the preview button, not inside it, so a press never opens
 * the preview. Edge cases: only the inspector's photos can be marked; the deed images in «صور أخرى»
 * show nothing.
 */
function PhotoMarks({
  photo,
  marks,
  onToggleMark,
}: {
  photo: PropertyDetailDocumentEntry;
  marks: PropertyPhotoMarks | null | undefined;
  onToggleMark?: (photo: PropertyDetailDocumentEntry, mark: PropertyPhotoMark) => void;
}) {
  const held = PHOTO_MARK_ACTIONS.filter((action) => photoHoldsMark(photo, marks, action.mark));
  const markable = onToggleMark && photoMarkId(photo) && isInspectorGlancePhoto(photo);
  return (
    <>
      {held.length > 0 ? (
        <div className="pointer-events-none absolute start-1 top-1 flex flex-wrap gap-1">
          {held.map((action) => (
            <span
              key={action.mark}
              className="inline-flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10.5px] font-bold text-white"
            >
              <i className={cn("ti text-[12px] leading-none", action.icon)} aria-hidden />
              {action.label}
            </span>
          ))}
        </div>
      ) : null}
      {markable ? (
        <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-black/45 p-1">
          {PHOTO_MARK_ACTIONS.map((action) => {
            const active = held.includes(action);
            return (
              <button
                key={action.mark}
                type="button"
                title={action.label}
                aria-label={action.label}
                aria-pressed={active}
                onClick={() => onToggleMark(photo, action.mark)}
                className={cn(
                  "grid size-7 cursor-pointer place-items-center rounded border-0 p-0 text-[15px] leading-none",
                  active ? "bg-primary text-white" : "bg-surface/90 text-primary hover:bg-surface",
                )}
              >
                <i className={cn("ti", action.icon)} aria-hidden />
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

function PhotoTile({
  photo,
  gallery,
  marks,
  onToggleMark,
}: {
  photo: PropertyDetailDocumentEntry;
  gallery: PropertyDetailDocumentEntry[];
  marks: PropertyPhotoMarks | null | undefined;
  onToggleMark?: (photo: PropertyDetailDocumentEntry, mark: PropertyPhotoMark) => void;
}) {
  const handle = photo.inspectionPhoto;
  const [dataUrl, setDataUrl] = useState(
    () =>
      photo.dataUrl ??
      (handle ? getInspectorPhotoDataUrl(handle.taskId, handle.photoRef) : undefined),
  );

  // New photo source: take its own or the cached copy during render — only a fetch waits for the effect.
  const [shownFor, setShownFor] = useState<readonly unknown[] | null>(null);
  const source = [
    photo.dataUrl,
    handle?.taskId,
    handle?.photoRef,
    handle?.attachment,
    handle?.attachment.attachmentId,
  ] as const;
  if (!shownFor || source.some((value, i) => value !== shownFor[i])) {
    setShownFor(source);
    if (photo.dataUrl) {
      setDataUrl(photo.dataUrl);
    } else if (handle?.attachment.attachmentId) {
      const cached = getInspectorPhotoDataUrl(handle.taskId, handle.photoRef);
      if (cached) setDataUrl(cached);
    }
  }

  useEffect(() => {
    if (photo.dataUrl) return;
    if (!handle?.attachment.attachmentId) return;
    if (getInspectorPhotoDataUrl(handle.taskId, handle.photoRef)) return;
    let cancelled = false;
    void prefetchInspectorPhoto(handle.taskId, handle.photoRef, handle.attachment).then(
      (url) => {
        if (!cancelled && url) setDataUrl(url);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [
    photo.dataUrl,
    handle?.taskId,
    handle?.photoRef,
    handle?.attachment,
    handle?.attachment.attachmentId,
  ]);

  const canOpen = Boolean(dataUrl);
  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          "relative block w-full overflow-hidden rounded border border-border bg-surface-2 p-0",
          canOpen ? "cursor-pointer" : "cursor-default opacity-80",
        )}
        disabled={!canOpen}
        onClick={() =>
          openPropertyDetailDocumentPreview(
            { ...photo, dataUrl },
            gallery.map((item) =>
              item.id === photo.id ? { ...item, dataUrl } : item,
            ),
          )
        }
        aria-label={photo.name}
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={photo.name}
            className="block h-auto w-full"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center text-text-3">
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
      <PhotoMarks photo={photo} marks={marks} onToggleMark={onToggleMark} />
    </div>
  );
}

/**
 * The tab's sections, each in the automatic order.
 *
 * How it works: «صورة العقار الرئيسية» holds the photo the basic tab, the map and the report open
 * on; every other photo goes to the first section that matches. Edge cases: a section with no photo
 * is left out, and what no section takes lands in «صور أخرى».
 */
export function buildDisplayGroups(
  source: PropertyDetailDocumentEntry[],
  marks?: PropertyPhotoMarks | null,
) {
  const photos = orderPropertyPhotos(source, marks);
  const context: PhotoGroupContext = {
    primaryId: pickInspectorPrimaryPhoto(photos, marks)?.id ?? null,
    marks,
  };
  const used = new Set<string>();
  const groups = HTML_PHOTO_GROUPS.map((def) => {
    const items = photos.filter((p) => {
      if (used.has(p.id)) return false;
      if (!def.match(p, context)) return false;
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
  marks,
  onToggleMark,
}: {
  photos: PropertyDetailDocumentEntry[];
  title?: string;
  /** The specialist's marks; each marked photo shows a badge. */
  marks?: PropertyPhotoMarks | null;
  /** Present for the specialist: shows the icons that set the marks. */
  onToggleMark?: (id: string, mark: PropertyPhotoMark, liveIds: readonly string[]) => void;
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => buildDisplayGroups(photos, marks), [photos, marks]);
  const ordered = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const liveIds = useMemo(() => photos.map(photoMarkId).filter(Boolean), [photos]);

  const downloadable = ordered.filter((p) => p.dataUrl);
  const toggleMark = onToggleMark
    ? (photo: PropertyDetailDocumentEntry, mark: PropertyPhotoMark) =>
        onToggleMark(photoMarkId(photo), mark, liveIds)
    : undefined;

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="text-[11.5px] text-text-3">
          {photos.length > 0
            ? `إجمالي ${photos.length} صورة`
            : "لا توجد صور مرفوعة بعد"}
          {onToggleMark && photos.length > 0 ? (
            <span className="ms-3 font-bold text-text-2">
              صور التقرير {reportPhotoIds(photos, marks).length} / {REPORT_PHOTO_LIMIT}
            </span>
          ) : null}
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
            <div className="grid grid-cols-[repeat(auto-fill,198px)] items-start gap-2">
              {group.items.map((photo) => (
                <PhotoTile
                  key={photo.id}
                  photo={photo}
                  gallery={ordered}
                  marks={marks}
                  onToggleMark={toggleMark}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}
