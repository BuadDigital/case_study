import type { RefObject } from "react";

/** Bridge between parent screen and appraiser window — passed as a ref to avoid function props at Next.js boundaries. */
type EvaluatorWindowHostRef = {
  submit?: () => Promise<boolean>;
  onSubmitted?: () => void;
  /**
   * Optional progress hooks for a host that shows a sending dialog: `onSubmitStarted` once the checks and
   * gates pass, then `onSubmitted` (sent) or `onSubmitFailed` (the reason is already on screen).
   */
  onSubmitStarted?: () => void;
  onSubmitFailed?: () => void;
  onSavingChange?: (saving: boolean) => void;
  focusEvaluatorNotes?: () => void;
};

export type EvaluatorWindowHostRefObject = RefObject<
  EvaluatorWindowHostRef | null
>;
