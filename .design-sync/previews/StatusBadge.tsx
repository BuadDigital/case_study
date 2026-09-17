import { StatusBadge } from "@platform/ui-kit";

export function StatusSweep() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <StatusBadge status="done" />
      <StatusBadge status="review" />
      <StatusBadge status="fail" />
      <StatusBadge status="under_study" />
      <StatusBadge status="approved" />
      <StatusBadge status="pending" />
    </div>
  );
}
