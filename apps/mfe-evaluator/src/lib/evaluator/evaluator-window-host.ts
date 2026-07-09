import type { RefObject } from "react";

/** جسر بين الشاشة الأم ونافذة المقيم — يُمرَّر كـ ref لتجنب props دوال في حدود Next.js. */
export type EvaluatorWindowHostRef = {
  submit?: () => Promise<boolean>;
  onSubmitted?: () => void;
  onSavingChange?: (saving: boolean) => void;
  focusEvaluatorNotes?: () => void;
};

export type EvaluatorWindowHostRefObject = RefObject<
  EvaluatorWindowHostRef | null
>;
