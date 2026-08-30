import type { PageId } from "@platform/types";

export type OrphanScreenNavItem = {
  id: PageId;
  label: string;
  icon: string;
  available: boolean;
};

/**
 * Legacy draft sidebar group — emptied (removed from nav).
 * Page ids `survey` / `property-inspection` may still exist as routes for deep links.
 */
export const ORPHAN_SCREENS_NAV: OrphanScreenNavItem[] = [];

export const ORPHAN_SCREENS_GROUP = "الشاشات (Draft)";

export const ORPHAN_SCREENS_GROUP_ICON =
  "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM16 16h2v2h-2zM20 16h2v2h-2zM16 20h2v2h-2zM20 20h2v2h-2z";

export const ORPHAN_SCREENS_PAGE_IDS: PageId[] = ORPHAN_SCREENS_NAV.map(
  (n) => n.id,
);

export function orphanScreensNavForRole(
  _rolePages: PageId[],
): OrphanScreenNavItem[] {
  return [];
}

export function isInOrphanScreensSection(_page: PageId): boolean {
  return false;
}

export function showOrphanScreensGroup(_rolePages: PageId[]): boolean {
  return false;
}
