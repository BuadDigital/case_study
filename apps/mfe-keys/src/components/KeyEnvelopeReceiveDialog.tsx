"use client";

/**
 * Receive envelope — confirms the pending handoff so custody returns to the
 * clerk (shown while the status is not «with clerk»).
 */
import { useCallback } from "react";
import {
  Button,
  ModalBody,
  ModalCard,
  ModalFooter,
  ModalOverlay,
  useToast,
} from "@platform/ui-kit";
import { useIdempotentAction } from "@platform/app-shared";
import { confirmEnvelopeHandoff } from "../lib/keys-envelope-api";
import type { KeyEnvelopeRow } from "../lib/keys-envelope-types";
import {
  findPendingHandoff,
  receiveHolderLabel,
  receiveSuccessMessage,
} from "./key-envelope-dialogs-state";
import { DialogHeader } from "./KeyEnvelopeDialogShared";

export function ReceiveEnvelopeModal({
  env,
  busy,
  onClose,
  onBusy,
  onDone,
}: {
  env: KeyEnvelopeRow;
  busy: boolean;
  onClose: () => void;
  onBusy: (v: boolean) => void;
  onDone: (next: KeyEnvelopeRow) => Promise<void>;
}) {
  const { showToast } = useToast();
  const pending = findPendingHandoff(env);
  const holder = receiveHolderLabel(env, pending);

  const { execute: executeReceive, loading: receiving } = useIdempotentAction(
    useCallback(
      async (idempotencyKey: string) => {
        if (!pending) throw new Error("لا توجد مناولة بانتظار التأكيد");
        return confirmEnvelopeHandoff(env.id, pending.id, idempotencyKey);
      },
      [env.id, pending?.id],
    ),
  );

  const buttonBusy = busy || receiving;

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard
        onClick={(e) => e.stopPropagation()}
        className="max-w-[520px] p-0 max-lg:max-h-[min(92dvh,100%)]"
      >
        <DialogHeader
          title={<>استلام الظرف — {env.requestNumber}</>}
          onClose={onClose}
        />
        <ModalBody className="px-5 py-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[color-mix(in_srgb,#378add_14%,transparent)] text-[#378add]">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <div>
              <div className="mb-1 text-[14px] font-extrabold text-heading">
                تأكيد استلام الظرف {env.requestNumber}
              </div>
              <div className="text-[12.5px] leading-relaxed text-text-2">
                الظرف بعهدة <b>{holder}</b> — يكفي تأكيد الاستلام لتعود العهدة
                إليك ويوثَّق ذلك في السجل.
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="justify-start gap-2 border-t border-border px-5 py-3.5">
          <Button
            variant="outline"
            disabled={buttonBusy}
            showActionToast={false}
            onClick={onClose}
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            loading={buttonBusy}
            disabled={!pending}
            showActionToast={false}
            onClick={async () => {
              if (!pending) {
                showToast("لا توجد مناولة بانتظار التأكيد.", "error");
                return;
              }
              onBusy(true);
              try {
                const outcome = await executeReceive();
                if (outcome.status === "skipped") return;
                const result = outcome.value;
                if (!result.ok) {
                  showToast(result.error, "error");
                  return;
                }
                showToast(receiveSuccessMessage(env.requestNumber), "success");
                await onDone(result.data);
              } finally {
                onBusy(false);
              }
            }}
          >
            تأكيد الاستلام
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
