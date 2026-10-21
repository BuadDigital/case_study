"use client";

/**
 * Receive envelope (decision 2026-10-20). With a handoff waiting on the viewer it
 * confirms that handoff. Otherwise it records a receive-back: the reviewer
 * receives at once (he is the receiver), an inspector hands the envelope to the
 * envelope's reviewer and waits for that reviewer's confirmation.
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
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import {
  confirmEnvelopeHandoff,
  createEnvelopeHandoff,
} from "../lib/keys-envelope-api";
import type { KeyEnvelopeRow } from "../lib/keys-envelope-types";
import {
  buildReceiveBackBody,
  findPendingHandoff,
  receiveBackSuccessMessage,
  receiveHolderLabel,
  receiveSuccessMessage,
} from "./key-envelope-dialogs-state";
import { DialogErrorBanner, DialogHeader } from "./KeyEnvelopeDialogShared";

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
  const { role, viewerUserId, viewerDisplayName } = useAppAccess();
  const pending = findPendingHandoff(env);
  const holder = env.holderLabel?.trim() || receiveHolderLabel(env, pending);
  const receiveBack = pending
    ? null
    : buildReceiveBackBody(env, {
        userId: viewerUserId,
        displayName: viewerDisplayName,
        role,
      });
  const blocked = receiveBack && !receiveBack.ok ? receiveBack.error : "";

  const { execute: executeReceive, loading: receiving } = useIdempotentAction(
    useCallback(
      async (idempotencyKey: string) => {
        // Read the pending handoff again here: the dialog may have been open while
        // the envelope changed under it.
        const target = findPendingHandoff(env);
        if (target) return confirmEnvelopeHandoff(env.id, target.id, idempotencyKey);
        const built = buildReceiveBackBody(env, {
          userId: viewerUserId,
          displayName: viewerDisplayName,
          role,
        });
        if (!built.ok) throw new Error(built.error);
        return createEnvelopeHandoff(env.id, built.body, idempotencyKey);
      },
      [env, role, viewerUserId, viewerDisplayName],
    ),
  );

  const buttonBusy = busy || receiving;
  const immediate = receiveBack?.ok ? receiveBack.immediate : true;

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
        <ModalBody className="space-y-3 px-5 py-5">
          <DialogErrorBanner error={blocked} />
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
                {pending
                  ? `تأكيد استلام الظرف ${env.requestNumber}`
                  : immediate
                    ? `استلام الظرف ${env.requestNumber} إلى عهدتي`
                    : `تسليم الظرف ${env.requestNumber} إلى المراجع`}
              </div>
              <div className="text-[12.5px] leading-relaxed text-text-2">
                {pending ? (
                  <>
                    مناولة إلى <b>{pending.toParty}</b> بانتظار تأكيد الاستلام —
                    بالتأكيد تنتقل العهدة إلى المستلم ويوثَّق ذلك في السجل.
                  </>
                ) : immediate ? (
                  <>
                    الظرف الآن عند <b>{holder}</b> — بتسجيل الاستلام تعود العهدة
                    إليك فورًا ويوثَّق ذلك في السجل.
                  </>
                ) : (
                  <>
                    الظرف بعهدتك ويُسلَّم إلى المراجع{" "}
                    <b>{env.createdByName || "المراجع الحكومي"}</b> — تبقى
                    المناولة بانتظار تأكيده، ولا تنتقل العهدة قبل ذلك.
                  </>
                )}
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
            disabled={Boolean(blocked)}
            showActionToast={false}
            onClick={async () => {
              onBusy(true);
              try {
                const outcome = await executeReceive();
                if (outcome.status === "skipped") return;
                const result = outcome.value;
                if (!result.ok) {
                  showToast(result.error, "error");
                  return;
                }
                showToast(
                  pending
                    ? receiveSuccessMessage(env.requestNumber)
                    : receiveBackSuccessMessage(env.requestNumber, immediate),
                  "success",
                );
                if (result.queued) {
                  await onDone({ ...env });
                  return;
                }
                await onDone(result.data);
              } finally {
                onBusy(false);
              }
            }}
          >
            {pending
              ? "تأكيد الاستلام"
              : immediate
                ? "تسجيل الاستلام"
                : "تسليم إلى المراجع"}
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
