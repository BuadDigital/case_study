import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function TabBar({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 gap-0 overflow-x-auto overscroll-x-contain border-b border-border/50 bg-surface px-4 sm:px-6 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:h-0",
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
      data-no-action-toast
      className={cn(
        "mb-[-1px] flex items-center gap-1.5 border-b-2 border-transparent bg-transparent px-3.5 py-2.5 text-xs text-text-2 whitespace-nowrap outline-none transition-colors cursor-pointer font-[inherit]",
        "max-lg:min-h-11 max-lg:px-3 max-lg:text-[12.5px]",
        "hover:text-text",
        active && "border-b-primary font-medium text-primary",
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
        "min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5",
        className,
      )}
      {...props}
    />
  );
}
