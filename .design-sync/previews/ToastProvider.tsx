import { Button, Card, CardBody, CardHeader, ToastProvider } from "@platform/ui-kit";

/** Provider wraps realistic content — the portal renders empty until a toast fires. */
export function Default() {
  return (
    <ToastProvider>
      <Card style={{ maxWidth: 380 }}>
        <CardHeader>
          <strong style={{ fontSize: 14 }}>طلب معاينة ميدانية</strong>
        </CardHeader>
        <CardBody>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-2)" }}>
            هل تريد اعتماد هذا الطلب وإرساله للمفتش الميداني؟
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
    </ToastProvider>
  );
}
