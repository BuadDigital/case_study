import type { RoleId } from "@platform/types";
import { ROLES } from "../constants";

/** أدوار لا تُعرض في إسناد الحقول (إدارة منظمة / مسؤول تقني). */
export const FIELD_DICTIONARY_EXCLUDED_ROLES: RoleId[] = [
  "cdo",
];

/** أدوار النظام التشغيلية — مأخوذة من `ROLES` وليس من وثائق خارجية. */
export function fieldDictionaryRoleIds(): RoleId[] {
  return (Object.keys(ROLES) as RoleId[]).filter(
    (roleId) => !FIELD_DICTIONARY_EXCLUDED_ROLES.includes(roleId),
  );
}

export function fieldDictionaryRoleLabel(roleId: RoleId): string {
  return ROLES[roleId]?.dept ?? roleId;
}

export function roleIdsWithPageAccess(pageIds: string[]): RoleId[] {
  return fieldDictionaryRoleIds().filter((roleId) =>
    ROLES[roleId].pages.some((page) => pageIds.includes(page)),
  );
}
