import type { PageId } from "@platform/types";
import { pageIdFromPathname } from "../app-data/page-access";

/**
 * Spec §3.1: offline, the field inspector and government reviewer get input forms
 * only — no general browsing. These are the screens that work from the device:
 * the inspection queue and form, the operations tasks and the keys/envelopes forms.
 * The service worker keeps exactly these pages (`OFFLINE_PAGE_PREFIXES` in sw.js).
 */
export const OFFLINE_FORM_PAGE_IDS: readonly PageId[] = [
  "active-inspection",
  "operations-tasks",
  "keys",
];

/** The role's pages that stay open offline, in `OFFLINE_FORM_PAGE_IDS` order. */
export function offlineFormPages(rolePages: readonly PageId[]): PageId[] {
  return OFFLINE_FORM_PAGE_IDS.filter((id) => rolePages.includes(id));
}

/** Where an offline field user lands — their first form screen, or null when none. */
export function offlineLandingPath(rolePages: readonly PageId[]): string | null {
  const first = offlineFormPages(rolePages)[0];
  return first ? `/${first}` : null;
}

/** True when this path is one of the offline form screens (or a task under one). */
export function isOfflineFormPath(pathname: string): boolean {
  const pageId = pageIdFromPathname(pathname);
  return pageId !== null && OFFLINE_FORM_PAGE_IDS.includes(pageId);
}
