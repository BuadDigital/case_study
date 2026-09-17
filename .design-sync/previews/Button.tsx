import { Button } from "@platform/ui-kit";

export function Variants() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      <Button variant="default">إلغاء</Button>
      <Button variant="primary">حفظ</Button>
      <Button variant="outline">تعديل</Button>
      <Button variant="accent">اعتماد</Button>
      <Button variant="success">قبول</Button>
      <Button variant="danger">حذف</Button>
      <Button variant="dangerOutline">رفض</Button>
      <Button variant="ghost">تجاهل</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Button variant="primary" size="sm">
        حفظ
      </Button>
      <Button variant="primary" size="default">
        حفظ
      </Button>
      <Button variant="primary" size="lg">
        حفظ
      </Button>
    </div>
  );
}

export function States() {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <Button variant="primary">حفظ التعديلات</Button>
      <Button variant="primary" loading>
        جارٍ الحفظ
      </Button>
      <Button variant="primary" disabled>
        حفظ التعديلات
      </Button>
    </div>
  );
}
