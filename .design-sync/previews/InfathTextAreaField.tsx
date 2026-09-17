import { InfathTextAreaField } from "@platform/ui-kit";

export function Default() {
  return (
    <div style={{ maxWidth: 340, paddingTop: 8 }}>
      <InfathTextAreaField
        id="itaf-notes"
        label="ملاحظات المعاينة الميدانية"
        rows={4}
        defaultValue="تم رصد شقوق طفيفة في الواجهة الشمالية، والعقار مسكون حالياً من قبل الملاك."
      />
    </div>
  );
}

export function Required() {
  return (
    <div style={{ maxWidth: 340, paddingTop: 8 }}>
      <InfathTextAreaField
        id="itaf-reason"
        label="سبب رفض الطلب"
        required
        rows={3}
        placeholder="يرجى ذكر سبب الرفض بالتفصيل"
      />
    </div>
  );
}

export function WithError() {
  return (
    <div style={{ maxWidth: 340, paddingTop: 8 }}>
      <InfathTextAreaField
        id="itaf-summary"
        label="ملخص التقييم النهائي"
        required
        rows={3}
        defaultValue=""
        error="هذا الحقل مطلوب"
      />
    </div>
  );
}
