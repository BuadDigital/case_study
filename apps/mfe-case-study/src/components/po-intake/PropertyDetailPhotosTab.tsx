"use client";

import { useMemo, useState } from "react";
import { Spinner, cn, useToast } from "@platform/ui-kit";
import {
  ELECTRICITY_PHOTO_RE,
  EXTERIOR_PHOTO_RE,
  INTERIOR_PHOTO_RE,
  MOVABLES_PHOTO_RE,
  REPORT_MOVABLES_PHOTO_LIMIT,
  WATER_PHOTO_RE,
  movablesBoardIds,
  photoMarkId,
  placeOnReportBoard,
  propertyPhotoRole,
  reportPhotoIds,
  withMovablesBoard,
  withReportBoard,
  type PropertyPhotoMarks,
  type PropertyPhotoRole,
  type ReportBoardSource,
} from "@platform/app-shared/app-data/property-detail-document-types";
import {
  isInspectorGlancePhoto,
  openPropertyDetailDocumentPreview,
  orderPropertyPhotos,
  pickInspectorPrimaryPhoto,
  type PropertyDetailDocumentEntry,
} from "../../lib/app-data/property-detail-documents";
import { openPropertyPhotosPdfPrint } from "../../lib/app-data/property-photos-pdf";
import {
  PhotoPlaceholderIcon,
  PropertyReportPhotoBoard,
  startPhotoDrag,
  usePhotoDataUrl,
  type PhotoBoardDrop,
  type PhotoBoardKey,
  type PhotoBoardSelection,
} from "./PropertyReportPhotoBoard";

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

/** The badges a marked photo shows: the main photo (report slot 1) and the movables. */
const ROLE_BADGES: Partial<Record<PropertyPhotoRole, { icon: string; label: string }>> = {
  main: { icon: "ti-home", label: "الرئيسية" },
  movables: { icon: "ti-armchair", label: "منقولات" },
};

/** One change to the marks, saved by the owner. */
type PhotoMarksChange = (update: (marks: PropertyPhotoMarks) => PropertyPhotoMarks) => void;

/** Where an inspector photo stands on the two boards, for its icons. */
type PhotoBoardState = {
  /** Its slot on the report board, else null. */
  reportSlot: number | null;
  /** Its slot on the movables board, else null. */
  movablesSlot: number | null;
};

/** The specialist's board actions a photo's icons call. */
type PhotoBoardActions = {
  toggleReport: (id: string) => void;
  toggleMovables: (id: string) => void;
};

const GLASS_CHIP = "rounded-full bg-black/45 text-white backdrop-blur-sm";
const GLASS_BUTTON =
  "grid size-7 cursor-pointer place-items-center rounded-full border-0 p-0 text-[15px] leading-none backdrop-blur-sm transition-colors";
const glassButtonTone = (active: boolean) =>
  active ? "bg-primary/90 text-white" : "bg-white/20 text-white hover:bg-white/35";

/**
 * The marks on one photo: a badge for everyone who opens the tab and, for the specialist, the two
 * icons that choose it (2026-11-03 ruling: the meters are no longer marked).
 *
 * How it works: the report and movables icons put the photo on, or take it off, their board (into
 * the tapped slot when one is selected, else the next free one); a photo on the report board shows
 * its slot number on the report icon. Edge cases: only the inspector's photos can be chosen; the
 * deed images in «صور أخرى» show nothing.
 */
function PhotoMarks({
  photo,
  marks,
  board,
  actions,
}: {
  photo: PropertyDetailDocumentEntry;
  marks: PropertyPhotoMarks | null | undefined;
  board: PhotoBoardState | undefined;
  actions?: PhotoBoardActions;
}) {
  const id = photoMarkId(photo);
  const role = propertyPhotoRole(photo, marks);
  const held = role ? ROLE_BADGES[role] : undefined;
  const editable = Boolean(actions && id && board);
  // The report icon shows the specialist the slot; the badge is for the rest.
  const reportSlot = !editable ? (board?.reportSlot ?? null) : null;
  const chip = cn(GLASS_CHIP, "inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-bold");
  const onReport = board?.reportSlot != null;
  const reportLabel = onReport
    ? `في التقرير: خانة ${(board?.reportSlot ?? 0) + 1} — إزالة`
    : "إضافة إلى التقرير";
  const onMovables = board?.movablesSlot != null;
  return (
    <>
      {held || reportSlot != null ? (
        <div className="pointer-events-none absolute start-1 top-1 flex flex-wrap gap-1">
          {held ? (
            <span className={chip}>
              <i className={cn("ti text-[12px] leading-none", held.icon)} aria-hidden />
              {held.label}
            </span>
          ) : null}
          {reportSlot != null ? (
            <span className={chip}>
              <i className="ti ti-file-text text-[12px] leading-none" aria-hidden />
              في التقرير · {reportSlot + 1}
            </span>
          ) : null}
        </div>
      ) : null}
      {editable && actions ? (
        <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 rounded-b bg-gradient-to-t from-black/60 to-transparent px-1 pb-1 pt-5">
          <button
            type="button"
            title={onMovables ? "في صور المنقولات — إزالة" : "إضافة إلى صور المنقولات"}
            aria-label={onMovables ? "في صور المنقولات — إزالة" : "إضافة إلى صور المنقولات"}
            aria-pressed={onMovables}
            onClick={() => actions.toggleMovables(id)}
            className={cn(GLASS_BUTTON, glassButtonTone(onMovables))}
          >
            <i className="ti ti-armchair" aria-hidden />
          </button>
          <button
            type="button"
            title={reportLabel}
            aria-label={reportLabel}
            aria-pressed={onReport}
            onClick={() => actions.toggleReport(id)}
            className={cn(GLASS_BUTTON, glassButtonTone(onReport))}
          >
            {onReport ? (
              <span className="text-[12px] font-bold">{(board?.reportSlot ?? 0) + 1}</span>
            ) : (
              <i className="ti ti-file-plus" aria-hidden />
            )}
          </button>
        </div>
      ) : null}
    </>
  );
}

function PhotoTile({
  photo,
  gallery,
  marks,
  board,
  actions,
}: {
  photo: PropertyDetailDocumentEntry;
  gallery: PropertyDetailDocumentEntry[];
  marks: PropertyPhotoMarks | null | undefined;
  board: PhotoBoardState | undefined;
  actions?: PhotoBoardActions;
}) {
  const dataUrl = usePhotoDataUrl(photo);
  const id = photoMarkId(photo);
  const draggable = Boolean(actions && board && id);
  const canOpen = Boolean(dataUrl);
  return (
    <div
      className="relative"
      draggable={draggable}
      onDragStart={draggable ? (event) => startPhotoDrag(event, id) : undefined}
    >
      <button
        type="button"
        className={cn(
          "relative block aspect-[4/3] w-full overflow-hidden rounded border border-border bg-surface-2 p-0",
          canOpen ? "cursor-pointer" : "cursor-default opacity-80",
          draggable && "active:cursor-grabbing",
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
            draggable={false}
            className="block h-full w-full object-cover"
          />
        ) : (
          <PhotoPlaceholderIcon />
        )}
      </button>
      <PhotoMarks photo={photo} marks={marks} board={board} actions={actions} />
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
 * Photos tab — the specialist's boards first (the report's photos, then the movables section when
 * the inspector found movables), then the inspector's photos in their groups.
 *
 * How it works: the boards start empty and the specialist always chooses (2026-11-03 ruling): a
 * photo's icon puts it in the next free slot, or in the tapped one; dragging mostly reorders the
 * chosen photos. Slot 1 is the property's main photo, and the report prints the board as it
 * stands. Edge cases: a full board refuses another photo and says why; without `onChangeMarks` the
 * boards are read-only.
 */
export function PropertyDetailPhotosTab({
  photos,
  title = "صور العقار",
  marks,
  reportLimit = 24,
  movablesPresent = false,
  showReportBoard = true,
  onChangeMarks,
}: {
  photos: PropertyDetailDocumentEntry[];
  title?: string;
  /** How many photos the report prints («صفحات الصور» in the settings). */
  reportLimit?: number;
  /** The inspector answered «يوجد منقولات: نعم»: the movables board and report section open. */
  movablesPresent?: boolean;
  /** The boards belong to the property's photos tab; a glance elsewhere shows the photos only. */
  showReportBoard?: boolean;
  /** The specialist's marks; each marked photo shows a badge. */
  marks?: PropertyPhotoMarks | null;
  /** Present for the specialist: shows the icons and lets the boards be arranged. */
  onChangeMarks?: (
    photos: readonly PropertyDetailDocumentEntry[],
    update: (marks: PropertyPhotoMarks) => PropertyPhotoMarks,
  ) => void;
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<PhotoBoardSelection>(null);
  const groups = useMemo(() => buildDisplayGroups(photos, marks), [photos, marks]);
  const ordered = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const inspector = useMemo(() => photos.filter(isInspectorGlancePhoto), [photos]);
  const photosById = useMemo(
    () => new Map(inspector.map((photo) => [photoMarkId(photo), photo] as const)),
    [inspector],
  );
  const reportIds = useMemo(() => reportPhotoIds(photos, marks), [photos, marks]);
  const movablesIds = useMemo(() => movablesBoardIds(photos, marks), [photos, marks]);
  const showMovables = movablesPresent || movablesIds.length > 0;

  const downloadable = ordered.filter((p) => p.dataUrl);
  const changeMarks: PhotoMarksChange | undefined = onChangeMarks
    ? (update) => onChangeMarks(photos, update)
    : undefined;

  const boardIds = (board: PhotoBoardKey) => (board === "report" ? reportIds : movablesIds);

  /** Puts `source` on `target` of `board` and saves, or says why it cannot. */
  const place = (board: PhotoBoardKey, source: ReportBoardSource, target: number) => {
    if (!changeMarks) return;
    setSelection(null);
    const limit = board === "report" ? reportLimit : REPORT_MOVABLES_PHOTO_LIMIT;
    const next = placeOnReportBoard(boardIds(board), source, target, limit);
    if (!Array.isArray(next)) {
      showToast(next.refused, "error");
      return;
    }
    changeMarks((current) =>
      board === "report" ? withReportBoard(current, next) : withMovablesBoard(current, next),
    );
  };

  /** A drop from a photo, this board's slot, or the other board's slot. */
  const drop = (board: PhotoBoardKey, from: PhotoBoardDrop, target: number) => {
    if ("photoId" in from) return place(board, { photoId: from.photoId }, target);
    if (from.board === board) return place(board, { slot: from.slot }, target);
    const id = boardIds(from.board)[from.slot];
    if (id) place(board, { photoId: id }, target);
  };

  const tap = (board: PhotoBoardKey, index: number) => {
    if (!selection) {
      if (boardIds(board)[index]) setSelection({ board, index });
      return;
    }
    if (selection.board === board && selection.index === index) {
      setSelection(null);
      return;
    }
    drop(board, { board: selection.board, slot: selection.index }, index);
  };

  const remove = (board: PhotoBoardKey, index: number) => {
    if (!changeMarks) return;
    setSelection(null);
    const next = boardIds(board).filter((_, i) => i !== index);
    changeMarks((current) =>
      board === "report" ? withReportBoard(current, next) : withMovablesBoard(current, next),
    );
  };

  const toggleOn = (board: PhotoBoardKey, id: string) => {
    const index = boardIds(board).indexOf(id);
    if (index >= 0) return remove(board, index);
    const target =
      selection?.board === board ? selection.index : boardIds(board).length;
    place(board, { photoId: id }, target);
  };

  const actions: PhotoBoardActions | undefined = changeMarks
    ? {
        toggleReport: (id) => toggleOn("report", id),
        toggleMovables: (id) => toggleOn("movables", id),
      }
    : undefined;

  const boardStates = useMemo(() => {
    const states = new Map<string, PhotoBoardState>();
    for (const photo of inspector) {
      const id = photoMarkId(photo);
      if (!id) continue;
      const reportSlot = reportIds.indexOf(id);
      const movablesSlot = movablesIds.indexOf(id);
      states.set(photo.id, {
        reportSlot: reportSlot >= 0 ? reportSlot : null,
        movablesSlot: movablesSlot >= 0 ? movablesSlot : null,
      });
    }
    return states;
  }, [inspector, reportIds, movablesIds]);

  const boards = showReportBoard && inspector.length > 0;
  const hint =
    "اختر الصور من صور المعاين بأيقونة التقرير، فتأخذ أول خانة فارغة؛ الخانة 1 هي الصورة الرئيسية. رتّبها بالسحب بين الخانات، أو اضغط خانة ثم خانة أخرى. الضغط المزدوج يفتح الصورة. التقرير يطبع ما تختاره فقط.";

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

      {boards ? (
        <PropertyReportPhotoBoard
          board="report"
          title="صور التقرير — ترتيب الأخصائي"
          hint={hint}
          ids={reportIds}
          limit={reportLimit}
          photosById={photosById}
          gallery={ordered}
          editable={Boolean(changeMarks)}
          firstSlotTag="الرئيسية"
          selection={selection}
          onTap={(index) => tap("report", index)}
          onDrop={(from, index) => drop("report", from, index)}
          onRemove={(index) => remove("report", index)}
        />
      ) : null}

      {boards && showMovables ? (
        <PropertyReportPhotoBoard
          board="movables"
          title="صور المنقولات — قسم في التقرير"
          hint="المعاين أفاد بوجود منقولات: اختر صورها بأيقونة المنقولات، وتُطبع في قسم «صور المنقولات» بالتقرير."
          ids={movablesIds}
          limit={REPORT_MOVABLES_PHOTO_LIMIT}
          photosById={photosById}
          gallery={ordered}
          editable={Boolean(changeMarks)}
          selection={selection}
          onTap={(index) => tap("movables", index)}
          onDrop={(from, index) => drop("movables", from, index)}
          onRemove={(index) => remove("movables", index)}
        />
      ) : null}

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-10 text-center text-[13px] text-text-3">
          بانتظار رفع صور المعاينة من المعاين أو الطرف المختص.
        </div>
      ) : (
        <>
          {boards ? (
            <div className="mb-2 text-[13px] font-bold text-heading">صور المعاين</div>
          ) : null}
          {groups.map((group) => (
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
                    board={boards ? boardStates.get(photo.id) : undefined}
                    actions={actions}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
