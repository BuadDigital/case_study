"use client";

/**
 * Small pieces shared by the key-envelope detail dialogs: the inline error
 * banner, the centred modal header with its close button, the check icon on
 * save buttons, and the dashed attachment tile with its hidden file input.
 */
import type { ReactNode, RefObject } from "react";
import {
  ModalClose,
  ModalHeader,
  ModalTitle,
  cn,
  useToast,
} from "@platform/ui-kit";
import { uploadEnvelopeAttachment } from "../lib/keys-envelope-api";
import { FileIcon } from "./KeyEnvelopeDetailIcons";

export function DialogErrorBanner({
  error,
  className,
}: {
  error: string | null;
  className?: string;
}) {
  if (!error) return null;
  return (
    <div
      className={cn(
        "rounded-[10px] border border-[color-mix(in_srgb,#d9694f_30%,transparent)] bg-[color-mix(in_srgb,#d9694f_12%,transparent)] px-3 py-2.5 text-[12.5px] font-semibold text-[#a32d2d]",
        className,
      )}
    >
      {error}
    </div>
  );
}

export function DialogHeader({
  title,
  onClose,
}: {
  title: ReactNode;
  onClose: () => void;
}) {
  return (
    <ModalHeader className="relative border-b border-border px-5 py-4">
      <ModalTitle className="text-center text-[16px] font-extrabold text-heading">
        {title}
      </ModalTitle>
      <ModalClose
        className="absolute start-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[9px] bg-surface-2"
        onClick={onClose}
      >
        ✕
      </ModalClose>
    </ModalHeader>
  );
}

export function SaveCheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const TILE_TONES = {
  blue: {
    active: "border-[var(--gold)] bg-[var(--gold-soft)]",
    icon: "bg-[color-mix(in_srgb,#378add_12%,transparent)] text-[#378add]",
  },
  gold: {
    active: "border-[var(--gold)] bg-[var(--gold-soft)]",
    icon: "bg-[color-mix(in_srgb,#b58a3c_12%,transparent)] text-[#b58a3c]",
  },
  red: {
    active:
      "border-[#d9694f] bg-[color-mix(in_srgb,#d9694f_10%,transparent)]",
    icon: "bg-[color-mix(in_srgb,#d9694f_12%,transparent)] text-[#d9694f]",
  },
} as const;

type UploadKind = Parameters<typeof uploadEnvelopeAttachment>[0];

/**
 * Hidden file input plus the dashed tile that opens it. The upload happens
 * here; the parent only learns the attachment id and file name.
 */
export function DialogAttachmentPicker({
  inputRef,
  kind,
  scopeKey,
  capture,
  tone,
  active,
  title,
  hint,
  onUploaded,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  kind: UploadKind;
  scopeKey: string;
  capture?: "environment";
  tone: keyof typeof TILE_TONES;
  active: boolean;
  title: string;
  hint: string;
  onUploaded: (id: string, fileName: string) => void;
}) {
  const { showToast } = useToast();
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        capture={capture}
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const upload = await uploadEnvelopeAttachment(kind, scopeKey, file);
          if (!upload.ok) {
            showToast(upload.error, "error");
            return;
          }
          onUploaded(upload.data.id, upload.data.fileName);
        }}
      />
      <button
        type="button"
        className={cn(
          "mt-1 flex min-h-[52px] w-full items-center gap-3 rounded-xl border-[1.5px] border-dashed px-3.5 py-2.5 text-start",
          active ? TILE_TONES[tone].active : "border-border-md bg-surface-2",
        )}
        onClick={() => inputRef.current?.click()}
      >
        <span
          className={cn(
            "grid size-[34px] shrink-0 place-items-center rounded-[9px]",
            TILE_TONES[tone].icon,
          )}
        >
          <FileIcon />
        </span>
        <span>
          <span className="block text-[13px] font-extrabold text-heading">
            {title}
          </span>
          <span className="mt-px block text-[11.5px] text-text-3">{hint}</span>
        </span>
      </button>
    </>
  );
}
