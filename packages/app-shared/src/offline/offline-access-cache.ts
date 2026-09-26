import type { PermissionsDto } from "@platform/api-client";
import { OFFLINE_ACCESS_STORAGE_KEY } from "@platform/offline-client";
import { currentOfflineUserId, isOfflineCapableRole } from "./offline-write";

type StoredOfflineAccess = {
  userId: string;
  permissions: PermissionsDto;
};

/** Mirrors `roleFromPermissions`: an admin/CDO identity role outranks the prototype role. */
function isOfflineCapableAccess(permissions: PermissionsDto): boolean {
  const admin = permissions.identityRoles?.some((role) => {
    const r = role.toLowerCase();
    return r === "cdo" || r === "admin";
  });
  if (admin) return false;
  return isOfflineCapableRole(permissions.prototypeRole?.trim().toLowerCase());
}

/**
 * Keeps the last permissions of a field inspector / government reviewer on the device.
 * Without it an offline cold start cannot resolve the role, so the user lands on the
 * wrong screen and offline sync stays off. Other roles never store anything. Personal
 * fields are left out — the session already carries the display name.
 */
export function rememberOfflineAccess(
  userId: string,
  permissions: PermissionsDto,
): void {
  try {
    if (!isOfflineCapableAccess(permissions)) {
      localStorage.removeItem(OFFLINE_ACCESS_STORAGE_KEY);
      return;
    }
    const stored: StoredOfflineAccess = {
      userId,
      permissions: {
        userId: permissions.userId,
        identityRoles: permissions.identityRoles,
        prototypeRole: permissions.prototypeRole,
        distributionAssigneeId: permissions.distributionAssigneeId,
        pages: permissions.pages,
        capabilities: permissions.capabilities,
      },
    };
    localStorage.setItem(OFFLINE_ACCESS_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* Storage blocked — the app still works online. */
  }
}

/** The stored permissions, only for the user they were saved for. */
export function readOfflineAccess(userId: string): PermissionsDto | null {
  try {
    const raw = localStorage.getItem(OFFLINE_ACCESS_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredOfflineAccess;
    if (stored?.userId !== userId || !stored.permissions) return null;
    return stored.permissions;
  } catch {
    return null;
  }
}

/**
 * The signed-in user is a field inspector / government reviewer (their access is
 * cached on this device). Reads use it to answer offline with the downloaded copy —
 * or an empty list — instead of a connection error (spec §4.2 forbids those).
 */
export function isOfflineFieldSession(): boolean {
  const userId = currentOfflineUserId();
  return Boolean(userId && readOfflineAccess(userId));
}
