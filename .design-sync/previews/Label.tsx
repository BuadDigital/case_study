import { Input, Label } from "@platform/ui-kit";

export function Default() {
  return (
    <div style={{ maxWidth: 260 }}>
      <Label htmlFor="lbl-deed">رقم الصك</Label>
      <Input id="lbl-deed" defaultValue="88120044991" />
    </div>
  );
}

export function FieldSize() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 320 }}>
      <Label htmlFor="lbl-fee" size="field" style={{ minWidth: 90 }}>
        أتعاب التقييم
      </Label>
      <Input id="lbl-fee" defaultValue="3,500 ريال" />
    </div>
  );
}

export function Required() {
  return (
    <div style={{ maxWidth: 260 }}>
      <Label htmlFor="lbl-owner">
        اسم الملاك <span style={{ color: "var(--danger-text)" }}>*</span>
      </Label>
      <Input id="lbl-owner" placeholder="أدخل اسم الملاك" />
    </div>
  );
}
