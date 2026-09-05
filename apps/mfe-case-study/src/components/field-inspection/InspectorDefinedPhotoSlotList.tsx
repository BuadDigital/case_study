"use client";

/**
 * The per-slot grid of `InspectorDefinedPhotosSection`: one cell per selected
 * service/amenity (`listDefinedPhotoSlotCells`) — square tiles on mobile, c9
 * tiles plus the transaction-photo picker on desktop. Presentational: uploads,
 * «غير متوفر» toggles and previews are delegated upward.
 */
import type { PropertyDetailDocumentEntry } from "../../lib/app-data/property-detail-documents";
import { InspectorPhotoFilePicker } from "./InspectorPhotoFilePicker";
import { DesktopHtmlPhotoTile, MobilePhotoTile } from "./InspectorDefinedPhotoTiles";
import {
  DEFINED_PHOTOS_EMPTY_TEXT,
  transactionPickerLabel,
  type DefinedPhotoSlotCell,
} from "./inspector-wizard-state";

export function InspectorDefinedPhotoSlotList({
  cells,
  layout,
  taskId,
  disabled,
  transactionPhotos,
  onUpload,
  onToggleNone,
  onOpen,
  onSelectTransactionPhoto,
}: {
  cells: DefinedPhotoSlotCell[];
  layout: "desktop" | "mobile";
  taskId: string;
  /** Section disabled or an upload in flight. */
  disabled: boolean;
  /** When set (case-study specialist), empty slots can pick from transaction images. */
  transactionPhotos?: PropertyDetailDocumentEntry[];
  onUpload: (slotId: string, files: File[]) => Promise<boolean>;
  onToggleNone: (slotId: string, none: boolean) => void;
  onOpen: (slotId: string, photoId: number) => void;
  onSelectTransactionPhoto: (slotId: string, doc: PropertyDetailDocumentEntry) => void;
}) {
  const canPickFromTransaction = Boolean(
    transactionPhotos && transactionPhotos.length > 0,
  );

  if (cells.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3.5 py-5 text-center text-[12px] text-text-3">
        {DEFINED_PHOTOS_EMPTY_TEXT}
      </div>
    );
  }

  if (layout === "mobile") {
    return (
      <div className="grid grid-cols-3 gap-2.5">
        {cells.map(({ id, label, slot, done, first }) => (
          <MobilePhotoTile
            key={id}
            label={label}
            required
            done={done}
            none={slot.none}
            disabled={disabled}
            onUpload={(files) => onUpload(id, files)}
            onToggleNone={() => onToggleNone(id, !slot.none)}
            onOpenDone={first ? () => onOpen(id, first.id) : undefined}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
      {cells.map(({ id, label, slot, done, first, photoRef }) => (
        <div key={id} className="flex flex-col gap-1">
          <DesktopHtmlPhotoTile
            label={label}
            required
            done={done}
            none={slot.none}
            taskId={taskId}
            photoRef={photoRef}
            photo={first}
            disabled={disabled}
            onUpload={(files) => onUpload(id, files)}
            onToggleNone={() => onToggleNone(id, !slot.none)}
            onOpen={first ? () => onOpen(id, first.id) : undefined}
          />
          {canPickFromTransaction && !slot.none ? (
            <InspectorPhotoFilePicker
              label={transactionPickerLabel(done)}
              compact
              disabled={disabled}
              transactionPhotos={transactionPhotos}
              onTransactionPhotoSelected={(doc) => onSelectTransactionPhoto(id, doc)}
              onFilesSelected={(files) => onUpload(id, files)}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
