"use client";

import {
  FormEvent,
  KeyboardEvent,
  ClipboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import {
  getApiBase,
  repositoryFetch as fetch,
} from "@platform/api-client";
import {
  setAuthSession,
  type AuthSession,
} from "@platform/auth-client";
import { ensureFreshAuthSession } from "@platform/app-shared/auth/ensure-fresh-session";
import { cn, useToast } from "@platform/ui-kit";
import { BrandLogo } from "@/components/views/BrandLogo";
import {
  Alert,
  NON_DIGIT_RE,
  Spinner,
  asideWatermarkSvg,
  fieldInput,
  fieldInputBad,
  footNote,
  formatPhoneDisplay,
  formatPhoneTarget,
  ghostBtn,
  linkSm,
  primaryBtn,
  resolvePostLoginPath,
  safeReturnPath,
  stepAnim,
  stepTag,
} from "./login-ui";

type LoginResponse = {
  token: string;
  expiresAtUtc: string;
  refreshToken?: string;
  refreshTokenExpiresAtUtc?: string;
  user: { id: string; displayName: string; jobTitle?: string };
};

type Step = "creds" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();
  /** Avoid painting the login form while we still may resume an existing session. */
  const [boot, setBoot] = useState<"checking" | "ready">("checking");
  const [step, setStep] = useState<Step>("creds");
  const [identifier, setIdentifier] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpBad, setOtpBad] = useState(false);
  const [mobileBad, setMobileBad] = useState(false);
  const [resendLeft, setResendLeft] = useState(0);
  const [landingPath, setLandingPath] = useState("/active-primary-data");
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const mobileRef = useRef<HTMLInputElement | null>(null);
  const otpConfirmingRef = useRef(false);
  const mobileDigits = identifier.replace(NON_DIGIT_RE, "");
  const credsReady = mobileDigits.length >= 9;
  const otpValue = otp.join("");

  useEffect(() => {
    let cancelled = false;
    const failSafe = window.setTimeout(() => {
      if (!cancelled) setBoot("ready");
    }, 4_000);
    void (async () => {
      try {
        const session = await ensureFreshAuthSession();
        if (cancelled) return;
        if (!session) {
          setBoot("ready");
          return;
        }
        setAuthSession(session);
        const from = safeReturnPath(
          new URLSearchParams(window.location.search).get("from"),
        );
        const path = from ?? (await resolvePostLoginPath(session.token));
        if (cancelled) return;
        router.replace(path);
        // Keep the spinner only briefly; if navigation stalls, show the form.
        setBoot("ready");
      } catch {
        if (!cancelled) setBoot("ready");
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(failSafe);
    };
  }, [router]);

  // Do NOT prefetch protected routes here: on the login page there is no
  // ree-auth cookie yet, so the middleware answers the prefetch with a
  // redirect to /login?from=... and Next caches it — after login, clicking
  // that nav item then replays the cached redirect back to the login page.

  // One interval for the whole countdown — depending on resendLeft itself
  // would tear down and recreate the timer every second.
  const otpTimerActive = resendLeft > 0;
  useEffect(() => {
    if (!otpTimerActive) return;
    const id = window.setInterval(() => {
      setResendLeft((n) => (n <= 1 ? 0 : n - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [otpTimerActive]);

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
    const digits = raw.replace(NON_DIGIT_RE, "").slice(0, 9);
    setIdentifier(formatPhoneDisplay(digits));
  }

  async function authenticate(): Promise<AuthSession | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${getApiBase()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: mobileDigits }),
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
            : "تعذّر تسجيل الدخول. تأكد من رقم الجوال.";
        setOtpError(msg);
        return null;
      }

      if (!data || !("token" in data)) {
        setOtpError("استجابة غير متوقعة من الخادم.");
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
      setOtpError(
        timedOut
          ? "انتهت مهلة الاتصال. تأكد أن الخادم يعمل (npm run dev:api) وانتظر حتى يظهر login-ready."
          : typeof window !== "undefined" && !/localhost|127\.0\.0\.1/.test(window.location.hostname)
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

    resetOtp();
    startOtpTimer();
    setStep("otp");
    window.setTimeout(() => otpRefs.current[0]?.focus(), 50);
  }

  function onOtpChange(index: number, raw: string) {
    const digit = raw.replace(NON_DIGIT_RE, "").slice(0, 1);
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
      .replace(NON_DIGIT_RE, "")
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
    const code = (codeOverride ?? otpValue).replace(NON_DIGIT_RE, "").slice(0, 6);
    if (code.length !== 6 || otpConfirmingRef.current) return;
    if (code === "000000") {
      setOtpBad(true);
      setOtpError("الرمز غير صحيح، تأكد من الأرقام وحاول مجدداً");
      return;
    }

    otpConfirmingRef.current = true;
    flushSync(() => setLoading(true));
    try {
      const session = await authenticate();
      if (!session) {
        setOtpBad(true);
        otpConfirmingRef.current = false;
        setLoading(false);
        return;
      }

      const from = safeReturnPath(
        new URLSearchParams(window.location.search).get("from"),
      );
      const path = from ?? (await resolvePostLoginPath(session.token));
      setLandingPath(path);
      setAuthSession(session);
      showToast("تم تسجيل الدخول !", "success");
      router.replace(path);
    } catch {
      otpConfirmingRef.current = false;
      setLoading(false);
    }
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

  const otpTarget = formatPhoneTarget(mobileDigits);

  if (boot === "checking") {
    return (
      <div
        className="flex min-h-svh items-center justify-center bg-surface"
        aria-busy="true"
        aria-label="جاري التحقق من الجلسة"
      >
        <span className="size-8 animate-spin rounded-full border-[3px] border-[#ddd8cc] border-t-ink" />
      </div>
    );
  }

  return (
    <div className="grid min-h-svh grid-cols-1 min-[900px]:grid-cols-[0.92fr_1.08fr]">
      <aside className="relative hidden flex-col overflow-hidden bg-ink px-[54px] py-14 text-white min-[900px]:flex">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_82%_8%,rgba(164,144,111,.20),transparent_55%),radial-gradient(90%_80%_at_10%_100%,rgba(34,64,110,.55),transparent_60%)]"
          aria-hidden
        />
        {asideWatermarkSvg}
        <div className="relative flex items-center gap-3.5">
          <BrandLogo variant="onDark" className="h-auto w-[150px]" />
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
          <BrandLogo
            variant="onLight"
            className="mx-auto mb-[26px] hidden h-auto w-[150px] max-[899px]:block"
          />

          {step === "creds" ? (
            <section key="creds" className={stepAnim}>
              <h1 className="mb-1.5 text-2xl font-extrabold tracking-[-0.01em] text-heading">
                تسجيل الدخول
              </h1>
              <p className="mb-[26px] text-[15px] leading-[1.7] text-text-2">
                أدخل <b className="font-bold text-text">رقم الجوال</b> لإرسال رمز
                التحقق والمتابعة إلى نظام دراسة الحالة.
              </p>

              {error ? <Alert>{error}</Alert> : null}

              <form onSubmit={onCredsSubmit} suppressHydrationWarning>
                <div className="mb-[17px]">
                  <label
                    htmlFor="mobile"
                    className="mb-2 block text-[13px] font-bold text-text-2"
                  >
                    رقم الجوال
                  </label>
                  <div className="relative flex items-center" dir="ltr">
                    <span
                      dir="ltr"
                      className="pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-[#ddd8cc] px-[13px] text-sm font-bold tracking-[0.02em] text-text-2"
                    >
                      +966
                    </span>
                    <input
                      ref={mobileRef}
                      id="mobile"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="5X XXX XXXX"
                      maxLength={11}
                      value={identifier}
                      onChange={(e) => onIdentifierChange(e.target.value)}
                      dir="ltr"
                      className={cn(
                        fieldInput,
                        "pl-[72px] text-left",
                        mobileBad && fieldInputBad,
                      )}
                    />
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
                  disabled={loading}
                  onClick={() => {
                    setStep("creds");
                    resetOtp();
                    setResendLeft(0);
                    setMobileBad(false);
                    setError(null);
                    setOtpError(null);
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
                أرسلنا رمزاً مكوّناً من ٦ أرقام عبر رسالة نصية إلى{" "}
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
                    disabled={loading}
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
                  disabled={loading || resendLeft > 0}
                  onClick={onResend}
                >
                  إعادة إرسال الرمز
                </button>
              </div>

              <button
                type="button"
                className={cn(primaryBtn, loading && "pointer-events-none")}
                disabled={loading}
                aria-busy={loading || undefined}
                onClick={() => {
                  if (otpValue.replace(NON_DIGIT_RE, "").length !== 6) {
                    setOtpBad(true);
                    setOtpError("أدخل رمز التحقق كاملاً (٦ أرقام) ثم أكّد الدخول");
                    const empty = otp.findIndex((d) => !d);
                    otpRefs.current[empty === -1 ? 0 : empty]?.focus();
                    return;
                  }
                  void onOtpConfirm();
                }}
                data-no-action-toast
              >
                {loading ? <Spinner /> : null}
                <span>تأكيد الدخول</span>
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
