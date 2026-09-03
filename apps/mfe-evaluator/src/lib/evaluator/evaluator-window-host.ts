import type { RefObject } from "react";

/** Bridge between parent screen and appraiser window — passed as a ref to avoid function props at Next.js boundaries. */
export type EvaluatorWindowHostRef = {
  submit?: () => Promise<boolean>;
  onSubmitted?: () => void;
  onSavingChange?: (saving: boolean) => void;
  focusEvaluatorNotes?: () => void;
};

export type EvaluatorWindowHostRefObject = RefObject<
  EvaluatorWindowHostRef | null
>;
