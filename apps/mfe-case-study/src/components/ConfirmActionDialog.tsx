"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { AppModal, Button } from "@platform/ui-kit";

export type ConfirmActionRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type PendingConfirm = ConfirmActionRequest & {
  resolve: (ok: boolean) => void;
};

/** In-app beige `AppModal` stand-in for `window.confirm`. */
export function ConfirmActionDialog({
  open,
  title,
  message,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  danger = false,
  onCancel,
  onConfirm,
}: ConfirmActionRequest & {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AppModal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="m-0 text-[13px] leading-6 text-text-2">{message}</p>
    </AppModal>
  );
}

/** Promise-based confirm for menu handlers that still need async flow. */
export function useConfirmActionDialog(): {
  confirm: (request: ConfirmActionRequest) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);

  const settle = useCallback((ok: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(ok);
  }, []);

  const confirm = useCallback((request: ConfirmActionRequest) => {
    return new Promise<boolean>((resolve) => {
      pendingRef.current?.resolve(false);
      const next: PendingConfirm = { ...request, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const dialog = (
    <ConfirmActionDialog
      open={Boolean(pending)}
      title={pending?.title ?? ""}
      message={pending?.message ?? ""}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      danger={pending?.danger}
      onCancel={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  );

  return { confirm, dialog };
}
