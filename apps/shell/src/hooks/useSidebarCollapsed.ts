"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export const SIDEBAR_COLLAPSED_KEY = "ejada.sidebar.collapsed";

export function readSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Desktop icon-rail preference: hydrated after mount, persisted on change. */
export function useSidebarCollapsed(): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate desktop rail preference after mount.
    setCollapsed(readSidebarCollapsed());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore quota / private mode */
    }
  }, [collapsed]);

  return [collapsed, setCollapsed];
}
