"use client";

import { createContext, use, useEffect, useMemo } from "react";
import type { PageId, RoleId } from "@platform/types";
import { ROLES } from "@platform/app-shared/prototype/constants";
import { pagesFromPermissions } from "@platform/app-shared/prototype/permissions-pages";
import { setRuntimeCapabilities } from "@platform/app-shared/prototype/runtime-access";
import { usePermissionsQuery } from "@platform/app-shared/query/permissions-queries";
import { useValidAuthSession } from "../auth/use-auth-session";

type Ctx = {
  role: RoleId;
  authReady: boolean;
  viewerEmail: string | null;
  viewerDisplayName: string | null;
  distributionAssigneeId: string | null;
  department: string | null;
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

const EMPTY_CAPABILITIES: string[] = [];

export function PrototypeProvider({ children }: { children: React.ReactNode }) {
  // useSyncExternalStore keeps hasSession in sync after silent refresh / logout,
  // including the first client paint after a hard navigation into a deep link.
  const session = useValidAuthSession();
  const hasSession = Boolean(session?.token);

  const {
    data: permissions,
    isSuccess,
    isError,
  } = usePermissionsQuery(hasSession);

  const permissionsResolved = isSuccess || isError;

  // Keep helpers in sync during the same render as permissions — do not wait for
  // useEffect or queryFn may run with a stale empty capability list.
  if (!hasSession) {
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

  const role = useMemo(() => {
    if (!permissionsResolved) return "general-manager";
    return roleFromPermissions(
      permissions?.prototypeRole,
      permissions?.identityRoles,
    );
  }, [
    permissionsResolved,
    permissions?.prototypeRole,
    permissions?.identityRoles,
  ]);

  // مرجع ثابت — [] جديدة كل تصيير كانت تكسر useMemo قيمة السياق قبل المصادقة
  // فتتغير هوية القيمة لكل مستهلكي usePrototype (rerender-dependencies).
  const capabilities = permissions?.capabilities ?? EMPTY_CAPABILITIES;

  const rolePages = useMemo(() => {
    if (!permissionsResolved) return [];
    const baseline = ROLES[role].pages.filter((page) => {
      // «جميع المعاملات» — للمسؤول فقط (مرآة لـ pagesFromPermissions)
      if (role !== "cdo" && page === "all-transactions") return false;
      return true;
    });
    if (permissions?.pages?.length) {
      const fromApi = pagesFromPermissions(permissions.pages, {
        prototypeRole: permissions.prototypeRole,
      });
      return [...new Set<PageId>([...fromApi, ...baseline])];
    }
    return baseline;
  }, [permissionsResolved, permissions, role]);

  const authReady = hasSession && permissionsResolved;

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
      department: permissions?.department?.trim() || null,
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
      permissions?.department,
      rolePages,
      capabilities,
    ],
  );

  return (
    <AppAccessContext.Provider value={value}>{children}</AppAccessContext.Provider>
  );
}

export function usePrototype() {
  const v = use(AppAccessContext);
  if (!v) throw new Error("usePrototype must be used within PrototypeProvider");
  return v;
}
