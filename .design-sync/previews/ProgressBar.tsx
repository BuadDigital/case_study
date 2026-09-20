import { ProgressBar } from "@platform/ui-kit";

function Row({ label, value, tone }: { label: string; value: number; tone: "primary" | "success" | "warning" | "danger" }) {
  return (
    <div style={{ width: 320 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--text-2)",
          marginBottom: 4,
        }}
      >
        <span>نسبة اكتمال المعاينة الميدانية</span>
        <span>{value}%</span>
      </div>
      <ProgressBar value={value} tone={tone} />
    </div>
  );
}

export function Quarter() {
  return <Row label="نسبة اكتمال المعاينة الميدانية" value={25} tone="warning" />;
}

export function Majority() {
  return <Row label="نسبة اكتمال المعاينة الميدانية" value={60} tone="primary" />;
}

export function Complete() {
  return <Row label="نسبة اكتمال المعاينة الميدانية" value={100} tone="success" />;
}
