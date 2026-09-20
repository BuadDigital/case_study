import { Note } from "@platform/ui-kit";

/** All five tones — sweep since Note has a `tone` prop. */
export function Tones() {
  return (
    <div style={{ display: "flex", flexDirection: "column", maxWidth: 420 }}>
      <Note tone="default">يمكنك تعديل هذه البيانات لاحقاً من تبويب المستندات.</Note>
      <Note tone="info">سيتم إرسال إشعار للأخصائي فور اعتماد الطلب.</Note>
      <Note tone="warn">لم يتم رفع صورة الصك بعد — الطلب لن يكتمل بدونها.</Note>
      <Note tone="success">تم التحقق من رقم الصك مقابل منصة ناجز بنجاح.</Note>
      <Note tone="danger">تعذّر التحقق من الصك — الرقم غير مطابق لسجلات ناجز.</Note>
    </div>
  );
}
