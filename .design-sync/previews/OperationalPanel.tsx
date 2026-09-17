import { OperationalPanel, PageShellHeader } from "@platform/ui-kit";

export function Default() {
  return (
    <OperationalPanel>
      <PageShellHeader title="ملخص الطلب" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16 }}>
        <Row label="رقم الصك" value="88120044991" />
        <Row label="نوع العقار" value="فيلا سكنية" />
        <Row label="الحي" value="الملقا — الرياض" />
        <Row label="المقيّم المسؤول" value="م. سارة القحطاني" />
      </div>
    </OperationalPanel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "var(--text-3)" }}>{label}</span>
      <span style={{ color: "var(--text)", fontWeight: 600 }}>{value}</span>
    </div>
  );
}
