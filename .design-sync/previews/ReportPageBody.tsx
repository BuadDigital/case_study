import { ReportPageBody } from "@platform/ui-kit";

export function Default() {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)" }}>
      <ReportPageBody style={{ overflow: "visible" }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            ملخص تقرير التقييم
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)", lineHeight: 1.7 }}>
            تم تقييم العقار محل الطلب باستخدام طريقة المبيعات المشابهة، بالاعتماد على ثلاثة عقارات
            مقارنة ضمن نفس الحي خلال آخر ستة أشهر.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Field label="القيمة السوقية المقدّرة" value="٢٬٤٥٠٬٠٠٠ ريال" />
          <Field label="تاريخ المعاينة" value="1447/03/10هـ" />
          <Field label="المقيّم المعتمد" value="م. سارة القحطاني — رخصة 4021" />
        </div>
      </ReportPageBody>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "1px dashed var(--border)", paddingBottom: 6 }}>
      <span style={{ color: "var(--text-3)" }}>{label}</span>
      <span style={{ color: "var(--text)", fontWeight: 600 }}>{value}</span>
    </div>
  );
}
