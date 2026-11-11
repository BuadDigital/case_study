"use client";

import { createContext, use, useEffect, useMemo } from "react";
import type { CaseSpecialistSubRole, PageId, RoleId } from "@platform/types";
import {
  subRolesFromPermissions,
  type StaffAccess,
} from "@platform/app-shared/app-data/case-specialist-sub-roles";
import { setRuntimeCapabilities } from "@platform/app-shared/app-data/runtime-access";
import { usePermissionsQuery } from "@platform/app-shared/query/permissions-queries";
import { useUsableAuthSession } from "../auth/use-auth-session";
import { roleFromPermissions, rolePagesFromPermissions } from "./app-access-role";

/** Least-privilege placeholder while access is unresolved or refused — never GM. */
const PLACEHOLDER_ROLE: RoleId = "field-inspector";

type Ctx = {
  role: RoleId;
  /** Case-specialist sub-roles (coordination / study / review); empty for other roles. */
  subRoles: readonly CaseSpecialistSubRole[];
  /** Role + sub-roles, the argument of the sub-role helpers in po-roles.ts. */
  access: StaffAccess;
  authReady: boolean;
  /** Permissions request failed or the role is unknown — no GM fallback. */
  permissionsFailed: boolean;
  retryPermissions: () => void;
  viewerUserId: string | null;
  viewerDisplayName: string | null;
  /** Staff job title — preferred chip subtitle; catalog dept is only a fallback. */
  viewerJobTitle: string | null;
  distributionAssigneeId: string | null;
  department: string | null;
  rolePages: PageId[];
  capabilities: string[];
  hasCapability: (capability: string) => boolean;
};

const AppAccessContext = createContext<Ctx | null>(null);

const EMPTY_CAPABILITIES: string[] = [];

export function AppAccessProvider({ children }: { children: React.ReactNode }) {
  // useSyncExternalStore keeps hasSession in sync after silent refresh / logout,
  // including the first client paint after a hard navigation into a deep link.
  // A field user offline keeps their session past access-token expiry.
  const session = useUsableAuthSession();
  const hasSession = Boolean(session?.token);

  const {
    data: permissions,
    isSuccess,
    isError,
    refetch,
  } = usePermissionsQuery(hasSession);

  const permissionsResolved = isSuccess || isError;

  const resolvedRole = useMemo(
    () =>
      roleFromPermissions(
        permissions?.prototypeRole,
        permissions?.identityRoles,
      ),
    [permissions?.prototypeRole, permissions?.identityRoles],
  );

  const permissionsFailed =
    (hasSession && isError) || (isSuccess && resolvedRole == null);

  const role = resolvedRole ?? PLACEHOLDER_ROLE;
  const rawSubRoles = permissions?.subRoles;
  const subRoles = useMemo(
    () => (permissionsFailed ? [] : subRolesFromPermissions(resolvedRole, rawSubRoles)),
    [permissionsFailed, resolvedRole, rawSubRoles],
  );
  const access = useMemo<StaffAccess>(() => ({ role, subRoles }), [role, subRoles]);

  // Keep helpers in sync during the same render as permissions — do not wait for
  // useEffect or queryFn may run with a stale empty capability list.
  if (!hasSession || permissionsFailed || resolvedRole == null) {
    setRuntimeCapabilities([]);
  } else if (permissions) {
    setRuntimeCapabilities(permissions.capabilities);
  }

  useEffect(() => {
    if (!hasSession) return;
    void import("../organization/organization-settings-cache").then((m) =>
      m.ensureOrganizationSettingsLoaded(),
    );
  }, [hasSession]);

  // Stable ref — a fresh [] each render used to break the pre-auth context useMemo
  // so value identity changed for every useAppAccess consumer (rerender-dependencies).
  const capabilities =
    permissionsFailed || resolvedRole == null
      ? EMPTY_CAPABILITIES
      : (permissions?.capabilities ?? EMPTY_CAPABILITIES);

  const rolePages = useMemo(() => {
    if (!permissionsResolved || permissionsFailed || resolvedRole == null) {
      return [];
    }
    // The same rule the login lands by (`rolePagesFromPermissions`).
    return rolePagesFromPermissions(permissions);
  }, [permissionsResolved, permissionsFailed, permissions, resolvedRole]);

  const authReady = hasSession && permissionsResolved;

  const viewerUserId = session?.user.id ?? null;
  const viewerDisplayName =
    permissions?.displayName?.trim() ||
    session?.user.displayName?.trim() ||
    null;
  const viewerJobTitle =
    permissions?.jobTitle?.trim() ||
    session?.user.jobTitle?.trim() ||
    null;
  const distributionAssigneeId =
    permissions?.distributionAssigneeId?.trim() || null;
  const department = permissions?.department?.trim() || null;

  const value = useMemo<Ctx>(
    () => ({
      role,
      subRoles,
      access,
      authReady,
      permissionsFailed,
      retryPermissions: () => {
        void refetch();
      },
      viewerUserId,
      viewerDisplayName,
      viewerJobTitle,
      distributionAssigneeId,
      department,
      rolePages,
      capabilities,
      hasCapability: (capability) => capabilities.includes(capability),
    }),
    [
      role,
      subRoles,
      access,
      authReady,
      permissionsFailed,
      refetch,
      viewerUserId,
      viewerDisplayName,
      viewerJobTitle,
      distributionAssigneeId,
      department,
      rolePages,
      capabilities,
    ],
  );

  return (
    <AppAccessContext.Provider value={value}>{children}</AppAccessContext.Provider>
  );
}

export function useAppAccess() {
  const v = use(AppAccessContext);
  if (!v) throw new Error("useAppAccess must be used within AppAccessProvider");
  return v;
}
