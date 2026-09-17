import { FormGroup, FormRow, Input, Label, Select } from "@platform/ui-kit";

export function Default() {
  return (
    <div style={{ maxWidth: 480 }}>
      <FormRow>
        <FormGroup>
          <Label htmlFor="fr-po">رقم الطلب</Label>
          <Input id="fr-po" defaultValue="PO-2026-0005" />
        </FormGroup>
        <FormGroup>
          <Label htmlFor="fr-deed">رقم الصك</Label>
          <Input id="fr-deed" defaultValue="88120044991" />
        </FormGroup>
      </FormRow>
    </div>
  );
}

export function ThreeFields() {
  return (
    <div style={{ maxWidth: 480 }}>
      <FormRow>
        <FormGroup>
          <Label htmlFor="fr-owner">اسم الملاك</Label>
          <Input id="fr-owner" defaultValue="خالد الدوسري" />
        </FormGroup>
        <FormGroup>
          <Label htmlFor="fr-city">المدينة</Label>
          <Select id="fr-city" defaultValue="jeddah">
            <option value="riyadh">الرياض</option>
            <option value="jeddah">جدة</option>
          </Select>
        </FormGroup>
        <FormGroup>
          <Label htmlFor="fr-date">تاريخ المعاينة</Label>
          <Input id="fr-date" type="date" defaultValue="2026-09-14" />
        </FormGroup>
      </FormRow>
    </div>
  );
}
