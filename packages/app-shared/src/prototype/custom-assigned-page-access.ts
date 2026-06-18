import type { CustomAssignedScreen, PageId, RoleId } from "@platform/types";
import { isPageId } from "@platform/types";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";

/** Page ids the user may open via CDO-assigned custom screens (linked legacy pages). */
export function pageIdsFromCustomAssignedScreens(
  screens: readonly CustomAssignedScreen[],
): PageId[] {
  const ids = new Set<PageId>();
  for (const screen of screens) {
    if (!screen.isActive) continue;
    const target = screen.targetPageId?.trim();
    if (!target || !isPageId(target)) continue;
    ids.add(target);
  }
  return [...ids];
}

export function canAccessPage(
  pageId: PageId,
  rolePages: readonly PageId[],
  customAssignedScreens: readonly CustomAssignedScreen[],
): boolean {
  if (pageId === "dashboard") return true;
  if (rolePages.includes(pageId)) return true;
  return pageIdsFromCustomAssignedScreens(customAssignedScreens).includes(pageId);
}

/** CDO-assigned linked page — viewer sees the full queue/data, not only their role slice. */
export function viewerSeesFullPageData(
  pageId: PageId,
  role: RoleId,
  customAssignedScreens: readonly CustomAssignedScreen[],
): boolean {
  if (isSuperAdmin(role)) return true;
  return pageIdsFromCustomAssignedScreens(customAssignedScreens).includes(pageId);
}

export function mergeRolePagesWithCustomGrants(
  rolePages: readonly PageId[],
  customAssignedScreens: readonly CustomAssignedScreen[],
): PageId[] {
  return [...new Set([...rolePages, ...pageIdsFromCustomAssignedScreens(customAssignedScreens)])];
}
