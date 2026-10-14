import type { BadgeTone } from "@platform/ui-kit";

/**
 * PO list statuses. Delivery is the Enfaz handover: `completed` means every property was handed
 * over, `ready_for_enfaz` that the study is finished but the handover is still pending. The two
 * billing labels relabel those once Finance issued an invoice — only Finance and management see
 * them (`canSeeBillingStatuses`); everyone else reads the row's `studyStatus`.
 */
export type PoListStatus =
  | "new"
  | "under_study"
  | "ready_for_enfaz"
  | "cancelled"
  | "stopped"
  | "completed"
  | "partially_billed"
  | "fully_billed";

/** Filter-only buckets: `active` = every non-terminal status, `closed` = every terminal one. */
export type PoListStatusBucket = PoListStatus | "active" | "closed";

export type PoListStatusOption = { value: PoListStatusBucket | ""; label: string };

const PO_LIST_STATUS_META: Record<
  PoListStatus,
  { tone: BadgeTone; label: string }
> = {
  new: { tone: "default", label: "جديد" },
  under_study: { tone: "info", label: "قيد الدراسة" },
  ready_for_enfaz: { tone: "warning", label: "جاهز للرفع على إنفاذ" },
  cancelled: { tone: "danger", label: "ملغى" },
  stopped: { tone: "warning", label: "متوقف" },
  completed: { tone: "success", label: "مكتمل" },
  partially_billed: { tone: "primary", label: "مفوتر جزئي" },
  fully_billed: { tone: "success", label: "مفوتر بالكامل" },
};

/** Dropdown order: the study cycle first, then the billing labels, then the manual overrides. */
const PO_LIST_STATUS_ORDER: readonly PoListStatus[] = [
  "new",
  "under_study",
  "ready_for_enfaz",
  "completed",
  "partially_billed",
  "fully_billed",
  "stopped",
  "cancelled",
];

const PO_LIST_BILLING_STATUSES: readonly PoListStatus[] = [
  "partially_billed",
  "fully_billed",
];

export function isPoListBillingStatus(status: PoListStatus): boolean {
  return PO_LIST_BILLING_STATUSES.includes(status);
}

/**
 * The status filter's options: «جميع الحالات», the two buckets, then the single statuses. Without
 * `billing` the two billing labels are left out — the roles that do not see them cannot filter on
 * them either.
 */
export function poListStatusOptions({
  billing,
}: {
  billing: boolean;
}): PoListStatusOption[] {
  return [
    { value: "", label: "جميع الحالات" },
    { value: "active", label: "النشطة" },
    { value: "closed", label: "المغلقة" },
    ...PO_LIST_STATUS_ORDER.filter((status) => billing || !isPoListBillingStatus(status)).map(
      (value) => ({ value, label: PO_LIST_STATUS_META[value].label }),
    ),
  ];
}

export const PO_LIST_STATUS_OPTIONS: PoListStatusOption[] = poListStatusOptions({
  billing: true,
});

export function normalizePoListStatus(status: string): PoListStatus {
  if (status in PO_LIST_STATUS_META) return status as PoListStatus;
  return "new";
}

/**
 * The study status behind a billing label, for a server that did not send `studyStatus`:
 * «مفوتر بالكامل» is delivered, «مفوتر جزئي» is still under study.
 */
export function studyStatusOf(status: PoListStatus): PoListStatus {
  if (status === "fully_billed") return "completed";
  if (status === "partially_billed") return "under_study";
  return status;
}

export function poListStatusMeta(status: PoListStatus): {
  tone: BadgeTone;
  label: string;
} {
  return PO_LIST_STATUS_META[status] ?? PO_LIST_STATUS_META.new;
}

/** Nothing left for the office: cancelled, stopped, or delivered. «جاهز للرفع» is still open work. */
export function isPoListStatusTerminal(status: PoListStatus): boolean {
  return (
    status === "cancelled" ||
    status === "stopped" ||
    status === "completed" ||
    status === "fully_billed"
  );
}

/** Progress bar: prefer API workflow progress; else share of handed-over properties. */
export function poProgressPct(
  _registered: number | undefined,
  handedOver: number | undefined,
  expected: number | undefined,
  workflowPct?: number | null,
): number {
  if (workflowPct != null && Number.isFinite(workflowPct)) {
    return Math.min(100, Math.max(0, Math.round(workflowPct)));
  }
  const done = Math.max(0, Number(handedOver) || 0);
  const exp = Math.max(0, Number(expected) || 0);
  if (exp <= 0) return 0;
  return Math.min(100, Math.round((done / exp) * 100));
}
