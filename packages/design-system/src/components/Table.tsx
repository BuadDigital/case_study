import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Table({
  className,
  pending,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & { pending?: boolean }) {
  return (
    <div className="min-w-0 overflow-x-auto [-webkit-overflow-scrolling:touch]">
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
        hoverable && "[&_td]:transition-colors [&_td]:duration-200 [&:hover_td]:bg-surface-2 [&:hover_td]:cursor-pointer",
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
        "border-b border-border bg-surface-2 px-4 py-2 text-start text-[11px] font-medium text-text-2 whitespace-nowrap",
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
        "border-b border-border px-4 py-2.5 text-start text-[11.5px] text-text align-middle",
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
        "w-12 border-b border-border bg-surface-2 px-4 py-2 text-center text-[11px] font-medium text-text-2 whitespace-nowrap",
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