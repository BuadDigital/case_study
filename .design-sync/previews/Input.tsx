import { Input, Label } from "@platform/ui-kit";

export function Default() {
  return (
    <div style={{ maxWidth: 280 }}>
      <Label htmlFor="input-po">رقم الطلب</Label>
      <Input id="input-po" defaultValue="PO-2026-0005" />
    </div>
  );
}

export function WithError() {
  return (
    <div style={{ maxWidth: 280 }}>
      <Label htmlFor="input-deed">رقم الصك</Label>
      <Input id="input-deed" hasError defaultValue="8812004" />
      <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "var(--danger-text)" }}>
        رقم الصك غير صحيح، يجب أن يكون 10 أرقام
      </span>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ maxWidth: 280 }}>
      <Label htmlFor="input-owner">اسم الملاك</Label>
      <Input id="input-owner" disabled defaultValue="محمد بن عبدالله العتيبي" />
    </div>
  );
}

export function DateType() {
  return (
    <div style={{ maxWidth: 280 }}>
      <Label htmlFor="input-date">تاريخ المعاينة</Label>
      <Input id="input-date" type="date" defaultValue="2026-09-14" />
    </div>
  );
}

export function Placeholder() {
  return (
    <div style={{ maxWidth: 280 }}>
      <Label htmlFor="input-plot">رقم القطعة</Label>
      <Input id="input-plot" placeholder="مثال: 1122" />
    </div>
  );
}
