import { LtrCode } from "@platform/ui-kit";

export function CodesInContext() {
  return (
    <div
      dir="rtl"
      style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span>رقم أمر العمل:</span>
        <LtrCode style={{ fontWeight: 700 }}>PO-2026-0005</LtrCode>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span>رقم الصك:</span>
        <LtrCode style={{ fontWeight: 700, color: "var(--gold-d)" }}>
          88120044991
        </LtrCode>
      </div>
    </div>
  );
}
