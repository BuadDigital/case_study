import type {
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import {
  cx,
  tableClassName,
  tableFrameClassName,
  tableWrapClassName,
  tdActionClassName,
  tdClassName,
  tdLtrValueClassName,
  thActionClassName,
  thClassName,
  trHoverClassName,
} from "../lib/table-classes";

export {
  cx as tableCx,
  tableClassName,
  tableFrameClassName,
  tableWrapClassName,
  tdActionClassName,
  tdClassName,
  tdLtrValueClassName,
  thActionClassName,
  thClassName,
  trHoverClassName,
} from "../lib/table-classes";

export function TableFrame({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx(tableFrameClassName, className)} {...props} />;
}

export function Table({
  className,
  pending,
  wrapClassName,
  framed = false,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & {
  pending?: boolean;
  /** Classes for the outer scroll/clip wrapper around the `<table>`. */
  wrapClassName?: string;
  /** Wrap in the shared letter-card chrome (rounded border). */
  framed?: boolean;
}) {
  const scroll = (
    <div className={cx(tableWrapClassName, wrapClassName)}>
      <table
        data-pending={pending ? "true" : undefined}
        className={cx(
          tableClassName,
          pending &&
            "[&_tbody]:opacity-55 [&_tbody]:transition-opacity [&_tbody]:duration-200",
          className,
        )}
        {...props}
      />
    </div>
  );
  if (!framed) return scroll;
  return <TableFrame>{scroll}</TableFrame>;
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
      className={cx(
        hoverable && trHoverClassName,
        "[&:last-child_td]:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

export function Th({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cx(thClassName, className)} {...props} />;
}

export function Td({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx(tdClassName, className)} {...props} />;
}

/**
 * Cell for LTR codes (PO, dates, SAR). Keeps RTL column alignment; isolates bidi.
 * Children are wrapped unless `bare` — then only the td gets defaults.
 */
export function TdLtr({
  className,
  valueClassName,
  bare = false,
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & {
  valueClassName?: string;
  bare?: boolean;
}) {
  return (
    <td className={cx(tdClassName, className)} {...props}>
      {bare ? (
        children
      ) : (
        <span dir="ltr" className={cx(tdLtrValueClassName, valueClassName)}>
          {children}
        </span>
      )}
    </td>
  );
}

/** Compact ⋮ / actions column — same horizontal padding as data cells. */
export function ThAction({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cx(thActionClassName, className)} {...props} />;
}

export function TdAction({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx(tdActionClassName, className)} {...props} />;
}

/** Convenience empty state row spanning all columns. */
export function TableEmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <Tr hoverable={false}>
      <Td
        colSpan={colSpan}
        className="!py-10 text-center text-[13px] text-text-3"
      >
        {children}
      </Td>
    </Tr>
  );
}
