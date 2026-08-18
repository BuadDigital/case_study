"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { activateAccount, getApiBase } from "@platform/api-client";
import { Button, Card, Input, Label, useToast } from "@platform/ui-kit";
import { EjadaLogo } from "@/components/views/EjadaLogo";

export default function ActivateAccountPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [userName, setUserName] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);
    try {
      const result = await activateAccount(getApiBase(), {
        userName: userName.trim(),
        token: token.trim(),
        newPassword: password,
      });

      if (!result.ok) {
        setError(
          result.kind === "network"
            ? "تعذر الاتصال بالخادم."
            : result.message ?? "تعذر تفعيل الحساب.",
        );
        return;
      }

      showToast("تم تفعيل الحساب. سجّل الدخول بكلمة المرور الجديدة.", "success");
      router.replace("/login");
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

        <h1 className="mb-1 text-xl font-semibold text-heading">تفعيل الحساب</h1>
        <p className="mb-6 text-[15px] leading-relaxed text-text-2">
          الصق رمز التفعيل الذي سلّمك إياه مسؤول النظام واختر كلمة مرورك.
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
            <Label htmlFor="activate-username">اسم الدخول أو البريد الإلكتروني</Label>
            <Input
              id="activate-username"
              autoComplete="username"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
              dir="ltr"
            />
          </div>
          <div>
            <Label htmlFor="activate-token">رمز التفعيل</Label>
            <textarea
              id="activate-token"
              rows={3}
              required
              dir="ltr"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full resize-none rounded-lg border border-border bg-surface p-2 font-mono text-[11px] text-text"
            />
          </div>
          <div>
            <Label htmlFor="activate-password">كلمة المرور الجديدة</Label>
            <Input
              id="activate-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              dir="ltr"
            />
          </div>
          <div>
            <Label htmlFor="activate-confirm">تأكيد كلمة المرور</Label>
            <Input
              id="activate-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              dir="ltr"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            disabled={loading || !userName.trim() || !token.trim() || !password}
            className="mt-1 w-full"
            showActionToast={false}
            actionLabel="تفعيل"
          >
            تفعيل الحساب
          </Button>
        </form>
      </Card>
    </div>
  );
}
