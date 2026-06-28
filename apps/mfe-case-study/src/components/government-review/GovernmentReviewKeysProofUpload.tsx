"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { FormGroup, Label, cn, useToast } from "@platform/design-system";
import { isImageMime } from "../../lib/prototype/assignment-doc-attachments";
import {
  GOVERNMENT_REVIEW_KEYS_PROOF_ACCEPT,
  fileToGovernmentReviewKeysProof,
} from "../../lib/prototype/government-review-keys-proof";
import type { GovernmentReviewKeysProofFile } from "../../lib/prototype/government-review-work-data";

const UPLOAD_BTN =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-md bg-surface px-2.5 py-2 text-[11px] text-text-2 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60";

function useCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

function ProofThumb({
  file,
  disabled,
  onRemove,
}: {
  file: GovernmentReviewKeysProofFile;
  disabled?: boolean;
  onRemove: () => void;
}) {
  const isImage = isImageMime(file.mimeType) && file.dataUrl;

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        {isImage ? (
          <div
            className="h-20 w-full rounded-md border border-border bg-surface-2 bg-cover bg-center"
            style={{ backgroundImage: `url(${file.dataUrl})` }}
            role="img"
            aria-label={file.fileName}
          />
        ) : (
          <div className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded-md border border-border bg-surface-2 px-2 text-center">
            <i
              className={cn(
                "text-lg text-text-3",
                file.mimeType === "application/pdf"
                  ? "ti ti-file-type-pdf"
                  : "ti ti-file",
              )}
              aria-hidden
            />
            <span className="line-clamp-2 text-[9px] text-text-3">
              {file.fileName}
            </span>
          </div>
        )}
        {!disabled ? (
          <button
            type="button"
            className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-[10px] text-danger-text shadow-sm hover:bg-danger-surface"
            aria-label={`حذف ${file.fileName}`}
            onClick={onRemove}
          >
            <i className="ti ti-x" aria-hidden />
          </button>
        ) : null}
      </div>
      <span
        className="truncate text-[10px] text-text-3"
        title={file.fileName}
      >
        {file.fileName}
      </span>
    </div>
  );
}

export function GovernmentReviewKeysProofUpload({
  label,
  files,
  disabled,
  error,
  onChange,
}: {
  label: string;
  files: GovernmentReviewKeysProofFile[];
  disabled?: boolean;
  error?: string;
  onChange: (files: GovernmentReviewKeysProofFile[]) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const desktopRef = useRef<HTMLInputElement>(null);
  const isMobile = useCoarsePointer();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { runWithUploadToast } = useToast();

  const addFiles = async (selected: File[]) => {
    await runWithUploadToast(async () => {
      setUploadError(null);
      const next = [...files];
      let added = 0;
      for (const file of selected) {
        try {
          next.push(await fileToGovernmentReviewKeysProof(file));
          added += 1;
        } catch (err) {
          setUploadError(
            err instanceof Error ? err.message : "تعذر رفع الملف",
          );
        }
      }
      if (added === 0) return false;
      onChange(next);
    });
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (selected.length > 0) {
      void addFiles(selected);
    }
  };

  const removeFile = (id: string) => {
    onChange(files.filter((f) => f.id !== id));
    setUploadError(null);
  };

  return (
    <FormGroup className="mb-3 flex flex-col gap-1.5">
      <Label htmlFor="gov-keys-proof-upload" className="text-[11px] font-semibold text-text-2">
        {label}
      </Label>

      {isMobile ? (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            className={UPLOAD_BTN}
            disabled={disabled}
            data-no-action-toast=""
            onClick={() => cameraRef.current?.click()}
          >
            <i className="ti ti-camera" aria-hidden /> تصوير بالكاميرا
          </button>
          <button
            type="button"
            className={UPLOAD_BTN}
            disabled={disabled}
            data-no-action-toast=""
            onClick={() => galleryRef.current?.click()}
          >
            <i className="ti ti-photo" aria-hidden /> اختيار صور أو PDF
          </button>
          <input
            ref={cameraRef}
            id="gov-keys-proof-upload"
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            disabled={disabled}
            className="sr-only"
            onChange={handleChange}
          />
          <input
            ref={galleryRef}
            type="file"
            accept={GOVERNMENT_REVIEW_KEYS_PROOF_ACCEPT}
            multiple
            disabled={disabled}
            className="sr-only"
            onChange={handleChange}
          />
        </div>
      ) : (
        <>
          <button
            type="button"
            className={UPLOAD_BTN}
            disabled={disabled}
            data-no-action-toast=""
            onClick={() => desktopRef.current?.click()}
          >
            <i className="ti ti-upload" aria-hidden /> رفع صور أو خطاب (PDF)
          </button>
          <input
            ref={desktopRef}
            id="gov-keys-proof-upload"
            type="file"
            accept={GOVERNMENT_REVIEW_KEYS_PROOF_ACCEPT}
            multiple
            disabled={disabled}
            className="sr-only"
            onChange={handleChange}
          />
        </>
      )}

      {files.length > 0 ? (
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((file) => (
            <ProofThumb
              key={file.id}
              file={file}
              disabled={disabled}
              onRemove={() => removeFile(file.id)}
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="text-[10px] text-danger-text" role="alert">
          {error}
        </p>
      ) : null}
      {uploadError ? (
        <p className="text-[10px] text-danger-text" role="alert">
          {uploadError}
        </p>
      ) : null}
    </FormGroup>
  );
}
