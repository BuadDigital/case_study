import type { StaffUser } from "./constants";

const USER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when a stored label is a platform user id (GUID), not a person name. */
function looksLikeUserId(value: string | null | undefined): boolean {
  const v = value?.trim() ?? "";
  return v.length > 0 && USER_ID_RE.test(v);
}

const staffIndexCache = new WeakMap<StaffUser[], Map<string, StaffUser>>();

function staffById(staff: StaffUser[]): Map<string, StaffUser> {
  let index = staffIndexCache.get(staff);
  if (!index) {
    index = new Map(staff.map((u) => [u.id, u]));
    staffIndexCache.set(staff, index);
  }
  return index;
}

/**
 * Never show raw user GUIDs in the UI. Prefer a real name; otherwise empty/`fallback`.
 * Optional `staffUsers` resolves ids via `StaffUser.id`.
 */
export function displayPersonName(
  value: string | null | undefined,
  options?: {
    userId?: string | null;
    staffUsers?: StaffUser[];
    fallback?: string;
  },
): string {
  const fallback = options?.fallback ?? "";
  const raw = value?.trim() ?? "";
  if (raw && !looksLikeUserId(raw)) return raw;

  const staff = options?.staffUsers;
  if (staff?.length) {
    const byId = staffById(staff);
    for (const key of [options?.userId, raw]) {
      const id = key?.trim() ?? "";
      if (!id) continue;
      const hit = byId.get(id);
      const name = hit?.name?.trim();
      if (name) return name;
    }
  }

  return fallback;
}
