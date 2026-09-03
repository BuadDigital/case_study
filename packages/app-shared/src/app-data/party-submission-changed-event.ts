export type PartySubmissionChangedDetail = {
  workflowNotify?: boolean;
};

export function dispatchPartySubmissionChanged(eventName: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PartySubmissionChangedDetail>(eventName, {
      detail: { workflowNotify: false },
    }),
  );
}
