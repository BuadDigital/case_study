"use client";

import type { ReactNode } from "react";
import { AppModal, Button, Label, Note, Textarea, cn } from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";

/**
 * Ops modal that asks for a written reason before a reversible decision
 * («إعادة من إنفاذ», «رفع تجميد الرفع المساحي»): «إلغاء» + one confirm button,
 * and closing is blocked while the request is in flight.
 */
export function ReasonConfirmModal({
  title,
  subtitle,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
  children,
}: {
  title: string;
  subtitle: string;
  confirmLabel: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  children: ReactNode;
}) {
  return (
    <AppModal
      open
      title={title}
      subtitle={subtitle}
      onClose={() => {
        if (!busy) onClose();
      }}
      maxWidthPx={470}
      look="ops-html"
      footer={
        <div className="flex w-full justify-end gap-2.5">
          <Button variant="default" showActionToast={false} disabled={busy} onClick={onClose}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            showActionToast={false}
            loading={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">{children}</div>
    </AppModal>
  );
}

/** Required reason textarea with its «(N أحرف على الأقل) *» label and inline error. */
export function RequiredReasonField({
  id,
  label,
  minLength,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  minLength: number;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label
        htmlFor={id}
        className="mb-1.5 text-[11px] font-semibold text-text-2"
      >
        {label} ({minLength} أحرف على الأقل){" "}
        <span className="text-danger-text">*</span>
      </Label>
      <Textarea
        id={id}
        rows={3}
        value={value}
        aria-invalid={error ? true : undefined}
        className={cn(
          "rounded-[10px] border-border-md bg-surface",
          error && invalidControlClass,
        )}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <Note tone="danger" className="mt-2">
          {error}
        </Note>
      ) : null}
    </div>
  );
}
