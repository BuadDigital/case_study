"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  getValidAuthSession,
  isSessionExpired,
  getAuthSession,
  notifyAuthExpired,
  subscribeAuthExpired,
} from "@platform/auth-client";

/** Watches JWT expiry and redirects to login on auth loss. */
export function AuthSessionWatcher() {
  const router = useRouter();

  useEffect(() => {
    const redirect = () => router.replace("/login");
    const unsubscribe = subscribeAuthExpired(redirect);

    const timer = window.setInterval(() => {
      const session = getAuthSession();
      if (session && isSessionExpired(session)) {
        notifyAuthExpired();
      } else if (!getValidAuthSession()) {
        notifyAuthExpired();
      }
    }, 30_000);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [router]);

  return null;
}
