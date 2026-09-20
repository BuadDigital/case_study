import { fetchPermissions } from "@platform/api-client";
import { defaultLandingPath } from "@platform/app-shared/app-data/page-access";
import { pagesFromPermissions } from "@platform/app-shared/app-data/permissions-pages";

export const fieldInput =
  "w-full rounded-[11px] border border-[#ddd8cc] bg-surface-2 px-[15px] py-[13px] text-[15px] text-text outline-none transition-[border-color,box-shadow,background] duration-150 placeholder:tracking-[0.02em] placeholder:text-text-3 focus:border-gold focus:bg-surface focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--gold)_16%,transparent)]";
export const fieldInputBad =
  "border-danger shadow-[0_0_0_4px_color-mix(in_srgb,var(--red)_12%,transparent)] focus:border-danger focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--red)_12%,transparent)]";
export const stepAnim = "animate-[login-rise_0.35s_ease]";
export const primaryBtn =
  "flex w-full cursor-pointer items-center justify-center gap-[9px] rounded-[11px] border-0 bg-ink py-3.5 text-[15.5px] font-bold text-white shadow-[0_12px_26px_-14px_rgba(16,43,78,.7)] transition-[background,transform,box-shadow] duration-150 hover:enabled:-translate-y-px hover:enabled:bg-navy-3 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0";
export const ghostBtn =
  "flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-[11px] border border-[#ddd8cc] bg-surface py-[13px] text-[14.5px] font-bold text-heading transition-[border-color,background,transform] duration-150 hover:-translate-y-px hover:border-gold hover:bg-surface-2";
export const linkSm =
  "cursor-pointer border-0 bg-transparent p-0 text-[13px] font-bold text-gold-d hover:text-ink disabled:cursor-not-allowed disabled:opacity-45";
export const stepTag =
  "mb-4 inline-flex items-center gap-[7px] rounded-full bg-gold-soft px-3 py-[5px] text-xs font-bold text-gold-d";
export const footNote =
  "mt-6 flex items-center justify-center gap-2 text-center text-xs leading-relaxed text-text-3";
export const NON_DIGIT_RE = /\D/g;

export const asideWatermarkSvg = (
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
);

export async function resolvePostLoginPath(token: string): Promise<string> {
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

/** Same-origin relative path only — blocks open redirects via ?from=. */
export function safeReturnPath(from: string | null | undefined): string | null {
  if (!from || !from.startsWith("/") || from.startsWith("//")) return null;
  if (from === "/login" || from.startsWith("/login?")) return null;
  // `/` always bounced to login historically — treating it as a return path
  // loops login ↔ / forever on the session-check spinner.
  if (from === "/") return null;
  return from;
}

export function formatPhoneDisplay(digits: string): string {
  if (digits.length > 2 && digits.length <= 5) {
    return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  }
  if (digits.length > 5) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }
  return digits;
}

export function formatPhoneTarget(digits: string): string {
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

export function Alert({ children }: { children: string }) {
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

export function Spinner() {
  return (
    <span className="size-[17px] animate-spin rounded-full border-[2.4px] border-white/40 border-t-white" />
  );
}
