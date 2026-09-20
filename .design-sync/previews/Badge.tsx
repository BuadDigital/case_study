import { Badge } from "@platform/ui-kit";

export function Tones() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <Badge tone="default">جديد</Badge>
      <Badge tone="primary">قيد المراجعة</Badge>
      <Badge tone="success">مكتمل</Badge>
      <Badge tone="warning">قيد الانتظار</Badge>
      <Badge tone="danger">متعذر</Badge>
      <Badge tone="info">معلومة</Badge>
      <Badge tone="purple">مميز</Badge>
      <Badge tone="orange">عاجل</Badge>
    </div>
  );
}

export function WithDot() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <Badge tone="success" dot>
        نشط
      </Badge>
      <Badge tone="danger" dot>
        متأخر
      </Badge>
      <Badge tone="warning" dot>
        بانتظار الرد
      </Badge>
    </div>
  );
}
