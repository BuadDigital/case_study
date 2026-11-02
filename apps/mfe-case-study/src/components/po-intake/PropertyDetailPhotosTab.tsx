"use client";

import { useEffect, useMemo, useState } from "react";
import { Spinner, cn, useToast } from "@platform/ui-kit";
import {
  ELECTRICITY_PHOTO_RE,
  EXTERIOR_PHOTO_RE,
  INTERIOR_PHOTO_RE,
  MOVABLES_PHOTO_RE,
  REPORT_PHOTO_SECTIONS,
  WATER_PHOTO_RE,
  isAutomaticReportPhoto,
  photoMarkId,
  propertyPhotoRole,
  reportPhotoIds,
  reportPhotoSection,
  reportPhotoSectionLabel,
  setReportPhotoSection,
  suggestedReportSection,
  togglePropertyPhotoMark,
  type PropertyPhotoMarks,
  type PropertyPhotoRole,
  type ReportPhotoSection,
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
  (role: Exclude<PropertyPhotoRole, "main">, pattern: RegExp) =>
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
    title: "صور المنقولات",
    source: "المعاين",
    match: byRole("movables", MOVABLES_PHOTO_RE),
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

const PHOTO_ROLE_ACTIONS: { role: PropertyPhotoRole; icon: string; label: string }[] = [
  { role: "main", icon: "ti-home", label: "الصورة الرئيسية" },
  { role: "electricity", icon: "ti-bolt", label: "عداد كهرباء" },
  { role: "water", icon: "ti-droplet", label: "عداد ماء" },
  { role: "movables", icon: "ti-armchair", label: "منقولات" },
];

/** Where a photo stands in the report, worked out once for the whole tab. */
type PhotoReportState = {
  /** The report prints it: picked, or taken by itself. */
  printed: boolean;
  /** The main photo or a marked meter: the report takes it without a pick. */
  automatic: boolean;
  section: ReportPhotoSection;
  suggested: ReportPhotoSection;
};

/** What a press on a photo's icons changes in the marks. */
type PhotoMarksChange = (update: (marks: PropertyPhotoMarks) => PropertyPhotoMarks) => void;

const GLASS_CHIP = "rounded-full bg-black/45 text-white backdrop-blur-sm";
const GLASS_BUTTON =
  "grid size-7 cursor-pointer place-items-center rounded-full border-0 p-0 text-[15px] leading-none backdrop-blur-sm transition-colors";
const glassButtonTone = (active: boolean) =>
  active ? "bg-primary/90 text-white" : "bg-white/20 text-white hover:bg-white/35";

/**
 * The report icon and its section menu: «1 خارجية», «2 داخلية», «3 أخرى», «إزالة من التقرير».
 *
 * How it works: a picked photo shows its section number in place of the icon; the menu marks the
 * section the inspector's category suggests. Edge cases: the main photo and the meters print by
 * themselves, so their icon only says so.
 */
function ReportSectionButton({
  id,
  report,
  onChange,
}: {
  id: string;
  report: PhotoReportState;
  onChange: PhotoMarksChange;
}) {
  const [open, setOpen] = useState(false);
  const picked = report.printed && !report.automatic;
  const label = report.automatic
    ? "في التقرير تلقائياً"
    : picked
      ? `في التقرير: ${reportPhotoSectionLabel(report.section)}`
      : "إضافة إلى التقرير";
  const choose = (section: ReportPhotoSection | null) => {
    setOpen(false);
    onChange((marks) => setReportPhotoSection(marks, id, section));
  };
  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={report.printed}
        aria-expanded={report.automatic ? undefined : open}
        disabled={report.automatic}
        onClick={() => setOpen((value) => !value)}
        className={cn(GLASS_BUTTON, glassButtonTone(report.printed), report.automatic && "cursor-default")}
      >
        {picked ? (
          <span className="text-[13px] font-bold">{report.section}</span>
        ) : (
          <i className="ti ti-file-text" aria-hidden />
        )}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute bottom-full end-0 z-10 mb-1 flex min-w-[124px] flex-col overflow-hidden rounded-lg border border-border bg-surface py-1 text-[11.5px] shadow-lg"
        >
          {REPORT_PHOTO_SECTIONS.map(({ section, label: name }) => {
            const current = picked && report.section === section;
            return (
              <button
                key={section}
                type="button"
                role="menuitemradio"
                aria-checked={current}
                onClick={() => choose(section)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 border-0 bg-transparent px-2.5 py-1.5 text-start text-text-1 hover:bg-surface-2",
                  current && "font-bold text-primary",
                )}
              >
                <span className="grid size-5 place-items-center rounded-full bg-surface-2 text-[11px] font-bold">
                  {section}
                </span>
                {name}
                {section === report.suggested ? (
                  <span className="ms-auto text-[10px] font-normal text-text-3">مقترح</span>
                ) : null}
              </button>
            );
          })}
          {picked ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => choose(null)}
              className="cursor-pointer border-0 border-t border-border bg-transparent px-2.5 py-1.5 text-start text-danger hover:bg-surface-2"
            >
              إزالة من التقرير
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
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
  report,
  onChange,
}: {
  photo: PropertyDetailDocumentEntry;
  marks: PropertyPhotoMarks | null | undefined;
  report: PhotoReportState | undefined;
  onChange?: PhotoMarksChange;
}) {
  const id = photoMarkId(photo);
  const role = propertyPhotoRole(photo, marks);
  const held = PHOTO_ROLE_ACTIONS.find((action) => action.role === role);
  const picked = report && report.printed && !report.automatic ? report : null;
  const chip = cn(GLASS_CHIP, "inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-bold");
  return (
    <>
      {held || picked ? (
        <div className="pointer-events-none absolute start-1 top-1 flex flex-wrap gap-1">
          {held ? (
            <span className={chip}>
              <i className={cn("ti text-[12px] leading-none", held.icon)} aria-hidden />
              {held.label}
            </span>
          ) : null}
          {picked ? (
            <span className={chip}>
              <i className="ti ti-file-text text-[12px] leading-none" aria-hidden />
              تقرير · {reportPhotoSectionLabel(picked.section)}
            </span>
          ) : null}
        </div>
      ) : null}
      {onChange && id && report ? (
        <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 rounded-b bg-gradient-to-t from-black/60 to-transparent px-1 pb-1 pt-5">
          {PHOTO_ROLE_ACTIONS.map((action) => (
            <button
              key={action.role}
              type="button"
              title={action.label}
              aria-label={action.label}
              aria-pressed={action.role === role}
              onClick={() => onChange((current) => togglePropertyPhotoMark(current, id, action.role))}
              className={cn(GLASS_BUTTON, glassButtonTone(action.role === role))}
            >
              <i className={cn("ti", action.icon)} aria-hidden />
            </button>
          ))}
          <ReportSectionButton id={id} report={report} onChange={onChange} />
        </div>
      ) : null}
    </>
  );
}

function PhotoTile({
  photo,
  gallery,
  marks,
  report,
  onChange,
}: {
  photo: PropertyDetailDocumentEntry;
  gallery: PropertyDetailDocumentEntry[];
  marks: PropertyPhotoMarks | null | undefined;
  report: PhotoReportState | undefined;
  onChange?: PhotoMarksChange;
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
          "relative block aspect-[4/3] w-full overflow-hidden rounded border border-border bg-surface-2 p-0",
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
            className="block h-full w-full object-cover"
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
      <PhotoMarks photo={photo} marks={marks} report={report} onChange={onChange} />
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
 * Each inspector photo's place in the report, and the counter's numbers.
 *
 * How it works: one pass over the report's photos, so every tile reads its state without recounting.
 * Edge cases: before any photo is picked the report takes the first ones in its order, so the
 * counter says «تلقائي»; the main photo and the meters still show they print by themselves.
 */
function photoReportStates(
  photos: PropertyDetailDocumentEntry[],
  marks: PropertyPhotoMarks | null | undefined,
) {
  const printed = reportPhotoIds(photos, marks);
  const byPhoto = new Map<string, PhotoReportState>();
  const counts = new Map<ReportPhotoSection, number>();
  for (const photo of photos.filter(isInspectorGlancePhoto)) {
    const automatic = isAutomaticReportPhoto(photos, photo, marks);
    const section = reportPhotoSection(photo, marks);
    const isPrinted = automatic || printed.includes(photoMarkId(photo));
    if (printed.includes(photoMarkId(photo))) counts.set(section, (counts.get(section) ?? 0) + 1);
    byPhoto.set(photo.id, {
      printed: isPrinted,
      automatic,
      section,
      suggested: suggestedReportSection(photo),
    });
  }
  const summary = REPORT_PHOTO_SECTIONS.map(
    ({ section, label }) => `${label} ${counts.get(section) ?? 0}`,
  ).join(" · ");
  return { byPhoto, picked: printed.length, summary };
}

/**
 * Photos tab — real attachments only (no empty-slot placeholders).
 */
export function PropertyDetailPhotosTab({
  photos,
  title = "صور العقار",
  marks,
  reportLimit = 24,
  onChangeMarks,
}: {
  photos: PropertyDetailDocumentEntry[];
  title?: string;
  /** How many photos the report prints («صفحات الصور» in the settings). */
  reportLimit?: number;
  /** The specialist's marks; each marked photo shows a badge. */
  marks?: PropertyPhotoMarks | null;
  /** Present for the specialist: shows the icons that set the marks. */
  onChangeMarks?: (
    photos: readonly PropertyDetailDocumentEntry[],
    update: (marks: PropertyPhotoMarks) => PropertyPhotoMarks,
  ) => void;
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => buildDisplayGroups(photos, marks), [photos, marks]);
  const ordered = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const report = useMemo(() => photoReportStates(photos, marks), [photos, marks]);

  const downloadable = ordered.filter((p) => p.dataUrl);
  const changeMarks: PhotoMarksChange | undefined = onChangeMarks
    ? (update) => onChangeMarks(photos, update)
    : undefined;

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="text-[11.5px] text-text-3">
          {photos.length > 0
            ? `إجمالي ${photos.length} صورة`
            : "لا توجد صور مرفوعة بعد"}
          {onChangeMarks && photos.length > 0 ? (
            <span className="ms-3 font-bold text-text-2">
              {report.picked > 0
                ? `صور التقرير ${report.picked} / ${reportLimit} — ${report.summary}`
                : `صور التقرير: تلقائي (أول ${reportLimit} صورة)`}
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
            <div className="grid grid-cols-[repeat(auto-fill,minmax(198px,1fr))] gap-2">
              {group.items.map((photo) => (
                <PhotoTile
                  key={photo.id}
                  photo={photo}
                  gallery={ordered}
                  marks={marks}
                  report={report.byPhoto.get(photo.id)}
                  onChange={changeMarks}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}
