import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import { Spinner } from "./Spinner";

const variantClasses = {
  default:
    "border border-border-md bg-surface font-semibold text-text-2 enabled:hover:bg-row-hover",
  primary:
    "border-none bg-ink font-bold text-white enabled:hover:bg-navy-3",
  outline:
    "border border-primary bg-transparent font-semibold text-primary enabled:hover:bg-gold-soft",
  accent:
    "border-none bg-gold-d font-bold text-white shadow-[0_6px_16px_-6px_color-mix(in_srgb,var(--gold-d)_60%,transparent)] enabled:hover:bg-gold",
  danger:
    "border border-red/30 bg-danger-bg font-semibold text-danger-text enabled:hover:bg-[#f7ddd4]",
  success:
    "border-none bg-ink font-bold text-white enabled:hover:bg-navy-3",
  dangerOutline:
    "border border-red/30 bg-transparent font-semibold text-danger-text enabled:hover:bg-danger-bg",
  ghost:
    "border border-transparent bg-transparent font-semibold text-text-2 enabled:hover:bg-row-hover",
} as const;

const sizeClasses = {
  default: "min-h-11 gap-1.5 px-[18px] py-2.5 text-[13px]",
  sm: "min-h-9 gap-1.5 px-3.5 py-1.5 text-[12.5px]",
  lg: "min-h-12 gap-2 px-[18px] py-2.5 text-[13px]",
} as const;

export type ButtonVariant = keyof typeof variantClasses;
export type ButtonSize = keyof typeof sizeClasses;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Explicit label for the global progress toast. */
  actionLabel?: string;
  /** Set on the element to skip the global progress toast. */
  showActionToast?: boolean;
};

export function Button({
  className,
  variant = "default",
  size = "default",
  type = "button",
  loading = false,
  disabled,
  children,
  actionLabel,
  showActionToast = true,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-button-variant={variant}
      data-action-label={actionLabel}
      data-no-action-toast={showActionToast ? undefined : true}
      className={cn(
        "inline-flex items-center justify-center rounded-[9px] font-[inherit] whitespace-nowrap outline-none transition-colors duration-[130ms] cursor-pointer enabled:active:brightness-95 disabled:cursor-not-allowed disabled:opacity-55",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}
