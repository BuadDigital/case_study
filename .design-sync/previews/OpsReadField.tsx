import { OpsReadField } from "@platform/ui-kit";

export function Default() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 420 }}>
      <OpsReadField label="رقم الصك" value="611508007272" ltr />
      <OpsReadField label="المدينة" value="الخرج" />
      <OpsReadField label="الحي" />
    </div>
  );
}
