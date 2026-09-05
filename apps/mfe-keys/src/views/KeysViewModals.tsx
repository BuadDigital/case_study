"use client";

/**
 * Modals opened from the keys list: the on-demand register-envelope modal
 * (dynamic chunk, prefetched on button hover) and the delete confirmation.
 */
import dynamic from "next/dynamic";
import {
  Button,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
} from "@platform/ui-kit";
import {
  envelopeDisplayRef,
  type KeyEnvelopeRow,
} from "../lib/keys-envelope-types";

const RegisterKeyEnvelopeModal = dynamic(
  () =>
    import("../components/RegisterKeyEnvelopeModal").then(
      (m) => m.RegisterKeyEnvelopeModal,
    ),
  { ssr: false },
);

// Used to always mount so the chunk loaded on screen open despite splitting — now mounts on
// open only, with prefetch on button hover (bundle-preload).
export const preloadRegisterKeyEnvelopeModal = () =>
  void import("../components/RegisterKeyEnvelopeModal");

export function KeysRegisterEnvelopeModal({
  open,
  onClose,
  initialRequestNumber,
  operationsTaskId,
  onRegistered,
}: {
  open: boolean;
  onClose: () => void;
  initialRequestNumber?: string;
  operationsTaskId?: string;
  onRegistered: (id: string) => void;
}) {
  if (!open) return null;
  return (
    <RegisterKeyEnvelopeModal
      open={open}
      busy={false}
      onClose={onClose}
      initialRequestNumber={initialRequestNumber}
      operationsTaskId={operationsTaskId}
      onRegistered={onRegistered}
    />
  );
}

export function KeysDeleteEnvelopeModal({
  envelope,
  deletingId,
  onConfirm,
  onCancel,
}: {
  envelope: KeyEnvelopeRow | null;
  deletingId: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!envelope) return null;
  return (
    <ModalOverlay onClick={onCancel}>
      <ModalCard onClick={(e) => e.stopPropagation()} className="max-w-[420px] p-0">
        <ModalHeader>
          <ModalTitle>حذف الظرف</ModalTitle>
          <ModalClose onClick={onCancel}>×</ModalClose>
        </ModalHeader>
        <ModalBody className="space-y-2 p-5 text-[13px] text-text-2">
          <p>
            هل تريد حذف الظرف{" "}
            <span className="font-bold text-heading">
              {envelopeDisplayRef(
                envelope.id,
                envelope.createdAtUtc,
                envelope.referenceNumber,
              )}
            </span>
            ؟
          </p>
          <p className="text-[12px] text-text-3">لا يمكن التراجع عن الحذف.</p>
        </ModalBody>
        <ModalFooter className="justify-start gap-2">
          <Button
            variant="danger"
            loading={deletingId === envelope.id}
            disabled={deletingId !== null}
            showActionToast={false}
            onClick={onConfirm}
          >
            حذف
          </Button>
          <Button
            variant="outline"
            disabled={deletingId !== null}
            showActionToast={false}
            onClick={onCancel}
          >
            إلغاء
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
