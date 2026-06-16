import type { NavItem, PageId } from "@platform/types";

/** دليل الشاشات */
export const SYSTEM_SCREEN_CATALOG_NAV_ITEM: NavItem = {
  id: "system-screen-catalog",
  label: "دليل الشاشات",
  icon: "M4 5h16v4H4zM4 13h10v6H4zM16 13h4v6h-4z",
  grp: null,
};

export const SYSTEM_SCREEN_CATALOG_PAGE_ID: PageId =
  SYSTEM_SCREEN_CATALOG_NAV_ITEM.id;

export function isSystemScreenCatalogPage(page: PageId): boolean {
  return page === SYSTEM_SCREEN_CATALOG_PAGE_ID;
}
