import type { BadgeTone } from "@platform/design-system";

export type PoListStatus =
  | "new"
  | "under_study"
  | "cancelled"
  | "stopped"
  | "completed"
  | "partially_billed"
  | "fully_billed";

export const PO_LIST_STATUS_OPTIONS: { value: PoListStatus | ""; label: string }[] = [
  { value: "", label: "جميع الحالات" },
  { value: "new", label: "جديد" },
  { value: "under_study", label: "قيد الدراسة" },
  { value: "cancelled", label: "ملغي" },
  { value: "stopped", label: "متوقف" },
  { value: "completed", label: "مكتمل" },
  { value: "partially_billed", label: "مفوتر جزئي" },
  { value: "fully_billed", label: "مفوتر بالكامل" },
];

const PO_LIST_STATUS_META: Record<
  PoListStatus,
  { tone: BadgeTone; label: string }
> = {
  new: { tone: "default", label: "جديد" },
  under_study: { tone: "info", label: "قيد الدراسة" },
  cancelled: { tone: "danger", label: "ملغي" },
  stopped: { tone: "warning", label: "متوقف" },
  completed: { tone: "success", label: "مكتمل" },
  partially_billed: { tone: "primary", label: "مفوتر جزئي" },
  fully_billed: { tone: "success", label: "مفوتر بالكامل" },
};

export function normalizePoListStatus(status: string): PoListStatus {
  if (status in PO_LIST_STATUS_META) return status as PoListStatus;
  return "new";
}

export function poListStatusMeta(status: PoListStatus): {
  tone: BadgeTone;
  label: string;
} {
  return PO_LIST_STATUS_META[status] ?? PO_LIST_STATUS_META.new;
}

export function isPoListStatusTerminal(status: PoListStatus): boolean {
  return (
    status === "cancelled" ||
    status === "stopped" ||
    status === "completed" ||
    status === "fully_billed"
  );
}

/** شريط التقدم: نسبة العقارات التي اكتملت دراستها (رفع النموذج للنظام). */
export function poProgressPct(
  _registered: number | undefined,
  studied: number | undefined,
  expected: number | undefined,
): number {
  const done = Math.max(0, Number(studied) || 0);
  const exp = Math.max(0, Number(expected) || 0);
  if (exp <= 0) return 0;
  return Math.min(100, Math.round((done / exp) * 100));
}
