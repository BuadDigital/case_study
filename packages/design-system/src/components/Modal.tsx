import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export function ModalOverlay({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(10,33,56,0.45)] p-5 ui-animate-modal-overlay",
        className,
      )}
      {...props}
    />
  );
}

export function ModalCard({
  className,
  wide,
  ...props
}: HTMLAttributes<HTMLDivElement> & { wide?: boolean }) {
  return (
    <div
      className={cn(
        "max-h-[90vh] w-full overflow-y-auto rounded-[var(--radius-lg)] border border-border bg-surface shadow-modal",
        wide ? "max-w-[640px]" : "max-w-[420px]",
        className,
      )}
      {...props}
    />
  );
}

export function ModalHeader({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <header
      className={cn(
        "flex items-center gap-2.5 border-b border-border px-4 py-3.5",
        className,
      )}
      {...props}
    />
  );
}

export function ModalTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "m-0 flex-1 text-center text-[15px] font-semibold text-text",
        className,
      )}
      {...props}
    />
  );
}

export function ModalClose({
  className,
  ...props
}: HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "shrink-0 cursor-pointer rounded-[var(--radius-sm)] border-none bg-transparent px-2 py-1 text-[22px] leading-none text-text-3 hover:bg-surface-2 hover:text-text",
        className,
      )}
      {...props}
    />
  );
}

export function ModalBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function ModalFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <footer
      className={cn(
        "flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3",
        className,
      )}
      {...props}
    >
      {children}
    </footer>
  );
}

export type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  wide?: boolean;
};
