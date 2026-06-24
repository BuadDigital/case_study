"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import type { PageId, RoleId } from "@platform/types";
import { getValidAuthSession } from "@platform/auth-client";
import { ROLES } from "@platform/app-shared/prototype/constants";
import { pagesFromPermissions } from "@platform/app-shared/prototype/permissions-pages";
import { setRuntimeCapabilities } from "@platform/app-shared/prototype/runtime-access";
import { usePermissionsQuery } from "@platform/app-shared/query/permissions-queries";

type Ctx = {  
  role: RoleId;
  authReady: boolean;
  viewerEmail: string | null;
  viewerDisplayName: string | null;
  distributionAssigneeId: string | null;
  rolePages: PageId[];
  capabilities: string[];
  hasCapability: (capability: string) => boolean;
};

const AppAccessContext = createContext<Ctx | null>(null);

function roleFromPermissions(
  prototypeRole: string | null | undefined,
  identityRoles: readonly string[] | undefined,
): RoleId {
  if (
    identityRoles?.some(
      (role) =>
        role.toLowerCase() === "cdo" || role.toLowerCase() === "admin",
    )
  ) {
    return "cdo";
  }

  const apiRole = prototypeRole?.trim().toLowerCase();
  if (apiRole && apiRole in ROLES) return apiRole as RoleId;
  return "general-manager";
}

export function PrototypeProvider({ children }: { children: React.ReactNode }) {
  const session = getValidAuthSession();
  const hasSession = Boolean(session?.token);

  const {
    data: permissions,
    isSuccess,
    isError,
  } = usePermissionsQuery(hasSession);

  useEffect(() => {
    if (permissions) setRuntimeCapabilities(permissions.capabilities);
  }, [permissions]);

  const role = useMemo(
    () =>
      roleFromPermissions(
        permissions?.prototypeRole,
        permissions?.identityRoles,
      ),
    [permissions?.prototypeRole, permissions?.identityRoles],
  );

  const capabilities = permissions?.capabilities ?? [];

  const rolePages = useMemo(() => {
    if (permissions?.pages?.length) return pagesFromPermissions(permissions.pages);
    return ["dashboard"] as PageId[];
  }, [permissions]);

  const authReady = hasSession && (isSuccess || isError);

  const value = useMemo<Ctx>(
    () => ({
      role,
      authReady,
      viewerEmail: session?.user.email ?? null,
      viewerDisplayName:
        permissions?.displayName?.trim() ||
        session?.user.displayName?.trim() ||
        null,
      distributionAssigneeId: permissions?.distributionAssigneeId?.trim() || null,
      rolePages,
      capabilities,
      hasCapability: (capability) => capabilities.includes(capability),
    }),
    [
      role,
      authReady,
      session?.user.email,
      session?.user.displayName,
      permissions?.displayName,
      permissions?.distributionAssigneeId,
      rolePages,
      capabilities,
    ],
  );

  return (
    <AppAccessContext.Provider value={value}>{children}</AppAccessContext.Provider>
  );
}

export function usePrototype() {
  const v = useContext(AppAccessContext);
  if (!v) throw new Error("usePrototype must be used within PrototypeProvider");
  return v;
}
