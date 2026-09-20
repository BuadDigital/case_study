/**
 * In-app document preview: a click anywhere asks for a preview, and the single
 * `DocumentPreviewHost` mounted in the shell renders it as a dialog on the same page.
 * Without a mounted host (tests, isolated screens) `requestDocumentPreview` reports
 * `false` so the caller can fall back to opening a new tab.
 */
export type DocumentPreviewRequest = {
  fileName: string;
  /** Dialog title — defaults to the file name. */
  title?: string;
  kind: "image" | "pdf" | "file";
  dataUrl?: string;
  attachmentId?: string;
};

type Listener = () => void;

let current: DocumentPreviewRequest | null = null;
let hosts = 0;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeDocumentPreview(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDocumentPreviewSnapshot(): DocumentPreviewRequest | null {
  return current;
}

/** Called by `DocumentPreviewHost` while it is mounted. */
export function registerDocumentPreviewHost(): () => void {
  hosts += 1;
  return () => {
    hosts -= 1;
    if (hosts <= 0) {
      hosts = 0;
      current = null;
    }
  };
}

export function requestDocumentPreview(request: DocumentPreviewRequest): boolean {
  if (hosts === 0) return false;
  current = request;
  emit();
  return true;
}

export function closeDocumentPreview(): void {
  if (current === null) return;
  current = null;
  emit();
}
