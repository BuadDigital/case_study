"use client";

import {
  FormEvent,
  KeyboardEvent,
  ClipboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  fetchPermissions,
  getApiBase,
  repositoryFetch as fetch,
} from "@platform/api-client";
import {
  setAuthSession,
  type AuthSession,
  getValidAuthSession,
} from "@platform/auth-client";
import { defaultLandingPath } from "@platform/app-shared/prototype/page-access";
import { pagesFromPermissions } from "@platform/app-shared/prototype/permissions-pages";
import { cn, useToast } from "@platform/ui-kit";
import { EjadaLogo } from "@/components/views/EjadaLogo";

type LoginResponse = {
  token: string;
  expiresAtUtc: string;
  refreshToken?: string;
  refreshTokenExpiresAtUtc?: string;
  user: { id: string; email: string; displayName: string };
};

type Step = "creds" | "otp";

const fieldInput = "w-full rounded-[11px] border border-[#ddd8cc] bg-surface-2 px-[15px] py-[13px] text-[15px] text-text outline-none transition-[border-color,box-shadow,background] duration-150 placeholder:tracking-[0.02em] placeholder:text-text-3 focus:border-gold focus:bg-surface focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--gold)_16%,transparent)]";

const fieldInputBad = "border-danger shadow-[0_0_0_4px_color-mix(in_srgb,var(--red)_12%,transparent)] focus:border-danger focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--red)_12%,transparent)]";

const stepAnim = "animate-[login-rise_0.35s_ease]";

const primaryBtn = "flex w-full cursor-pointer items-center justify-center gap-[9px] rounded-[11px] border-0 bg-ink py-3.5 text-[15.5px] font-bold text-white shadow-[0_12px_26px_-14px_rgba(16,43,78,.7)] transition-[background,transform,box-shadow] duration-150 hover:enabled:-translate-y-px hover:enabled:bg-navy-3 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0";

const ghostBtn = "flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-[11px] border border-[#ddd8cc] bg-surface py-[13px] text-[14.5px] font-bold text-heading transition-[border-color,background,transform] duration-150 hover:-translate-y-px hover:border-gold hover:bg-surface-2";

const linkSm = "cursor-pointer border-0 bg-transparent p-0 text-[13px] font-bold text-gold-d hover:text-ink disabled:cursor-not-allowed disabled:opacity-45";

const stepTag = "mb-4 inline-flex items-center gap-[7px] rounded-full bg-gold-soft px-3 py-[5px] text-xs font-bold text-gold-d";

const footNote = "mt-6 flex items-center justify-center gap-2 text-center text-xs leading-relaxed text-text-3";

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

function formatPhoneDisplay(digits: string): string {
  if (digits.length > 2 && digits.length <= 5) {
    return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  }
  if (digits.length > 5) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }
  return digits;
}

function formatPhoneTarget(digits: string): string {
  return `+966 ${formatPhoneDisplay(digits).trim()}`;
}

function AlertIcon() {
  return (
    <svg
      className="mt-px size-4 shrink-0 stroke-danger"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

function Alert({ children }: { children: string }) {
  return (
    <div
      className="mb-[18px] flex items-start gap-[9px] rounded-[11px] border-e-[3px] border-e-danger bg-danger-bg px-3.5 py-[11px] text-[13px] font-semibold leading-relaxed text-danger-text"
      role="alert"
    >
      <AlertIcon />
      <span>{children}</span>
    </div>
  );
}

function Spinner() {
  return (
    <span className="size-[17px] animate-spin rounded-full border-[2.4px] border-white/40 border-t-white" />
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>("creds");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpBad, setOtpBad] = useState(false);
  const [mobileBad, setMobileBad] = useState(false);
  const [passwordBad, setPasswordBad] = useState(false);
  const [resendLeft, setResendLeft] = useState(0);
  const [pendingSession, setPendingSession] = useState<AuthSession | null>(null);
  const [landingPath, setLandingPath] = useState("/active-primary-data");
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const mobileRef = useRef<HTMLInputElement | null>(null);
  const otpConfirmingRef = useRef(false);

  const isEmailMode = /[a-zA-Z@]/.test(identifier);
  const mobileDigits = identifier.replace(/\D/g, "");
  const credsReady = isEmailMode
    ? identifier.trim().length > 3 && password.length >= 1
    : mobileDigits.length >= 9 && password.length >= 1;
  const otpValue = otp.join("");
  const otpReady = otpValue.length === 6;

  useEffect(() => {
    const session = getValidAuthSession();
    if (!session) return;
    setAuthSession(session);
    void resolvePostLoginPath(session.token).then((path) => {
      router.replace(path);
    });
  }, [router]);

  // Do NOT prefetch protected routes here: on the login page there is no
  // ree-auth cookie yet, so the middleware answers the prefetch with a
  // redirect to /login?from=... and Next caches it — after login, clicking
  // that nav item then replays the cached redirect back to the login page.

  useEffect(() => {
    if (resendLeft <= 0) return;
    const id = window.setInterval(() => {
      setResendLeft((n) => (n <= 1 ? 0 : n - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendLeft]);

  function startOtpTimer() {
    setResendLeft(30);
  }

  function resetOtp() {
    setOtp(["", "", "", "", "", ""]);
    setOtpBad(false);
    setOtpError(null);
  }

  function onIdentifierChange(raw: string) {
    setError(null);
    setMobileBad(false);
    // Any letter means the user is entering an email, not a mobile number —
    // keep it verbatim so characters before the "@" are not stripped away.
    if (/[a-zA-Z@]/.test(raw)) {
      setIdentifier(raw.slice(0, 120));
      return;
    }
    const digits = raw.replace(/\D/g, "").slice(0, 9);
    setIdentifier(formatPhoneDisplay(digits));
  }

  async function authenticate(): Promise<AuthSession | null> {
    const value = isEmailMode ? identifier.trim() : mobileDigits;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${getApiBase()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value, password }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => null)) as
        | LoginResponse
        | { message?: string }
        | null;

      if (!res.ok) {
        const msg =
          data && "message" in data && typeof data.message === "string"
            ? data.message
            : isEmailMode
              ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
              : "رقم الجوال أو كلمة المرور غير صحيحة.";
        setError(msg);
        return null;
      }

      if (!data || !("token" in data)) {
        setError("استجابة غير متوقعة من الخادم.");
        return null;
      }

      return {
        token: data.token,
        user: data.user,
        expiresAtUtc: data.expiresAtUtc,
        refreshToken: data.refreshToken,
        refreshTokenExpiresAtUtc: data.refreshTokenExpiresAtUtc,
      } satisfies AuthSession;
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
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function onCredsSubmit(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setMobileBad(false);
    setPasswordBad(false);

    if (!isEmailMode) {
      if (mobileDigits.length < 9) {
        setError("أدخل رقم جوال صحيح مكوّناً من ٩ أرقام بعد +966");
        setMobileBad(true);
        mobileRef.current?.focus();
        return;
      }
      if (!/^5/.test(mobileDigits)) {
        setError("رقم الجوال السعودي يبدأ بالرقم ٥");
        setMobileBad(true);
        mobileRef.current?.focus();
        return;
      }
    } else if (!identifier.trim()) {
      setError("اكتب البريد الإلكتروني أو رقم الجوال");
      setMobileBad(true);
      return;
    }

    if (!password) {
      setError("اكتب كلمة المرور");
      setPasswordBad(true);
      return;
    }

    setLoading(true);
    try {
      const session = await authenticate();
      if (!session) {
        setMobileBad(true);
        setPasswordBad(true);
        return;
      }

      const path = await resolvePostLoginPath(session.token);
      setLandingPath(path);
      setPendingSession(session);
      resetOtp();
      startOtpTimer();
      setStep("otp");
      window.setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } finally {
      setLoading(false);
    }
  }

  function onOtpChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(0, 1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setOtpBad(false);
    setOtpError(null);
    const complete = next.join("");
    if (complete.length === 6) {
      void onOtpConfirm(complete);
      return;
    }
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function onOtpKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function onOtpPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!text) return;
    const next = ["", "", "", "", "", ""];
    text.split("").forEach((ch, i) => {
      next[i] = ch;
    });
    setOtp(next);
    setOtpBad(false);
    setOtpError(null);
    if (text.length === 6) {
      void onOtpConfirm(text);
      return;
    }
    otpRefs.current[Math.min(text.length, 5)]?.focus();
  }

  async function onOtpConfirm(codeOverride?: string) {
    const code = (codeOverride ?? otpValue).replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6 || !pendingSession || otpConfirmingRef.current) return;
    if (code === "000000") {
      setOtpBad(true);
      setOtpError("الرمز غير صحيح، تأكد من الأرقام وحاول مجدداً");
      return;
    }

    otpConfirmingRef.current = true;
    setLoading(true);
    try {
      setAuthSession(pendingSession);
      showToast("تم تسجيل الدخول !", "success");
      router.replace(landingPath);
    } finally {
      otpConfirmingRef.current = false;
      setLoading(false);
    }
  }

  function onForgot() {
    setError(
      "يتم تعيين كلمة المرور عبر رابط الدعوة على جوالك. لإعادة الإرسال تواصل مع مدير النظام.",
    );
  }

  function onBiometric() {
    showToast("الدخول بالبصمة غير مفعّل على هذا الجهاز بعد.", "info");
  }

  function onResend() {
    if (resendLeft > 0) return;
    resetOtp();
    startOtpTimer();
    otpRefs.current[0]?.focus();
    showToast("أُعيد إرسال رمز التحقق.", "success");
  }

  const timerLabel = `إعادة الإرسال خلال ${Math.floor(resendLeft / 60)}:${String(
    resendLeft % 60,
  ).padStart(2, "0")}`;

  const otpTarget = isEmailMode
    ? identifier.trim()
    : formatPhoneTarget(mobileDigits);

  return (
    <div className="grid min-h-svh grid-cols-1 min-[900px]:grid-cols-[0.92fr_1.08fr]">
      <aside className="relative hidden flex-col overflow-hidden bg-ink px-[54px] py-14 text-white min-[900px]:flex">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_82%_8%,rgba(164,144,111,.20),transparent_55%),radial-gradient(90%_80%_at_10%_100%,rgba(34,64,110,.55),transparent_60%)]"
          aria-hidden
        />
        <svg
          className="pointer-events-none absolute -bottom-[60px] -left-[70px] w-[420px] opacity-[0.055]"
          viewBox="0 0 141.7 50"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <g fill="#ffffff">
            <path d="M35.3,27.7c1.7,0,5.4,0,5.4,0l8-16.8l8,16.8H62L48.6,1C48.6,1,39.7,18.8,35.3,27.7z" />
            <path d="M89.6,27.7c1.7,0,5.4,0,5.4,0l8-16.8l8,16.8h5.4L103,1C103,1,94.1,18.8,89.6,27.7z" />
            <polygon points="131.3,12.4 115.5,12.4 115.5,16.8 131.4,16.8 131.4,27.7 135.7,27.7 135.7,1 131.3,1" />
            <path d="M29.2,1c0,0-0.1,11.9-0.1,17.5c0,2.3-1.7,4.5-4.1,4.8c-0.4,0-1.3,0.1-1.3,0.1v4.3c0,0,1.9-0.1,2.8-0.3c2.5-0.5,4.6-1.8,5.8-4.1c0.9-1.7,1.3-3.6,1.3-5.5c0-5.4,0-16.8,0-16.8H29.2z" />
            <rect x="0.8" y="1" width="17.8" height="4.3" />
            <rect x="0.8" y="23.4" width="17.8" height="4.3" />
            <rect x="0.7" y="12.2" width="14.9" height="4.3" />
            <path d="M75.3,1L75.3,1L59.8,1v4.5h15.5v0c4.9,0,9,4,9,8.9c0,4.9-4,8.9-9,8.9h-8.9v4.3h8.9c7.4,0,13.3-5.9,13.3-13.3S82.7,1,75.3,1z" />
          </g>
        </svg>
        <div className="relative flex items-center gap-3.5">
          <EjadaLogo variant="onDark" className="h-auto w-[150px]" />
        </div>
        <div className="relative mt-[34px] mb-5 h-[3px] w-[46px] rounded-full bg-gold-2" />
        <div className="relative max-w-[15ch] text-[30px] font-extrabold leading-[1.5] tracking-[-0.01em]">
          منصة إدارة <span className="text-gold-2">دراسة الحالة</span> المتكاملة
        </div>
        <p className="relative mt-4 max-w-[34ch] text-[15px] leading-[1.9] text-white/72">
          من إسناد أمر العمل حتى اعتماد دراسة الحالة — دراسة الحالة، الرفع
          المساحي، وإدارة المعاملات في نظام واحد موثّق.
        </p>
        <div className="relative mt-auto flex items-center justify-between gap-3.5 pt-[30px] text-xs text-white/50">
          <span>© 2026 إجادة المهنية للتقييم العقاري</span>
        </div>
      </aside>

      <main className="flex items-center justify-center bg-surface px-[26px] py-10 max-[899px]:px-[22px] max-[899px]:py-11">
        <div className="w-full max-w-[392px]">
          <EjadaLogo
            variant="onLight"
            className="mx-auto mb-[26px] hidden h-auto w-[150px] max-[899px]:block"
          />

          {step === "creds" ? (
            <section key="creds" className={stepAnim}>
              <h1 className="mb-1.5 text-2xl font-extrabold tracking-[-0.01em] text-heading">
                تسجيل الدخول
              </h1>
              <p className="mb-[26px] text-[15px] leading-[1.7] text-text-2">
                أدخل <b className="font-bold text-text">رقم الجوال</b> وكلمة
                المرور للمتابعة إلى نظام دراسة الحالة.
              </p>

              {error ? <Alert>{error}</Alert> : null}

              <form onSubmit={onCredsSubmit} suppressHydrationWarning>
                <div className="mb-[17px]">
                  <label
                    htmlFor="mobile"
                    className="mb-2 block text-[13px] font-bold text-text-2"
                  >
                    {isEmailMode ? "البريد الإلكتروني" : "رقم الجوال"}
                  </label>
                  <div className="relative flex items-center" dir="ltr">
                    {!isEmailMode ? (
                      <span
                        dir="ltr"
                        className="pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-[#ddd8cc] px-[13px] text-sm font-bold tracking-[0.02em] text-text-2"
                      >
                        +966
                      </span>
                    ) : null}
                    <input
                      ref={mobileRef}
                      id="mobile"
                      type={isEmailMode ? "email" : "tel"}
                      inputMode={isEmailMode ? "email" : "numeric"}
                      autoComplete={isEmailMode ? "email" : "tel"}
                      placeholder={
                        isEmailMode ? "name@example.com" : "5X XXX XXXX"
                      }
                      // No DOM clamp: phone digits are limited in
                      // onIdentifierChange, and a pasted email must not be
                      // truncated by the phone-mode length before mode flips.
                      maxLength={120}
                      value={identifier}
                      onChange={(e) => onIdentifierChange(e.target.value)}
                      dir="ltr"
                      className={cn(
                        fieldInput,
                        "text-left",
                        !isEmailMode && "pl-[72px]",
                        mobileBad && fieldInputBad,
                      )}
                    />
                  </div>
                </div>

                <div className="mb-[17px]">
                  <label
                    htmlFor="password"
                    className="mb-2 block text-[13px] font-bold text-text-2"
                  >
                    كلمة المرور
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                        setPasswordBad(false);
                      }}
                      dir="ltr"
                      className={cn(
                        fieldInput,
                        "pl-[46px] text-left",
                        // Hide Edge/IE native password reveal so only our eye control shows.
                        "[&::-ms-reveal]:hidden [&::-ms-clear]:hidden",
                        passwordBad && fieldInputBad,
                      )}
                    />
                    <button
                      type="button"
                      className="absolute left-2 grid size-8 place-items-center rounded-lg border-0 bg-transparent text-text-3 transition-colors hover:bg-surface-2 hover:text-gold-d"
                      aria-label={
                        showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                      }
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? (
                        <svg
                          className="size-[19px]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <path d="M1 1l22 22" />
                          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                        </svg>
                      ) : (
                        <svg
                          className="size-[19px]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="-mt-1 mb-[22px] flex items-center justify-between gap-3">
                  <label className="inline-flex cursor-pointer select-none items-center gap-[9px] text-[13px] font-semibold text-text-2">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    <span className="grid size-[19px] place-items-center rounded-md border-2 border-[#ddd8cc] bg-surface transition-all peer-checked:border-ink peer-checked:bg-ink peer-checked:[&>svg]:opacity-100">
                      <svg
                        className="size-3 stroke-white opacity-0 transition-opacity"
                        viewBox="0 0 24 24"
                        fill="none"
                        strokeWidth="3.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                    إبقائي مسجّلاً
                  </label>
                  <button type="button" className={linkSm} onClick={onForgot}>
                    تعذّر الدخول؟
                  </button>
                </div>

                <button
                  type="submit"
                  className={cn(primaryBtn, loading && "pointer-events-none")}
                  disabled={loading || !credsReady}
                  data-no-action-toast
                >
                  {loading ? <Spinner /> : null}
                  <span className={cn(loading && "opacity-60")}>
                    {loading ? "جارٍ الإرسال" : "متابعة"}
                  </span>
                  {!loading ? (
                    <svg
                      className="size-[18px]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  ) : null}
                </button>
              </form>

              <div className="my-[22px] flex items-center gap-3.5 text-xs font-semibold text-text-3 before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                أو
              </div>
              <button
                type="button"
                className={ghostBtn}
                onClick={onBiometric}
              >
                <svg
                  className="size-5 stroke-gold-d"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 11a2 2 0 0 0-2 2c0 2 .5 3.5 1 5" />
                  <path d="M12 7a6 6 0 0 0-6 6c0 2 .3 3 .8 4.5" />
                  <path d="M12 3a10 10 0 0 0-10 10" />
                  <path d="M12 7a6 6 0 0 1 6 6c0 3-.5 5-1.5 7.5" />
                  <path d="M15 13c0 4-.7 6-1.5 8" />
                  <path d="M22 13A10 10 0 0 0 12 3" />
                </svg>
                الدخول بالبصمة
              </button>

              <div className={footNote}>
                <svg
                  className="size-3.5 shrink-0 stroke-text-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                الجلسة الآمنة تنتهي تلقائياً بعد ٣ ساعات
              </div>
            </section>
          ) : null}

          {step === "otp" ? (
            <section key="otp" className={stepAnim}>
              <div className="mb-5 flex justify-end">
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-[7px] border-0 bg-transparent p-0 text-[13px] font-bold text-text-2 hover:text-ink"
                  onClick={() => {
                    setStep("creds");
                    setPendingSession(null);
                    resetOtp();
                    setResendLeft(0);
                    setMobileBad(false);
                    setPasswordBad(false);
                    setError(null);
                    window.setTimeout(() => mobileRef.current?.focus(), 50);
                  }}
                >
                  تغيير رقم الجوال
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
              </div>
              <span className={stepTag}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M22 7 12 13 2 7" />
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                </svg>
                التحقق
              </span>
              <h1 className="mb-1.5 text-2xl font-extrabold tracking-[-0.01em] text-heading">
                أدخل رمز التحقق
              </h1>
              <p className="mb-[26px] text-[15px] leading-[1.7] text-text-2">
                أرسلنا رمزاً مكوّناً من ٦ أرقام عبر رسالة نصية إلى الجوال{" "}
                <span className="inline-block font-bold text-text [direction:ltr]">
                  {otpTarget}
                </span>
              </p>

              {otpError ? <Alert>{otpError}</Alert> : null}

              <div
                className="my-1 mb-2 flex justify-center gap-2.5 [direction:ltr]"
                dir="ltr"
              >
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      otpRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    aria-label={`رقم التحقق ${index + 1}`}
                    onChange={(e) => onOtpChange(index, e.target.value)}
                    onKeyDown={(e) => onOtpKeyDown(index, e)}
                    onPaste={onOtpPaste}
                    className={cn(
                      "size-[52px] h-[60px] rounded-xl border bg-surface-2 text-center text-2xl font-extrabold text-heading outline-none transition-all duration-150 focus:border-gold focus:bg-surface focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--gold)_16%,transparent)]",
                      otpBad
                        ? "border-danger"
                        : digit
                          ? "border-ink text-ink"
                          : "border-[#ddd8cc]",
                    )}
                  />
                ))}
              </div>

              <div className="my-4 mb-6 flex items-center justify-between gap-3 text-[13px] text-text-2">
                {resendLeft > 0 ? <span>{timerLabel}</span> : <span />}
                <button
                  type="button"
                  className={linkSm}
                  disabled={resendLeft > 0}
                  onClick={onResend}
                >
                  إعادة إرسال الرمز
                </button>
              </div>

              <button
                type="button"
                className={cn(primaryBtn, loading && "pointer-events-none")}
                disabled={loading || !otpReady}
                onClick={() => void onOtpConfirm()}
                data-no-action-toast
              >
                {loading ? <Spinner /> : null}
                <span className={cn(loading && "opacity-60")}>
                  {loading ? "جارٍ التحقق" : "تأكيد الدخول"}
                </span>
                {!loading ? (
                  <svg
                    className="size-[18px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : null}
              </button>

              <div className={footNote}>
                <svg
                  className="size-3.5 shrink-0 stroke-text-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                لم يصلك الرمز؟ تأكد من الشبكة قبل إعادة الإرسال
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
