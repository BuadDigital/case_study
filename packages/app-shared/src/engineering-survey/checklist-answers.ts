/** A checklist answer («نعم» / «لا») — the engineering office's and the inspector's checklists. */
export const ChecklistAnswers = {
  Yes: "yes",
  No: "no",
} as const;
export type ChecklistAnswer = (typeof ChecklistAnswers)[keyof typeof ChecklistAnswers];
