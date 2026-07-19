import Link from "next/link";
import { cn } from "@platform/design-system";
import type { BreadcrumbSegment } from "@/lib/breadcrumb";

function BreadcrumbChevron() {
  return (
    <span
      className="inline-flex shrink-0 items-center text-[10px] text-text-3"
      aria-hidden
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </span>
  );
}

function BreadcrumbLabel({ segment }: { segment: BreadcrumbSegment }) {
  if (segment.ltr) {
    return (
      <bdi dir="ltr" className="inline-block [direction:ltr] [unicode-bidi:isolate]">
        {segment.label}
      </bdi>
    );
  }
  return segment.label;
}

export function AppBreadcrumb({
  segments,
  className,
}: {
  segments: BreadcrumbSegment[];
  className?: string;
}) {
  if (segments.length === 0) return null;

  return (
    <nav
      className={cn(
        "flex min-w-0 shrink-0 flex-wrap items-center gap-[7px] text-[12px] text-text-3",
        className,
      )}
      id="tb-bc"
      aria-label="مسار التنقل"
    >
      {segments.map((segment, index) => {
        const isCurrent = segment.current ?? index === segments.length - 1;
        const showSep = index > 0;

        return (
          <span
            key={`${segment.label}-${index}`}
            className="inline-flex items-center gap-[5px]"
          >
            {showSep ? <BreadcrumbChevron /> : null}
            {isCurrent || !segment.href ? (
              <span className={cn(isCurrent && "font-bold text-gold-d")}>
                <BreadcrumbLabel segment={segment} />
              </span>
            ) : (
              <Link
                href={segment.href}
                className="text-text-3 no-underline transition-colors hover:text-gold-d"
              >
                <BreadcrumbLabel segment={segment} />
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}