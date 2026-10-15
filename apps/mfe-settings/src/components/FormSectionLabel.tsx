import type { ReactNode } from "react";

/** Section divider inside the two-column user forms (add / edit share one look). */
export function FormSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="col-span-full sm:col-span-2">
      <p className="m-0 flex items-center gap-2 border-b border-border pb-1.5 text-[11.5px] font-bold text-heading">
        <span className="size-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
        {children}
      </p>
    </div>
  );
}
