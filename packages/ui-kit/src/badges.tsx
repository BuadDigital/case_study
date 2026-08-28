import { cn } from "./lib/cn";
import { Badge, type BadgeTone } from "./components/Badge";

export type StatusPillStyle = {
  base: string;
  fg: string;
  live?: boolean;
};

/** Status chip with dot — matches docs/new look `.status` (أوامر العمل). */
export function StatusPill({
  label,
  style,
  className,
}: {
  label: string;
  style: StatusPillStyle;
  className?: string;
}) {
  return (
    <span
      dir="rtl"
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-[11px] py-[3px] text-xs font-bold",
        className,
      )}
      style={{
        background: `color-mix(in srgb, ${style.base} 14%, transparent)`,
        color: style.fg,
      }}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          style.live && "ui-status-dot-live",
        )}
        style={{ background: style.base }}
      />
      {label}
    </span>
  );
}

// نتائج ثابتة على مستوى الوحدة — تُستدعى لكل صف/بطاقة، وكائن جديد في كل استدعاء
// كان يمنع ثبات هوية style على StatusPill (js-cache-function-results).
const LEGACY_DONE_STYLE: StatusPillStyle = Object.freeze({ base: "#3f8f5f", fg: "#2f7a4d" });
const LEGACY_FAIL_STYLE: StatusPillStyle = Object.freeze({ base: "var(--red)", fg: "var(--red-text)" });
const LEGACY_PROG_STYLE: StatusPillStyle = Object.freeze({ base: "var(--gold)", fg: "var(--gold-d)" });
const LEGACY_NEW_STYLE: StatusPillStyle = Object.freeze({ base: "var(--blue)", fg: "var(--blue-text)" });
const LEGACY_DEFAULT_STYLE: StatusPillStyle = Object.freeze({ base: "var(--heading)", fg: "var(--heading)" });

/** Maps queue legacy classes (`b-done`, `b-prog`, …) to new-look status colors. */
export function queueLegacyStatusStyle(className: string): StatusPillStyle {
  if (className.includes("done")) return LEGACY_DONE_STYLE;
  if (className.includes("fail")) return LEGACY_FAIL_STYLE;
  if (className.includes("prog")) return LEGACY_PROG_STYLE;
  if (className.includes("new")) return LEGACY_NEW_STYLE;
  return LEGACY_DEFAULT_STYLE;
}

/** Mirrors `sb()` in system_prototype_4.html */
const STATUS_MAP: Record<string, readonly [string, BadgeTone]> = {
  new: ["جديد", "info"],
  progress: ["قيد التنفيذ", "warning"],
  done: ["مكتمل", "success"],
  fail: ["متعذر", "danger"],
  incomplete: ["ناقص", "warning"],
  review: ["قيد المراجعة", "warning"],
  approved: ["معتمد", "success"],
  pending: ["معلّق", "info"],
  under_study: ["قيد الدراسة", "warning"],
  removed: ["محذوف", "danger"],
};

export function StatusBadge({ status }: { status: string }) {
  const [label, tone] = STATUS_MAP[status] ?? ["—", "default"];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}
