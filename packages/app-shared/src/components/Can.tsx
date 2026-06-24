"use client";

import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import type { PageId, RoleId } from "@platform/types";
import { usePrototype } from "../contexts/PrototypeContext";
import { canAccessPage } from "../prototype/page-access";

type CanProps = {
  children: ReactNode;
  capability?: string;
  page?: PageId;
  role?: RoleId;
  /** hide = render fallback; disable = pass disabled to single child */
  mode?: "hide" | "disable";
  fallback?: ReactNode;
  deniedTitle?: string;
};

export function Can({
  children,
  capability,
  page,
  role,
  mode = "hide",
  fallback = null,
  deniedTitle = "غير مصرح",
}: CanProps) {
  const { hasCapability, role: userRole, rolePages } = usePrototype();

  let allowed = true;
  if (capability) allowed = hasCapability(capability);
  if (page) allowed = allowed && canAccessPage(page, rolePages);
  if (role) allowed = allowed && userRole === role;

  if (allowed) return children;

  if (mode === "disable" && isValidElement(children)) {
    return cloneElement(children as ReactElement<{ disabled?: boolean; title?: string }>, {
      disabled: true,
      title: deniedTitle,
    });
  }

  return fallback;
}

export function useCapability(capability: string): boolean {
  const { hasCapability } = usePrototype();
  return hasCapability(capability);
}
