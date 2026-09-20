function arabicDayCount(days: number): string {
  if (days === 1) return "يوم";
  if (days === 2) return "يومين";
  if (days >= 3 && days <= 10) return `${days} أيام`;
  return `${days} يومًا`;
}

export type RowAge = {
  /** "اليوم" / "منذ يوم" / "منذ يومين" / "منذ N أيام" / "منذ N يومًا". */
  label: string;
  /** True once `now` has passed `slaDeadline` (when one was given). */
  overdue: boolean;
};

/**
 * Row-age column formatter for work queues — an Arabic "منذ N يومًا" label
 * instead of a raw date, with an `overdue` flag once `slaDeadline` has
 * passed. Pair with `className={overdue ? "text-warning" : undefined}` on
 * the cell content (`--warning` = amber, per the docs/new-look decision).
 */
export function formatRowAge(
  value: string | number | Date,
  options?: {
    slaDeadline?: string | number | Date;
    /** Override "now" for testing. @default Date.now() */
    now?: string | number | Date;
  },
): RowAge {
  const then = new Date(value).getTime();
  const now = options?.now ? new Date(options.now).getTime() : Date.now();
  const days = Math.max(0, Math.floor((now - then) / 86_400_000));
  const label = days === 0 ? "اليوم" : `منذ ${arabicDayCount(days)}`;
  const overdue = options?.slaDeadline
    ? now > new Date(options.slaDeadline).getTime()
    : false;
  return { label, overdue };
}
