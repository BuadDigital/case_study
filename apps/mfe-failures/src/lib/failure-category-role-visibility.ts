import type { RoleId } from "@platform/types";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";

/**
 * Visibility of failure-type categories when raising a failure.
 * Supervisor / super-admin see every category.
 *
 * 1. deed-documents — all roles
 * 2. location — field-inspector + engineering-office
 * 3. ownership — all roles
 * 4. access — field-inspector only
 * 5. contents — field-inspector + case-specialist
 * 6. parties — field-inspector + engineering-office
 */
const ALL_ROLES: "all" = "all";

type CategoryAudience = "all" | readonly RoleId[];

const CATEGORY_AUDIENCE: Record<string, CategoryAudience> = {
  "deed-documents": ALL_ROLES,
  location: ["field-inspector", "engineering-office"],
  ownership: ALL_ROLES,
  access: ["field-inspector"],
  contents: ["field-inspector", "case-specialist"],
  parties: ["field-inspector", "engineering-office"],
};

export function roleSeesAllFailureCategories(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "section-supervisor";
}

export function canRoleSeeFailureCategory(
  role: RoleId,
  categoryId: string,
): boolean {
  if (roleSeesAllFailureCategories(role)) return true;
  const audience = CATEGORY_AUDIENCE[categoryId];
  if (!audience) return true;
  if (audience === ALL_ROLES) return true;
  return audience.includes(role);
}

export function filterFailureCategoriesForRole<T extends { id: string }>(
  role: RoleId,
  categories: T[],
): T[] {
  return categories.filter((category) =>
    canRoleSeeFailureCategory(role, category.id),
  );
}

export function filterFailureProblemTypesForRole<
  T extends { categoryId: string },
>(role: RoleId, problemTypes: T[]): T[] {
  return problemTypes.filter((type) =>
    canRoleSeeFailureCategory(role, type.categoryId),
  );
}
