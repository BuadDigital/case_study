"use client";

import { cn } from "@platform/ui-kit";

/**
 * بلاغ «معادة للتصحيح» الموحّد — عنوان بارز وسبب الإعادة في سطر مستقل،
 * بشريط بداية ذهبي وأيقونة الإعادة نفسها المستخدمة في بطاقات الوضع.
 */
export function ReturnedForCorrectionNote({
  note,
  className,
}: {
  note?: string | null;
  className?: string;
}) {
  const reason = note?.trim();
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-[10px] border border-[color-mix(in_srgb,var(--gold)_38%,transparent)] border-s-[3px] border-s-gold-d bg-[color-mix(in_srgb,var(--gold)_10%,var(--surface))] px-3.5 py-3",
        className,
      )}
    >
      <span
        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[9px] bg-gold-soft text-gold-d"
        aria-hidden
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12a9 9 0 1 0 9-9" />
          <path d="M3 3v6h6" />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="m-0 text-[13px] font-bold leading-snug text-heading">
          معادة للتصحيح
        </p>
        {reason ? (
          <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-text-2">
            <span className="font-semibold text-text-1">سبب الإعادة:</span>{" "}
            {reason}
          </p>
        ) : null}
      </div>
    </div>
  );
}
