import { InfathTextField } from "@platform/ui-kit";

export function Default() {
  return (
    <div style={{ maxWidth: 280, paddingTop: 8 }}>
      <InfathTextField id="itf-po" label="رقم الطلب" defaultValue="PO-2026-0005" />
    </div>
  );
}

export function Required() {
  return (
    <div style={{ maxWidth: 280, paddingTop: 8 }}>
      <InfathTextField id="itf-deed" label="رقم الصك" required defaultValue="88120044991" />
    </div>
  );
}

export function WithError() {
  return (
    <div style={{ maxWidth: 280, paddingTop: 8 }}>
      <InfathTextField
        id="itf-national-id"
        label="رقم الهوية الوطنية"
        required
        defaultValue="102938"
        error="رقم الهوية يجب أن يكون 10 أرقام"
      />
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ maxWidth: 280, paddingTop: 8 }}>
      <InfathTextField id="itf-status" label="حالة الطلب" disabled defaultValue="مغلق" />
    </div>
  );
}
