import { Label, Textarea } from "@platform/ui-kit";

export function Default() {
  return (
    <div style={{ maxWidth: 340 }}>
      <Label htmlFor="ta-notes">ملاحظات المعاينة الميدانية</Label>
      <Textarea
        id="ta-notes"
        rows={4}
        defaultValue="تم رصد شقوق طفيفة في الواجهة الشمالية، والعقار مسكون حالياً من قبل الملاك."
      />
    </div>
  );
}

export function WithError() {
  return (
    <div style={{ maxWidth: 340 }}>
      <Label htmlFor="ta-reason">سبب رفض الطلب</Label>
      <Textarea id="ta-reason" rows={3} hasError defaultValue="" placeholder="يرجى ذكر سبب الرفض" />
      <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "var(--danger-text)" }}>
        هذا الحقل مطلوب
      </span>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ maxWidth: 340 }}>
      <Label htmlFor="ta-summary">ملخص التقييم النهائي</Label>
      <Textarea
        id="ta-summary"
        rows={4}
        disabled
        defaultValue="القيمة السوقية للعقار 1,850,000 ريال بناءً على أسلوب المقارنة."
      />
    </div>
  );
}
