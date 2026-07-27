"use client";

import Link from "next/link";

/**
 * Property-detail «تقييم العقار» tab — Case Study.html valuation panel.
 */
export function PropertyDetailAppraisalTab({
  workspaceHref,
}: {
  workspaceHref?: string;
}) {
  return (
    <>
      <div className="mb-3 rounded-xl border border-dashed border-border-md bg-surface px-[26px] py-[26px] text-center text-[13px] leading-relaxed text-text-3">
        بيانات التقييم تُدخل من نافذة المقيم — مصدر السعر المقيم وحده، ويُعرض
        للأخصائي للاسترشاد.
      </div>
      {workspaceHref ? (
        <Link
          href={workspaceHref}
          className="mb-4 inline-flex min-h-9 items-center justify-center rounded-lg bg-ink px-[18px] py-2 text-[12.5px] font-bold text-white no-underline shadow-[0_6px_16px_-8px_rgba(18,40,76,0.6)] transition-[transform,background] hover:bg-navy-3 hover:-translate-y-px max-lg:min-h-11 max-lg:w-full"
        >
          رفع تقييم — فتح نافذة المقيم
        </Link>
      ) : null}
    </>
  );
}
