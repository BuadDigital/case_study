export type SurveyWorkTopbarState = {
  saving: boolean;
  saveLabel: string;
  onSave: () => void;
};

let state: SurveyWorkTopbarState | null = null;
const listeners = new Set<() => void>();

export function setSurveyWorkTopbarState(next: SurveyWorkTopbarState | null): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function getSurveyWorkTopbarState(): SurveyWorkTopbarState | null {
  return state;
}

export function subscribeSurveyWorkTopbar(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
