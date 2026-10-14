/**
 * The two calls behind the login screen: ask for a code, then exchange it for a session.
 * Pure fetch wrappers — the page owns the state and the copy around them.
 */

import { getApiBase, repositoryFetch as fetch } from "@platform/api-client";
import type { AuthSession } from "@platform/auth-client";

type LoginResponse = {
  token: string;
  expiresAtUtc: string;
  refreshToken?: string;
  refreshTokenExpiresAtUtc?: string;
  user: { id: string; displayName: string; jobTitle?: string };
};

type OtpRequestResponse = {
  retryAfterSeconds: number;
  expiresInSeconds: number;
  delivery: "sms" | "dev";
};

export type OtpRequestResult =
  | { ok: true; retryAfterSeconds: number }
  | { ok: false; message: string; retryAfterSeconds?: number };

export type OtpVerifyResult =
  | { ok: true; session: AuthSession }
  | { ok: false; message: string };

const TIMED_OUT =
  "انتهت مهلة الاتصال. تأكد أن الخادم يعمل (npm run dev:api) وانتظر حتى يظهر login-ready.";

function connectionFailedMessage(): string {
  return typeof window !== "undefined" && !/localhost|127\.0\.0\.1/.test(window.location.hostname)
    ? "تعذّر الاتصال بالخادم. على جهاز المضيف: شغّل npm run dev:api، وافتح المنفذين 3000 و5160 (open-firewall.ps1 كمسؤول)."
    : "تعذّر الاتصال بالخادم. تأكد أن npm run dev:api يعمل على هذا الجهاز (المنفذ 5160).";
}

function failureMessage(err: unknown): string {
  const timedOut = err instanceof DOMException && err.name === "AbortError";
  return timedOut ? TIMED_OUT : connectionFailedMessage();
}

function messageOf(data: unknown): string | null {
  return data && typeof data === "object" && "message" in data && typeof data.message === "string"
    ? data.message
    : null;
}

/** Step 1: the server texts a code to the mobile (or logs it on a dev host). */
export async function requestLoginOtp(mobileDigits: string): Promise<OtpRequestResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${getApiBase()}/api/auth/otp/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: mobileDigits }),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as
      | OtpRequestResponse
      | { message?: string; retryAfterSeconds?: number }
      | null;
    if (res.ok && data && "retryAfterSeconds" in data) {
      return { ok: true, retryAfterSeconds: data.retryAfterSeconds ?? 30 };
    }
    const retryAfterSeconds =
      data && "retryAfterSeconds" in data && typeof data.retryAfterSeconds === "number"
        ? data.retryAfterSeconds
        : undefined;
    return {
      ok: false,
      message: messageOf(data) ?? "تعذّر إرسال رمز التحقق. تأكد من رقم الجوال وحاول مجدداً.",
      retryAfterSeconds,
    };
  } catch (err) {
    return { ok: false, message: failureMessage(err) };
  } finally {
    clearTimeout(timer);
  }
}

/** Step 2: the code for a session. One message for every refusal. */
export async function verifyLoginOtp(mobileDigits: string, code: string): Promise<OtpVerifyResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${getApiBase()}/api/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: mobileDigits, code }),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as LoginResponse | { message?: string } | null;
    if (!res.ok) {
      return { ok: false, message: messageOf(data) ?? "الرمز غير صحيح أو انتهت صلاحيته." };
    }
    if (!data || !("token" in data)) {
      return { ok: false, message: "استجابة غير متوقعة من الخادم." };
    }
    return {
      ok: true,
      session: {
        token: data.token,
        user: data.user,
        expiresAtUtc: data.expiresAtUtc,
        refreshToken: data.refreshToken,
        refreshTokenExpiresAtUtc: data.refreshTokenExpiresAtUtc,
      } satisfies AuthSession,
    };
  } catch (err) {
    console.error("login failed", err);
    return { ok: false, message: failureMessage(err) };
  } finally {
    clearTimeout(timer);
  }
}
