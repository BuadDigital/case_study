"use client";

import { AppModal, Button, Spinner } from "@platform/ui-kit";

/** Where the party's «إرسال» is: nothing yet, in flight, done, or saved to be sent when back online. */
export type PartyTaskSubmitState = "idle" | "sending" | "sent" | "queued";

/**
 * The window the inspector and the appraiser see between pressing «إرسال» and being done: a loading
 * card while the send runs (it cannot be dismissed), then the result and one button back to the queue.
 */
export function PartyTaskSubmitDialog({
  state,
  sendingText,
  sentText,
  onBack,
}: {
  state: PartyTaskSubmitState;
  sendingText: string;
  sentText: string;
  onBack: () => void;
}) {
  if (state === "idle") return null;
  const sending = state === "sending";
  const text =
    state === "queued" ? "حُفظت ولا يوجد اتصال الآن — ستُرسل تلقائياً عند عودته." : sentText;

  return (
    <AppModal
      open
      title={sending ? "جاري الإرسال" : state === "queued" ? "تم الحفظ" : "تم الإرسال"}
      // While sending there is nothing to dismiss to; afterwards closing is the same as going back.
      onClose={sending ? () => undefined : onBack}
      footer={
        sending ? undefined : (
          <Button type="button" variant="primary" onClick={onBack}>
            العودة للقائمة
          </Button>
        )
      }
    >
      <div
        className="flex flex-col items-center gap-3 py-4 text-center"
        role="status"
        aria-live="polite"
      >
        {sending ? (
          <Spinner className="size-8 border-[3px] text-primary" />
        ) : (
          <span className="grid size-10 place-items-center rounded-full bg-success-bg text-lg text-success-text">
            ✓
          </span>
        )}
        <p className="m-0 text-[13.5px] leading-6 text-text-2">{sending ? sendingText : text}</p>
      </div>
    </AppModal>
  );
}
