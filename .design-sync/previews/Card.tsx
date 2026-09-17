import { Badge, Button, Card, CardBody, CardHeader } from "@platform/ui-kit";

export function Default() {
  return (
    <Card style={{ maxWidth: 380 }}>
      <CardHeader>
        <strong style={{ fontSize: 14 }}>بيانات الصك</strong>
        <Badge tone="success">مكتمل</Badge>
      </CardHeader>
      <CardBody>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
          رقم الصك 88120044991 — صادر بتاريخ 1445/03/12هـ، فعّال وغير موقوف.
        </p>
      </CardBody>
    </Card>
  );
}

export function WithFooterActions() {
  return (
    <Card style={{ maxWidth: 380 }}>
      <CardHeader>
        <strong style={{ fontSize: 14 }}>طلب مراجعة</strong>
      </CardHeader>
      <CardBody>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-2)" }}>
          هل تريد اعتماد هذا الطلب وإرساله للأخصائي؟
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="ghost" size="sm">
            إلغاء
          </Button>
          <Button variant="primary" size="sm">
            اعتماد
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export function BodyOnly() {
  return (
    <Card style={{ maxWidth: 320 }}>
      <CardBody>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
          بطاقة بلا رأس — للمحتوى المستقل.
        </p>
      </CardBody>
    </Card>
  );
}
