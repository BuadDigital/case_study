import type { CustomAssignedScreen, PageId } from "@platform/types";
import { PAGE_TITLES } from "@platform/app-shared/prototype/constants";
import type {
  ScreenCatalogStatus,
  SystemScreenEntry,
} from "@platform/app-shared/prototype/screen-catalog";

export const CUSTOM_SCREEN_CATALOG_GROUP = "شاشات مخصصة";

export function isCustomCatalogEntryId(id: string): boolean {
  return id.startsWith("custom:");
}

export function customCatalogEntryId(screenId: string): string {
  return `custom:${screenId}`;
}

export function customScreenIdFromCatalogEntry(id: string): string | null {
  return isCustomCatalogEntryId(id) ? id.slice("custom:".length) : null;
}

export function customScreenToCatalogEntry(
  screen: CustomAssignedScreen,
): SystemScreenEntry {
  const hasFields = (screen.definition?.bindings.length ?? 0) > 0;
  const status: ScreenCatalogStatus =
    screen.screenStatus === "موجودة" || hasFields ? "جاهزة" : "قيد التطوير";
  return {
    id: customCatalogEntryId(screen.id),
    name: screen.name,
    path: `/custom-screen/${screen.id}`,
    whereToFind: "القائمة الجانبية — شاشة مخصصة",
    group: CUSTOM_SCREEN_CATALOG_GROUP,
    kind: "page",
    status,
    roles: [],
    notes: screen.isActive ? undefined : "معطّلة — لا تظهر في القائمة الجانبية",
  };
}

export function dynamicCustomCatalogEntries(
  screens: readonly CustomAssignedScreen[],
): SystemScreenEntry[] {
  return screens
    .filter((screen) => !screen.targetPageId?.trim())
    .map(customScreenToCatalogEntry);
}

export function customScreensForPage(
  screens: readonly CustomAssignedScreen[],
  pageId: PageId,
): CustomAssignedScreen[] {
  return screens.filter((screen) => screen.targetPageId?.trim() === pageId);
}

export function assignedUsersForPage(
  screens: readonly CustomAssignedScreen[],
  pageId: PageId,
): CustomAssignedScreen["assignedUsers"] {
  const byId = new Map<
    string,
    NonNullable<CustomAssignedScreen["assignedUsers"]>[number]
  >();
  for (const screen of customScreensForPage(screens, pageId)) {
    for (const user of screen.assignedUsers ?? []) {
      byId.set(user.id, user);
    }
  }
  return [...byId.values()];
}

export function assignedUserIdsForPage(
  screens: readonly CustomAssignedScreen[],
  pageId: PageId,
): string[] {
  return assignedUsersForPage(screens, pageId).map((user) => user.id);
}

export function linkedScreenDisplayName(pageId: PageId): string {
  return PAGE_TITLES[pageId] ?? pageId;
}

export function primaryCustomScreenForPage(
  screens: readonly CustomAssignedScreen[],
  pageId: PageId,
): CustomAssignedScreen | null {
  const linked = customScreensForPage(screens, pageId);
  if (linked.length === 0) return null;
  return [...linked].sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null;
}
