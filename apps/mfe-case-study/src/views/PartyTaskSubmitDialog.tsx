"use client";

import { AppModal, Button, Spinner } from "@platform/ui-kit";

/** Where the party's «إرسال» is: nothing yet, in flight, done, or saved to be sent when back online. */
export type PartyTaskSubmitState = "idle" | "sending" | "sent" | "queued";

/**
 * The window the inspector and the appraiser see between pressing «إرسال» and being done.
 *
 * How it works: it is a pure view of `state`. `idle` renders nothing. `sending` shows a spinner and the sending
 * text; the modal's close handler is a no-op, so Escape and the overlay cannot dismiss it. `sent` shows a check mark,
 * `sentText` and one button «العودة للقائمة»; `queued` (saved offline) shows a fixed «will be sent when the connection
 * is back» text with the same button. In `sent` and `queued`, closing the window is the same as going back.
 *
 * Edge cases: the host owns the state and closes the window (state back to `idle`) when a send fails, so the form
 * stays usable; the old flow showed a read-only form and redirected after 900 ms, which looked like a freeze.
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
