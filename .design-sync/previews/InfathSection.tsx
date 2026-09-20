import {
  InfathSection,
  InfathSelectField,
  InfathTextAreaField,
  InfathTextField,
} from "@platform/ui-kit";

export function PropertyDataSection() {
  return (
    <div style={{ maxWidth: 420 }}>
      <InfathSection title="بيانات العقار">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <InfathTextField id="isec-deed" label="رقم الصك" required defaultValue="88120044991" />
          <InfathTextField id="isec-plot" label="رقم القطعة" defaultValue="1122" />
          <InfathSelectField id="isec-city" label="المدينة" defaultValue="riyadh">
            <option value="riyadh">الرياض</option>
            <option value="jeddah">جدة</option>
          </InfathSelectField>
          <InfathSelectField id="isec-usage" label="تصنيف الاستخدام" defaultValue="residential">
            <option value="residential">سكني</option>
            <option value="commercial">تجاري</option>
          </InfathSelectField>
        </div>
      </InfathSection>
    </div>
  );
}

export function InspectionSectionWithErrors() {
  return (
    <div style={{ maxWidth: 420 }}>
      <InfathSection title="المعاينة الميدانية">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <InfathTextField
            id="isec-inspector"
            label="اسم المعاين"
            required
            error="هذا الحقل مطلوب"
            defaultValue=""
          />
          <InfathSelectField id="isec-visit-result" label="نتيجة الزيارة" required defaultValue="">
            <option value="" disabled>
              اختر النتيجة
            </option>
            <option value="completed">تمت المعاينة</option>
            <option value="rescheduled">تم إعادة الجدولة</option>
          </InfathSelectField>
        </div>
        <div style={{ marginTop: 12 }}>
          <InfathTextAreaField
            id="isec-notes"
            label="ملاحظات المعاينة"
            rows={3}
            defaultValue="تم رصد شقوق طفيفة في الواجهة الشمالية للعقار."
          />
        </div>
      </InfathSection>
    </div>
  );
}
