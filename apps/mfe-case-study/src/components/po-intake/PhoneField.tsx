import type { ReactNode } from "react";

/** Phone field: label above a full-width control. */
export function PhoneField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium text-text-3">{label}</span>
      {children}
    </div>
  );
}
