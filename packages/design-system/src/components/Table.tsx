import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Table({
  className,
  pending,
  wrapClassName,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & {
  pending?: boolean;
  /** Classes for the outer scroll/clip wrapper around the `<table>`. */
  wrapClassName?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch]",
        wrapClassName,
      )}
    >
      <table
        data-pending={pending ? "true" : undefined}
        className={cn(
          "w-full border-collapse font-sans",
          pending && "[&_tbody]:opacity-55 [&_tbody]:transition-opacity [&_tbody]:duration-200",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function Tr({
  className,
  hoverable = true,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { hoverable?: boolean }) {
  return (
    <tr
      className={cn(
        hoverable && "[&_td]:transition-colors [&_td]:duration-200 [&:hover_td]:bg-row-hover [&:hover_td]:cursor-pointer",
        "[&:last-child_td]:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b-2 border-gold bg-surface-2 px-4 py-2.5 text-start text-[12px] font-bold text-heading whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "border-b border-border px-4 py-3.5 text-start text-[13px] text-text align-middle",
        className,
      )}
      {...props}
    />
  );
}

/** Compact ⋮ / actions column — same horizontal padding as data cells. */
export function ThAction({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "w-12 border-b-2 border-gold bg-surface-2 px-4 py-2.5 text-center text-[12px] font-bold text-heading whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

export function TdAction({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "w-12 border-b border-border px-4 py-2.5 text-center align-middle",
        className,
      )}
      {...props}
    />
  );
}