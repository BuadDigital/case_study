"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "ejada_pwa_install_dismissed";
const IOS_DISMISS_KEY = "ejada_pwa_ios_tip_dismissed";

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const chromeIos = /CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit && !chromeIos;
}

/**
 * Android/desktop Chrome: beforeinstallprompt.
 * iOS Safari: tip for Share → Add to Home Screen (no install API).
 */
export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [visible, setVisible] = useState(false);
  const [iosTip, setIosTip] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandaloneDisplay()) return;

    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    if (isIosSafari()) {
      try {
        if (localStorage.getItem(IOS_DISMISS_KEY) === "1") return;
      } catch {
        /* ignore */
      }
      setIosTip(true);
      setVisible(true);
      return;
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!visible) return null;
  if (!iosTip && !deferred) return null;

  return (
    <div
      role="dialog"
      aria-label="تثبيت التطبيق"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[1200] mx-auto flex max-w-md flex-col gap-3 rounded-[14px] border border-border bg-surface p-3.5 shadow-[0_12px_40px_-12px_rgba(16,43,78,0.45)] sm:inset-x-auto sm:end-4 sm:start-auto"
    >
      <div className="min-w-0">
        <div className="text-[13.5px] font-extrabold text-heading">
          ثبّت إجادة على الجهاز
        </div>
        <p className="m-0 mt-1 text-[12px] leading-relaxed text-text-2">
          {iosTip
            ? "من Safari: مشاركة ← إضافة إلى الشاشة الرئيسية — للوصول السريع ميدانياً."
            : "للوصول السريع من الشاشة الرئيسية — مناسب للمراجع الحكومي في الميدان."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {!iosTip && deferred ? (
          <button
            type="button"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[9px] border-none bg-ink px-4 text-[13px] font-bold text-white"
            onClick={async () => {
              await deferred.prompt();
              try {
                await deferred.userChoice;
              } catch {
                /* ignore */
              }
              setVisible(false);
              setDeferred(null);
            }}
          >
            تثبيت
          </button>
        ) : null}
        <button
          type="button"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[9px] border border-border-md bg-surface px-4 text-[13px] font-semibold text-text-2"
          onClick={() => {
            try {
              localStorage.setItem(
                iosTip ? IOS_DISMISS_KEY : DISMISS_KEY,
                "1",
              );
            } catch {
              /* ignore */
            }
            setVisible(false);
          }}
        >
          {iosTip ? "حسناً" : "لاحقاً"}
        </button>
      </div>
    </div>
  );
}
