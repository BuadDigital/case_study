import { FormGroup, Input, Label, Select } from "@platform/ui-kit";

export function Default() {
  return (
    <div style={{ maxWidth: 280 }}>
      <FormGroup>
        <Label htmlFor="fg-po">رقم الطلب</Label>
        <Input id="fg-po" defaultValue="PO-2026-0005" />
      </FormGroup>
      <FormGroup>
        <Label htmlFor="fg-city">المدينة</Label>
        <Select id="fg-city" defaultValue="riyadh">
          <option value="riyadh">الرياض</option>
          <option value="jeddah">جدة</option>
        </Select>
      </FormGroup>
    </div>
  );
}

export function WithError() {
  return (
    <div style={{ maxWidth: 280 }}>
      <FormGroup hasError>
        <Label htmlFor="fg-deed">رقم الصك</Label>
        <Input id="fg-deed" hasError defaultValue="881200" />
        <span style={{ fontSize: 12, color: "var(--danger-text)" }}>
          رقم الصك يجب أن يكون 10 أرقام
        </span>
      </FormGroup>
    </div>
  );
}

export function Stacked() {
  return (
    <div style={{ maxWidth: 280 }}>
      <FormGroup>
        <Label htmlFor="fg-owner">اسم الملاك</Label>
        <Input id="fg-owner" defaultValue="فاطمة الشهري" />
      </FormGroup>
      <FormGroup>
        <Label htmlFor="fg-national-id">رقم الهوية الوطنية</Label>
        <Input id="fg-national-id" defaultValue="1029384756" />
      </FormGroup>
      <FormGroup>
        <Label htmlFor="fg-phone">رقم الجوال</Label>
        <Input id="fg-phone" defaultValue="0555123456" />
      </FormGroup>
    </div>
  );
}
