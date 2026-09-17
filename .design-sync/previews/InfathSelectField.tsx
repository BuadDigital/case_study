import { InfathSelectField } from "@platform/ui-kit";

export function Default() {
  return (
    <div style={{ maxWidth: 280, paddingTop: 8 }}>
      <InfathSelectField id="isf-city" label="المدينة" defaultValue="riyadh">
        <option value="riyadh">الرياض</option>
        <option value="jeddah">جدة</option>
        <option value="dammam">الدمام</option>
      </InfathSelectField>
    </div>
  );
}

export function Required() {
  return (
    <div style={{ maxWidth: 280, paddingTop: 8 }}>
      <InfathSelectField id="isf-usage" label="تصنيف الاستخدام" required defaultValue="residential">
        <option value="residential">سكني</option>
        <option value="commercial">تجاري</option>
        <option value="agricultural">زراعي</option>
      </InfathSelectField>
    </div>
  );
}

export function WithError() {
  return (
    <div style={{ maxWidth: 280, paddingTop: 8 }}>
      <InfathSelectField id="isf-specialist" label="أخصائي الحالة" required defaultValue="" error="يجب اختيار أخصائي الحالة">
        <option value="" disabled>
          اختر الأخصائي
        </option>
        <option value="s1">نورة القحطاني</option>
        <option value="s2">عبدالعزيز الحربي</option>
      </InfathSelectField>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ maxWidth: 280, paddingTop: 8 }}>
      <InfathSelectField id="isf-status" label="حالة الطلب" disabled defaultValue="closed">
        <option value="closed">مغلق</option>
      </InfathSelectField>
    </div>
  );
}
