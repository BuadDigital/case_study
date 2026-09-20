import { Label, Select } from "@platform/ui-kit";

export function Default() {
  return (
    <div style={{ maxWidth: 260 }}>
      <Label htmlFor="sel-city">المدينة</Label>
      <Select id="sel-city" defaultValue="riyadh">
        <option value="riyadh">الرياض</option>
        <option value="jeddah">جدة</option>
        <option value="dammam">الدمام</option>
        <option value="makkah">مكة المكرمة</option>
      </Select>
    </div>
  );
}

export function WithError() {
  return (
    <div style={{ maxWidth: 260 }}>
      <Label htmlFor="sel-usage">تصنيف الاستخدام</Label>
      <Select id="sel-usage" hasError defaultValue="">
        <option value="" disabled>
          اختر التصنيف
        </option>
        <option value="residential">سكني</option>
        <option value="commercial">تجاري</option>
      </Select>
      <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "var(--danger-text)" }}>
        يجب اختيار تصنيف الاستخدام
      </span>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ maxWidth: 260 }}>
      <Label htmlFor="sel-status">حالة الطلب</Label>
      <Select id="sel-status" disabled defaultValue="closed">
        <option value="closed">مغلق</option>
      </Select>
    </div>
  );
}

export function SidebarVariant() {
  return (
    <div style={{ maxWidth: 220, background: "var(--sidebar)", padding: 12, borderRadius: 8 }}>
      <Select variant="sidebar" defaultValue="specialist">
        <option value="specialist">أخصائي الحالة</option>
        <option value="valuer">المقيّم الميداني</option>
        <option value="reviewer">مراجع التقارير</option>
      </Select>
    </div>
  );
}
