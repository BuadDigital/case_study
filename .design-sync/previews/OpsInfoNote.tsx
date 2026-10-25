import { OpsInfoNote } from "@platform/ui-kit";

export function Variants() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 420 }}>
      <OpsInfoNote>تُحتسب الأتعاب من جدول التسعير المعتمد للمكتب.</OpsInfoNote>
      <OpsInfoNote variant="amber">لم يُرفع مخطط المساحة بعد.</OpsInfoNote>
      <OpsInfoNote variant="red">الإحداثيات خارج حدود الصك.</OpsInfoNote>
    </div>
  );
}
