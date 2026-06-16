"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@platform/api-client";
import { setAuthSession, type AuthSession } from "@platform/auth-client";
import { Button, Card, Input, Label } from "@platform/design-system";
import { applyPrototypeRoleForEmail } from "@/lib/auth-role-map";

type LoginResponse = {
  token: string;
  expiresAtUtc: string;
  user: { id: string; email: string; displayName: string };
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@local.dev");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json().catch(() => null)) as
        | LoginResponse
        | { message?: string }
        | null;

      if (!res.ok) {
        const msg =
          data && "message" in data && typeof data.message === "string"
            ? data.message
            : "تعذر تسجيل الدخول. تحقق من البيانات أو اتصال الخادم.";
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
      applyPrototypeRoleForEmail(data.user.email);
      router.push("/dashboard");
    } catch (err) {
      console.error("login failed", err);
      setError(
        "تعذر الاتصال بالخادم. تأكد أن dotnet run يعمل على هذا الجهاز (المنفذ 5160).",
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

        <form method="post" action="#" onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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
              minLength={6}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={loading}
            className="mt-1 w-full"
          >
            {loading ? "جاري التحقق…" : "دخول"}
          </Button>
        </form>

        <p className="mt-7 text-[13px] leading-relaxed text-text-3">
          CDO:{" "}
          <strong className="text-text-2">s.salhy@gmail.com</strong> /{" "}
          <strong className="text-text-2">sliman123</strong>
          <br />
          إدارة المنظمة: آلاء (HR) · علي (المالية والعقود) · شهد (CRM) — كلمات
          المرور كما في الإعداد. سليمان (CDO) ينشئ حساباتهم.
          <br />
          تجريبي قديم:{" "}
          <strong className="text-text-2">admin@local.dev</strong> /{" "}
          <strong className="text-text-2">Admin123!</strong>
        </p>
      </Card>
    </div>
  );
}
