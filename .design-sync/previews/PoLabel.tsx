import { PoLabel } from "@platform/ui-kit";

export function PoNumber() {
  return (
    <div dir="rtl" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
      <span>أمر العمل:</span>
      <PoLabel value="PO-2026-0005" />
    </div>
  );
}

export function EmptyPo() {
  return (
    <div dir="rtl" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
      <span>أمر العمل:</span>
      <PoLabel value={null} />
    </div>
  );
}
