/**
 * In-app document preview: a click anywhere asks for a preview, and the single
 * `DocumentPreviewHost` mounted in the shell renders it as a dialog on the same page.
 * Without a mounted host (tests, isolated screens) `requestDocumentPreview` reports
 * `false` so the caller can fall back to opening a new tab.
 */
export type DocumentPreviewItem = {
  /** Stable id so gallery steps can find this item again. */
  id?: string;
  fileName: string;
  /** Dialog title — defaults to the file name. */
  title?: string;
  kind: "image" | "pdf" | "file";
  dataUrl?: string;
  attachmentId?: string;
};

export type DocumentPreviewRequest = DocumentPreviewItem & {
  /** Other images in the same set, including this one, in display order. */
  gallery?: DocumentPreviewItem[];
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

function samePreviewItem(a: DocumentPreviewItem, b: DocumentPreviewItem): boolean {
  if (a.id && b.id) return a.id === b.id;
  if (a.attachmentId && b.attachmentId) return a.attachmentId === b.attachmentId;
  return a.fileName === b.fileName && a.title === b.title && a.dataUrl === b.dataUrl;
}

export function documentPreviewIndex(request: DocumentPreviewRequest): number {
  const gallery = request.gallery;
  if (!gallery?.length) return -1;
  return gallery.findIndex((item) => samePreviewItem(item, request));
}

/** Move within `gallery` without dropping the rest of the set. */
export function stepDocumentPreview(delta: number): void {
  const gallery = current?.gallery;
  if (!current || !gallery || gallery.length < 2) return;
  const next = gallery[documentPreviewIndex(current) + delta];
  if (!next) return;
  current = { ...next, gallery };
  emit();
}
