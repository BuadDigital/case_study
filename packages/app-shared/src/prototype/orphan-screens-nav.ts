import type { PageId } from "@platform/types";

export type OrphanScreenNavItem = {
  id: PageId;
  label: string;
  icon: string;
  available: boolean;
};

/** شاشات قديمة غير مربوطة بسير العمل الحالي — للمسؤول فقط */
export const ORPHAN_SCREENS_NAV: OrphanScreenNavItem[] = [
  {
    id: "survey",
    label: "مكاتب الرفع (يتيم)",
    icon: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
    available: true,
  },
  {
    id: "government-review",
    label: "المراجعة الحكومية (يتيم)",
    icon: "M3 21h18M6 21V7l6-4 6 4M12 3v18",
    available: true,
  },
];

export const ORPHAN_SCREENS_GROUP = "الشاشات اليتيمة";

export const ORPHAN_SCREENS_GROUP_ICON =
  "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM16 16h2v2h-2zM20 16h2v2h-2zM16 20h2v2h-2zM20 20h2v2h-2z";

export const ORPHAN_SCREENS_PAGE_IDS: PageId[] = ORPHAN_SCREENS_NAV.map(
  (n) => n.id,
);

export function orphanScreensNavForRole(
  rolePages: PageId[],
): OrphanScreenNavItem[] {
  return ORPHAN_SCREENS_NAV.filter((item) => rolePages.includes(item.id)).map(
    (item) => ({
      ...item,
      available: true,
    }),
  );
}

export function isInOrphanScreensSection(page: PageId): boolean {
  return ORPHAN_SCREENS_PAGE_IDS.includes(page);
}

export function showOrphanScreensGroup(rolePages: PageId[]): boolean {
  return orphanScreensNavForRole(rolePages).length > 0;
}
