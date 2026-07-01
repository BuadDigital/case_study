"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchDevLoginUsers, fetchPermissions, getApiBase } from "@platform/api-client";
import { setAuthSession, type AuthSession, getValidAuthSession } from "@platform/auth-client";
import { PROTOTYPE_LOGIN_USERS, sortLoginUsersForPicker } from "@platform/app-shared/prototype/prototype-users";
import { defaultLandingPath } from "@platform/app-shared/prototype/page-access";
import { pagesFromPermissions } from "@platform/app-shared/prototype/permissions-pages";
import { Button, Card, Label, Select, useToast } from "@platform/design-system";

type LoginResponse = {
  token: string;
  expiresAtUtc: string;
  user: { id: string; email: string; displayName: string };
};

type LoginUserOption = {
  username: string;
  label: string;
};

async function resolvePostLoginPath(token: string): Promise<string> {
  try {
    const permissions = await fetchPermissions({ token });
    return defaultLandingPath(
      pagesFromPermissions(permissions.pages ?? [], {
        prototypeRole: permissions.prototypeRole,
      }),
    );
  } catch {
    return "/active-primary-data";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loginUsers, setLoginUsers] = useState<LoginUserOption[]>([]);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const session = getValidAuthSession();
    if (!session) return;
    setAuthSession(session);
    void resolvePostLoginPath(session.token).then((path) => {
      router.replace(path);
    });
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => router.prefetch("/po"), 2000);
    return () => window.clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void fetchDevLoginUsers(getApiBase()).then((result) => {
      if (cancelled) return;
      if (result.ok && result.users.length > 0) {
        const users = sortLoginUsersForPicker(result.users);
        setLoginUsers(users);
        setUsername(users[0]?.username ?? "");
        return;
      }
      const fallback = sortLoginUsersForPicker(
        PROTOTYPE_LOGIN_USERS.map((user) => ({
          username: user.username,
          label: user.label,
        })),
      );
      setLoginUsers(fallback);
      setUsername(fallback[0]?.username ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const value = username.trim();
    if (!value) {
      setError("اكتب اسم المستخدم");
      return;
    }
    setLoading(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      let res: Response;
      try {
        res = await fetch(`${getApiBase()}/api/auth/login-username`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: value }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      const data = (await res.json().catch(() => null)) as
        | LoginResponse
        | { message?: string }
        | null;

      if (!res.ok) {
        const msg =
          data && "message" in data && typeof data.message === "string"
            ? data.message
            : "اسم المستخدم غير موجود.";
        setError(msg);
        return;
      }

      if (!data || !("token" in data)) {
        setError("استجابة غير متوقعة من الخادم.");
        return;
      }

      setAuthSession({
        token: data.token,
        user: data.user,
        expiresAtUtc: data.expiresAtUtc,
      } satisfies AuthSession);

      showToast("تم تسجيل الدخول !", "success");

      const landingPath = await resolvePostLoginPath(data.token);
      router.replace(landingPath);
    } catch (err) {
      console.error("login failed", err);
      const timedOut =
        err instanceof DOMException && err.name === "AbortError";
      setError(
        timedOut
          ? "انتهت مهلة الاتصال. تأكد أن الخادم يعمل (npm run dev:api) وانتظر حتى يظهر login-ready."
          : typeof window !== "undefined" &&
              !/localhost|127\.0\.0\.1/.test(window.location.hostname)
            ? "تعذر الاتصال بالخادم. على جهاز المضيف: شغّل npm run dev:api، وافتح المنفذين 3000 و5160 (open-firewall.ps1 كمسؤول)."
            : "تعذر الاتصال بالخادم. تأكد أن npm run dev:api يعمل على هذا الجهاز (المنفذ 5160).",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-surface-2 p-4 sm:p-10">
      <Card className="w-full max-w-md border-s-[3px] border-s-primary p-6 sm:p-10">
        <div className="mb-7 flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-white"
            aria-hidden
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9,22 9,12 15,12 15,22" />
            </svg>
          </div>
          <div>
            <div className="text-lg font-semibold text-text">
              نظام إجادة الداخلي
            </div>
            <div className="text-sm text-text-3">دراسة الحالة</div>
          </div>
        </div>

        <h1 className="mb-1 text-xl font-semibold text-text">تسجيل الدخول</h1>
        <p className="mb-6 text-[15px] leading-relaxed text-text-2">
          اختر حسابًا نشطًا من قاعدة البيانات للدخول مباشرة — بدون كلمة مرور.
        </p>

        {error ? (
          <div
            className="mb-4 rounded-lg border-e-[3px] border-e-danger bg-danger-bg px-3 py-2.5 text-sm leading-relaxed text-danger-text"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4" suppressHydrationWarning>
          <div>
            <Label htmlFor="username">اسم المستخدم</Label>
            <Select
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              dir="rtl"
              suppressHydrationWarning
            >
              <option value="" disabled>
                {loginUsers.length === 0
                  ? "جاري تحميل المستخدمين…"
                  : "— اختر مستخدمًا —"}
              </option>
              {loginUsers.map((user) => (
                <option key={user.username} value={user.username}>
                  {user.label}
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            disabled={loading || loginUsers.length === 0}
            className="mt-1 w-full"
            showActionToast={false}
            actionLabel="دخول"
          >
            دخول
          </Button>
        </form>
      </Card>
    </div>
  );
}
