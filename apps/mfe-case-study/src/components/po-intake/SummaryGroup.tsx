import type { ReactNode } from "react";

/** A group of a read-only summary: its gold bar and title, then its fields, as the work page's groups read. */
export function SummaryGroup({
  title,
  testId,
  children,
}: {
  title: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-4" data-testid={testId}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="h-[17px] w-[3px] rounded-full bg-gold" aria-hidden />
        <h3 className="m-0 text-[14px] font-extrabold text-heading">{title}</h3>
        <span className="flex-1 border-t border-border" aria-hidden />
      </div>
      {children}
    </div>
  );
}
