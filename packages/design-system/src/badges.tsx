import { Badge, type BadgeTone } from "./components/Badge";

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
