import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import { Spinner } from "./Spinner";

const variantClasses = {
  default:
    "border-border-md bg-surface text-text hover:bg-surface-2",
  primary:
    "border-primary bg-primary text-white hover:border-primary-mid hover:bg-primary-mid",
  outline:
    "border-primary bg-transparent text-primary hover:bg-teal-light",
  accent:
    "border-primary bg-primary text-white hover:border-primary-mid hover:bg-primary-mid",
  danger:
    "border-red/30 bg-danger-bg text-danger-text hover:bg-[#f9dcdc]",
  success:
    "border-primary bg-primary text-white hover:border-primary-mid hover:bg-primary-mid",
  dangerOutline:
    "border-red/30 bg-transparent text-danger-text hover:bg-danger-bg",
  ghost:
    "border-transparent bg-transparent text-text-2 hover:bg-surface-2",
} as const;

const sizeClasses = {
  default: "px-3.5 py-1.5 text-[12.5px]",
  sm: "px-[9px] py-1 text-[11px]",
  lg: "px-4 py-2.5 text-sm",
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
        "inline-flex items-center justify-center gap-[5px] rounded-[var(--radius-DEFAULT)] border-[0.5px] border-solid font-normal whitespace-nowrap outline-none transition-[background,border-color,opacity] duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-65",
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
