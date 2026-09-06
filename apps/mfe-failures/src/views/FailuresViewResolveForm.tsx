"use client";

/** Failures queue — the inline «تم الحل» form: reason + continue instructions, then confirm. */

import { Button, cn, formControlClassName } from "@platform/ui-kit";
import {
  isResolveDraftComplete,
  type ResolveDraft,
} from "../lib/failures-view-state";

export const failuresFieldTextareaClass = cn(
  formControlClassName,
  "min-h-[72px] resize-y py-2 leading-relaxed",
);

export const failuresActionButtonClass =
  "h-8 min-h-8 px-2.5 text-[12px] font-semibold text-heading shadow-none max-lg:min-h-11 max-lg:px-3 max-lg:text-[13px]";

export function FailuresViewResolveForm({
  failureId,
  draft,
  loading,
  busy,
  onPatch,
  onSubmit,
}: {
  failureId: string;
  draft: ResolveDraft;
  /** The resolve request itself is in flight. */
  loading: boolean;
  /** Any action of this failure is in flight. */
  busy: boolean;
  onPatch: (patch: Partial<ResolveDraft>) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-3 space-y-2.5 border-t border-border/80 pt-3">
      <div>
        <label
          className="mb-1.5 block text-[11px] font-semibold text-heading"
          htmlFor={`resolve_reason_${failureId}`}
        >
          سبب الحل *
        </label>
        <textarea
          id={`resolve_reason_${failureId}`}
          className={failuresFieldTextareaClass}
          rows={2}
          value={draft.reason}
          onChange={(e) => onPatch({ reason: e.target.value })}
        />
      </div>
      <div>
        <label
          className="mb-1.5 block text-[11px] font-semibold text-heading"
          htmlFor={`resolve_instructions_${failureId}`}
        >
          توجيه استمرار العمل *
        </label>
        <textarea
          id={`resolve_instructions_${failureId}`}
          className={failuresFieldTextareaClass}
          rows={2}
          value={draft.instructions}
          onChange={(e) => onPatch({ instructions: e.target.value })}
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="default"
        className={failuresActionButtonClass}
        loading={loading}
        showActionToast={false}
        disabled={!isResolveDraftComplete(draft) || busy}
        onClick={onSubmit}
      >
        تأكيد الحل وإغلاق التعذر
      </Button>
    </div>
  );
}
