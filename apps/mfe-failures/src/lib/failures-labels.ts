import type { FailureRecord, FailureStatus } from "./failures-types";

export function failureStatusLabel(status: FailureStatus): string {
  if (status === "internal") return "مسودة داخلية";
  if (status === "review") return "عند مشرف دراسة الحالة";
  if (status === "suspended") return "معلقة";
  if (status === "approved") return "معتمد";
  if (status === "resolved") return "تم الحل";
  return "معاد للأخصائي";
}

export function failureSeverityLabel(
  severity: FailureRecord["severity"],
): string {
  if (severity === "suspected") return "احتمال تعذر";
  return "تعذر داخلي";
}
