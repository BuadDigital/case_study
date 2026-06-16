import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function TabBar({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 gap-0 overflow-x-auto border-b border-border/50 bg-surface px-6 [&::-webkit-scrollbar]:h-0",
        className,
      )}
      role="tablist"
      {...props}
    />
  );
}

export type TabProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export function Tab({ className, active, type = "button", ...props }: TabProps) {
  return (
    <button
      type={type}
      role="tab"
      aria-selected={active}
      className={cn(
        "mb-[-1px] flex items-center gap-1.5 border-b-2 border-transparent bg-transparent px-3.5 py-2.5 text-xs text-text-2 whitespace-nowrap outline-none transition-colors cursor-pointer font-[inherit]",
        "hover:text-text",
        active && "border-b-primary font-medium text-primary",
        className,
      )}
      {...props}
    />
  );
}

export function TabCount({
  className,
  tone = "gray",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "teal" | "red" | "gray";
}) {
  const toneClasses = {
    teal: "bg-teal-light text-teal-text",
    red: "bg-danger-bg text-danger-text",
    gray: "bg-surface-2 text-text-2",
  } as const;

  return (
    <span
      className={cn(
        "rounded-[10px] px-1.5 py-px text-[10px] font-medium",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}

export function TabPanel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tabpanel"
      className={cn(
        "min-w-0 flex-1 overflow-y-auto px-6 py-5",
        className,
      )}
      {...props}
    />
  );
}
