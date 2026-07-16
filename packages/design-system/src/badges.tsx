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
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-bold",
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

/** Maps queue legacy classes (`b-done`, `b-prog`, …) to new-look status colors. */
export function queueLegacyStatusStyle(className: string): StatusPillStyle {
  if (className.includes("done")) {
    return { base: "#3f8f5f", fg: "#2f7a4d" };
  }
  if (className.includes("fail")) {
    return { base: "var(--red)", fg: "var(--red-text)" };
  }
  if (className.includes("prog")) {
    return { base: "var(--gold)", fg: "var(--gold-d)" };
  }
  if (className.includes("new")) {
    return { base: "var(--blue)", fg: "var(--blue-text)" };
  }
  return { base: "var(--heading)", fg: "var(--heading)" };
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

/** Mirrors `tb()` in system_prototype_4.html — مراحل مسار العقار (رفع / تقييم / دراسة). */
const WORKFLOW_MAP: Record<string, readonly [string, BadgeTone]> = {
  new: ["لم يبدأ", "default"],
  progress: ["جارٍ", "warning"],
  done: ["مكتمل", "success"],
  fail: ["متعذر", "danger"],
};

export function WorkflowStageBadge({ stage }: { stage: string }) {
  const [label, tone] = WORKFLOW_MAP[stage] ?? ["—", "default"];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}
