import { Badge, Card, CardHeader } from "@platform/ui-kit";

export function TitleOnly() {
  return (
    <Card style={{ maxWidth: 380 }}>
      <CardHeader>
        <strong style={{ fontSize: 14 }}>بيانات الصك</strong>
      </CardHeader>
    </Card>
  );
}

export function TitleWithBadge() {
  return (
    <Card style={{ maxWidth: 380 }}>
      <CardHeader>
        <strong style={{ fontSize: 14 }}>حالة الطلب</strong>
        <Badge tone="warning">قيد الانتظار</Badge>
      </CardHeader>
    </Card>
  );
}
