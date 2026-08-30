import type { RefObject } from "react";

/** Bridge between the task list and work screen — passed as a ref to avoid function props across Next.js boundaries. */
export type PartyActiveTaskWorkHostRef = {
  onRefresh?: () => void;
  onClose?: () => void;
};

export type PartyActiveTaskWorkHostRefObject = RefObject<
  PartyActiveTaskWorkHostRef | null
>;
