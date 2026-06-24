"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Input,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
} from "@platform/design-system";

export function FeeActionReasonModal({
  open,
  title,
  label,
  placeholder,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setError(false);
    setBusy(false);
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(true);
      return;
    }
    setBusy(true);
    try {
      await onConfirm(trimmed);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
          <ModalClose onClick={onClose} aria-label="إغلاق">
            ×
          </ModalClose>
        </ModalHeader>
        <ModalBody>
          <label className="mb-1 block text-xs text-text-2">{label}</label>
          <Input
            className="text-sm"
            value={reason}
            placeholder={placeholder}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(false);
            }}
          />
          {error ? (
            <p className="mt-2 text-xs text-danger">السبب إلزامي.</p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={busy}
            onClick={() => void submit()}
          >
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
