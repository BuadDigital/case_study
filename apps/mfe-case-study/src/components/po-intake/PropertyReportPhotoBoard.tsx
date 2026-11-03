"use client";

import { useEffect, useState, type DragEvent } from "react";
import { cn } from "@platform/ui-kit";
import {
  REPORT_PHOTOS_PER_PAGE,
  type PropertyDetailDocumentEntry,
} from "@platform/app-shared/app-data/property-detail-document-types";
import { openPropertyDetailDocumentPreview } from "../../lib/app-data/property-detail-documents";
import {
  getInspectorPhotoDataUrl,
  prefetchInspectorPhoto,
} from "../../lib/app-data/inspector-photo-upload";

/** The two boards of the photos tab: the report's photos and the movables section. */
export type PhotoBoardKey = "report" | "movables";

/** A slot the specialist tapped, waiting for a second tap or a photo's «add» button. */
export type PhotoBoardSelection = { board: PhotoBoardKey; index: number } | null;

/** What a drag carries: an inspector photo, or a board's slot. */
const PHOTO_DRAG_TYPE = "application/x-ejadah-photo";
const SLOT_DRAG_TYPE = "application/x-ejadah-slot";

export type PhotoBoardDrop =
  | { photoId: string }
  | { board: PhotoBoardKey; slot: number };

/** Starts dragging an inspector photo toward a board. */
export function startPhotoDrag(event: DragEvent, photoId: string): void {
  event.dataTransfer.setData(PHOTO_DRAG_TYPE, photoId);
  event.dataTransfer.effectAllowed = "copyMove";
}

function readDrop(event: DragEvent): PhotoBoardDrop | null {
  const photoId = event.dataTransfer.getData(PHOTO_DRAG_TYPE);
  if (photoId) return { photoId };
  const [board, slot] = event.dataTransfer.getData(SLOT_DRAG_TYPE).split(":");
  if ((board === "report" || board === "movables") && slot && /^\d+$/.test(slot)) {
    return { board, slot: Number(slot) };
  }
  return null;
}

/**
 * A photo's file for a thumbnail: its own data URL, the inspector cache, else one fetch.
 *
 * How it works: a new photo source takes its own or the cached copy during render; only a fetch
 * waits for the effect. Edge cases: a photo without a file shows the placeholder icon.
 */
export function usePhotoDataUrl(photo: PropertyDetailDocumentEntry | undefined): string | undefined {
  const handle = photo?.inspectionPhoto;
  const [dataUrl, setDataUrl] = useState(
    () =>
      photo?.dataUrl ??
      (handle ? getInspectorPhotoDataUrl(handle.taskId, handle.photoRef) : undefined),
  );
  const [shownFor, setShownFor] = useState<readonly unknown[] | null>(null);
  const source = [
    photo?.dataUrl,
    handle?.taskId,
    handle?.photoRef,
    handle?.attachment,
    handle?.attachment.attachmentId,
  ] as const;
  if (!shownFor || source.some((value, i) => value !== shownFor[i])) {
    setShownFor(source);
    if (photo?.dataUrl) {
      setDataUrl(photo.dataUrl);
    } else if (handle?.attachment.attachmentId) {
      const cached = getInspectorPhotoDataUrl(handle.taskId, handle.photoRef);
      setDataUrl(cached);
    } else {
      setDataUrl(undefined);
    }
  }

  useEffect(() => {
    if (photo?.dataUrl) return;
    if (!handle?.attachment.attachmentId) return;
    if (getInspectorPhotoDataUrl(handle.taskId, handle.photoRef)) return;
    let cancelled = false;
    void prefetchInspectorPhoto(handle.taskId, handle.photoRef, handle.attachment).then((url) => {
      if (!cancelled && url) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [photo?.dataUrl, handle?.taskId, handle?.photoRef, handle?.attachment, handle?.attachment.attachmentId]);

  return dataUrl;
}

export function PhotoPlaceholderIcon() {
  return (
    <div className="flex h-full w-full items-center justify-center text-text-3">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <path d="m4 17 5-5 4 4 3-2 4 4" />
      </svg>
    </div>
  );
}

const GLASS_CHIP = "rounded-full bg-black/45 text-white backdrop-blur-sm";

type BoardSlotProps = {
  board: PhotoBoardKey;
  index: number;
  photo: PropertyDetailDocumentEntry | undefined;
  gallery: PropertyDetailDocumentEntry[];
  editable: boolean;
  /** A word on the slot itself: «الرئيسية» on the report board's first slot. */
  tag?: string;
  selected: boolean;
  onTap: () => void;
  onDrop: (from: PhotoBoardDrop) => void;
  onRemove: () => void;
};

/**
 * One slot of a board: its number, the photo and the remove button.
 *
 * How it works: a filled slot can be dragged onto another slot; anything dropped on the slot goes
 * to the board's owner to place. A tap selects the slot for the next tap or «add». Edge cases: a
 * read-only board opens the preview on a tap instead.
 */
function BoardSlot({
  board,
  index,
  photo,
  gallery,
  editable,
  tag,
  selected,
  onTap,
  onDrop,
  onRemove,
}: BoardSlotProps) {
  const dataUrl = usePhotoDataUrl(photo);
  const [over, setOver] = useState(false);
  const number = index + 1;
  const dropProps = editable
    ? {
        onDragOver: (event: DragEvent) => {
          event.preventDefault();
          setOver(true);
        },
        onDragLeave: () => setOver(false),
        onDrop: (event: DragEvent) => {
          event.preventDefault();
          setOver(false);
          const from = readDrop(event);
          if (from) onDrop(from);
        },
      }
    : {};

  if (!photo) {
    return (
      <button
        type="button"
        aria-label={`خانة ${number} فارغة`}
        disabled={!editable}
        onClick={onTap}
        {...dropProps}
        className={cn(
          "relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded border border-dashed bg-surface-2/50 p-0 text-[10.5px] text-text-3",
          over ? "border-primary bg-primary/10" : "border-border-md",
          selected && "ring-2 ring-primary",
          editable ? "cursor-pointer" : "cursor-default",
        )}
      >
        <span className="text-[13px] font-bold text-text-2">{number}</span>
        {tag ? <span className="font-bold text-text-2">{tag}</span> : null}
        {editable ? "اسحب صورة هنا" : "فارغة"}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "relative aspect-[4/3] w-full overflow-hidden rounded border bg-surface-2",
        over ? "border-primary" : "border-border",
        selected && "ring-2 ring-primary",
      )}
      draggable={editable}
      onDragStart={(event) => {
        event.dataTransfer.setData(SLOT_DRAG_TYPE, `${board}:${index}`);
        event.dataTransfer.effectAllowed = "move";
      }}
      {...dropProps}
    >
      <button
        type="button"
        aria-label={editable ? `خانة ${number}: ${photo.name}` : photo.name}
        aria-pressed={editable ? selected : undefined}
        onClick={() => {
          if (editable) onTap();
          else if (dataUrl) openPropertyDetailDocumentPreview({ ...photo, dataUrl }, gallery);
        }}
        onDoubleClick={() => {
          if (editable && dataUrl) openPropertyDetailDocumentPreview({ ...photo, dataUrl }, gallery);
        }}
        className={cn(
          "block h-full w-full border-0 p-0",
          editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        )}
      >
        {dataUrl ? (
          <img src={dataUrl} alt={photo.name} draggable={false} className="block h-full w-full object-cover" />
        ) : (
          <PhotoPlaceholderIcon />
        )}
      </button>
      <span className={cn(GLASS_CHIP, "pointer-events-none absolute start-1 top-1 min-w-6 px-1.5 py-0.5 text-center text-[11px] font-bold")}>
        {number}
      </span>
      {editable ? (
        <button
          type="button"
          aria-label={`إزالة الصورة من الخانة ${number}`}
          title="إزالة"
          onClick={onRemove}
          className="absolute end-1 top-1 grid size-6 cursor-pointer place-items-center rounded-full border-0 bg-black/45 p-0 text-[13px] text-white backdrop-blur-sm hover:bg-danger"
        >
          <i className="ti ti-x" aria-hidden />
        </button>
      ) : null}
      {tag ? (
        <span className={cn(GLASS_CHIP, "pointer-events-none absolute bottom-1 start-1 inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-bold")}>
          <i className="ti ti-home text-[11px]" aria-hidden />
          {tag}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A board of numbered slots laid out as the report's pages, six to a page.
 *
 * How it works: the board is filled from `ids` in order and the rest of its `limit` slots stay
 * empty; every drop, tap and removal goes to the owner, which decides and saves. Edge cases: a
 * read-only board shows the same pages without drag or remove.
 */
export function PropertyReportPhotoBoard({
  board,
  title,
  hint,
  ids,
  limit,
  photosById,
  gallery,
  editable,
  firstSlotTag,
  selection,
  onTap,
  onDrop,
  onRemove,
}: {
  board: PhotoBoardKey;
  title: string;
  hint: string;
  ids: readonly string[];
  limit: number;
  photosById: ReadonlyMap<string, PropertyDetailDocumentEntry>;
  gallery: PropertyDetailDocumentEntry[];
  editable: boolean;
  /** What the first slot is for: «الرئيسية» on the report board. */
  firstSlotTag?: string;
  selection: PhotoBoardSelection;
  onTap: (index: number) => void;
  onDrop: (from: PhotoBoardDrop, index: number) => void;
  onRemove: (index: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(limit / REPORT_PHOTOS_PER_PAGE));
  return (
    <section className="mb-5 rounded-lg border border-border bg-surface px-3 py-3" aria-label={title}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-bold text-heading">{title}</span>
        <span className="text-[11px] font-bold text-text-2">
          {ids.length} / {limit}
        </span>
      </div>
      {editable ? <p className="m-0 mb-2.5 text-[11px] leading-relaxed text-text-3">{hint}</p> : null}
      <div className="space-y-2.5">
        {Array.from({ length: pages }, (_, page) => {
          const from = page * REPORT_PHOTOS_PER_PAGE;
          const count = Math.min(REPORT_PHOTOS_PER_PAGE, limit - from);
          return (
            <div key={page}>
              {pages > 1 ? (
                <div className="mb-1 text-[10.5px] font-semibold text-text-3">صفحة {page + 1}</div>
              ) : null}
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
                {Array.from({ length: count }, (_, offset) => {
                  const index = from + offset;
                  const id = ids[index];
                  const photo = id ? photosById.get(id) : undefined;
                  return (
                    <BoardSlot
                      key={index}
                      board={board}
                      index={index}
                      photo={photo}
                      gallery={gallery}
                      editable={editable}
                      tag={index === 0 ? firstSlotTag : undefined}
                      selected={selection?.board === board && selection.index === index}
                      onTap={() => onTap(index)}
                      onDrop={(drop) => onDrop(drop, index)}
                      onRemove={() => onRemove(index)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
