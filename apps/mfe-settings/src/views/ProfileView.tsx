"use client";

import { useEffect, useState } from "react";
import { getAuthSession } from "@platform/auth-client";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import { Note, Spinner } from "@platform/design-system";
import { UserProfileContent } from "../components/UserProfileContent";
import { fetchCurrentStaffProfile } from "../lib/users-api";

export function ProfileView() {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const session = getAuthSession()?.user;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const profile = await fetchCurrentStaffProfile(
          session
            ? {
                id: session.id,
                name: session.displayName,
                role: "",
                email: session.email,
              }
            : undefined,
        );
        if (cancelled) return;
        if (!profile) {
          setError("تعذر تحميل البروفايل.");
          setUser(null);
          return;
        }
        setUser(profile);
      } catch {
        if (!cancelled) {
          setError("تعذر تحميل البروفايل.");
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    /* Scroll عبر #content في الـ shell — بدون flex-1/overflow داخلي يمنع النزول */
    <div className="bg-surface-2 px-4 pb-8 pt-5 sm:px-6 sm:pb-10 sm:pt-6" dir="rtl">
      <section className="overflow-hidden rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-text-3">
            <Spinner />
            <span className="text-[13px]">جاري تحميل البروفايل…</span>
          </div>
        ) : error ? (
          <Note tone="danger">{error}</Note>
        ) : user ? (
          <UserProfileContent user={user} />
        ) : (
          <Note tone="warning">لا توجد بيانات للعرض.</Note>
        )}
      </section>
    </div>
  );
}
