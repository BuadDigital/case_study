"use client";

import {
  Button,
  ModalBody,
  ModalCard,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
} from "@platform/ui-kit";

/** One confirm step: title, body copy, confirm-button label and the action it runs. */
export type ConfirmActionSpec = {
  title: string;
  body: string;
  confirm: string;
  onConfirm: () => void;
};

/**
 * Settings confirm dialog — shared by brand identity, valuers roster and users.
 * Closes first, then runs the action, so a slow action never keeps the dialog open.
 */
export function ConfirmActionModal({
  modal,
  titleId,
  onClose,
}: {
  modal: ConfirmActionSpec | null;
  titleId: string;
  onClose: () => void;
}) {
  if (!modal) return null;
  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
      >
        <ModalHeader>
          <ModalTitle id={titleId}>{modal.title}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="m-0 text-[13px] leading-relaxed text-text-2">{modal.body}</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const fn = modal.onConfirm;
              onClose();
              fn();
            }}
          >
            {modal.confirm}
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
