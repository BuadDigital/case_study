"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchPermissions, getApiBase } from "@platform/api-client";
import {
  setAuthSession,
  type AuthSession,
  getValidAuthSession,
} from "@platform/auth-client";
import { defaultLandingPath } from "@platform/app-shared/prototype/page-access";
import { pagesFromPermissions } from "@platform/app-shared/prototype/permissions-pages";
import { Button, Card, Input, Label, useToast } from "@platform/design-system";
import { EjadaLogo } from "@/components/views/EjadaLogo";

type LoginResponse = {
  token: string;
  expiresAtUtc: string;
  refreshToken?: string;
  refreshTokenExpiresAtUtc?: string;
  user: { id: string; email: string; displayName: string };
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const value = email.trim();
    if (!value) {
      setError("اكتب البريد الإلكتروني");
      return;
    }
    if (!password) {
      setError("اكتب كلمة المرور");
      return;
    }
    setLoading(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      let res: Response;
      try {
        res = await fetch(`${getApiBase()}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // The API keeps the historical `username` JSON field, but accepts an email.
          body: JSON.stringify({ username: value, password }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      const data = (await res.json().catch(() => null)) as
        LoginResponse | { message?: string } | null;

      if (!res.ok) {
        const msg =
          data && "message" in data && typeof data.message === "string"
            ? data.message
            : "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
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
        refreshToken: data.refreshToken,
        refreshTokenExpiresAtUtc: data.refreshTokenExpiresAtUtc,
      } satisfies AuthSession);

      showToast("تم تسجيل الدخول !", "success");

      const landingPath = await resolvePostLoginPath(data.token);
      router.replace(landingPath);
    } catch (err) {
      console.error("login failed", err);
      const timedOut = err instanceof DOMException && err.name === "AbortError";
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
      <Card className="w-full max-w-md border-s-[3px] border-s-gold p-6 sm:p-10">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <EjadaLogo variant="onLight" className="h-auto w-45 max-w-full" />
          <div className="text-sm text-text-3">نظام دراسة الحالة</div>
        </div>

        <h1 className="mb-1 text-xl font-semibold text-heading">
          تسجيل الدخول
        </h1>
        <p className="mb-6 text-[15px] leading-relaxed text-text-2">
          أدخل البريد الإلكتروني وكلمة المرور للمتابعة.
        </p>

        {error ? (
          <div
            className="mb-4 rounded-lg border-e-[3px] border-e-danger bg-danger-bg px-3 py-2.5 text-sm leading-relaxed text-danger-text"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <form
          onSubmit={onSubmit}
          className="space-y-4"
          suppressHydrationWarning
        >
          <div>
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              dir="ltr"
              placeholder="name@example.com"
            />
          </div>
          <div>
            <Label htmlFor="password">كلمة المرور</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              dir="ltr"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            disabled={loading || !email.trim() || !password}
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
