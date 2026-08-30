import { cn } from "./lib/cn";
import { Badge, type BadgeTone } from "./components/Badge";

export type StatusPillStyle = {
  base: string;
  fg: string;
  live?: boolean;
};

/** Status chip with dot — matches docs/new look `.status` (work orders). */
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

// Module-level cached results — called per row/card; a new object each call
// used to break style identity stability on StatusPill (js-cache-function-results).
const LEGACY_DONE_STYLE: StatusPillStyle = Object.freeze({ base: "#3f8f5f", fg: "#2f7a4d" });
const LEGACY_FAIL_STYLE: StatusPillStyle = Object.freeze({ base: "var(--red)", fg: "var(--red-text)" });
const LEGACY_PROG_STYLE: StatusPillStyle = Object.freeze({ base: "var(--gold)", fg: "var(--gold-d)" });
const LEGACY_NEW_STYLE: StatusPillStyle = Object.freeze({ base: "var(--blue)", fg: "var(--blue-text)" });
const LEGACY_DEFAULT_STYLE: StatusPillStyle = Object.freeze({ base: "var(--heading)", fg: "var(--heading)" });

/** Color-only pill (keys / eng / val HTML `pill(t,c)`). */
export function statusPillStyleFromColor(color: string): StatusPillStyle {
  return { base: color, fg: color };
}

const FIN_STATUS_STYLES = {
  default: Object.freeze({
    base: "var(--ink)",
    fg: "var(--ink)",
  }) satisfies StatusPillStyle,
  gold: Object.freeze({
    base: "var(--gold)",
    fg: "var(--gold-d)",
  }) satisfies StatusPillStyle,
  green: Object.freeze({
    base: "#3f8f5f",
    fg: "#2f7a4d",
  }) satisfies StatusPillStyle,
  red: Object.freeze({
    base: "#c0553d",
    fg: "#a5432e",
  }) satisfies StatusPillStyle,
  teal: Object.freeze({
    base: "#0f766e",
    fg: "#0f766e",
  }) satisfies StatusPillStyle,
} as const;

export type FinStatusTone = keyof typeof FIN_STATUS_STYLES;

/** Finance chip tones → StatusPillStyle (replaces finStatus* class strings). */
export function finStatusStyle(status: string): StatusPillStyle {
  switch (status) {
    case "closed":
    case "paid":
    case "ready":
    case "success":
      return FIN_STATUS_STYLES.green;
    case "cancelled":
    case "rejected":
    case "danger":
      return FIN_STATUS_STYLES.red;
    case "issued":
    case "invoice_received":
    case "deferred":
    case "warning":
    case "draft":
      return FIN_STATUS_STYLES.gold;
    case "individual":
      return FIN_STATUS_STYLES.teal;
    default:
      return FIN_STATUS_STYLES.default;
  }
}

export { FIN_STATUS_STYLES };

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
