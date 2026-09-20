import { PageGutter } from "@platform/ui-kit";

export function Default() {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)" }}>
      <PageGutter
        style={{
          paddingTop: 16,
          paddingBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
          بيانات دراسة الحالة
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
          رقم أمر العمل 40021 — عقار سكني بحي الملقا، الرياض. الحالة: قيد المعاينة الميدانية.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-3)" }}>
          أُنشئ الطلب بتاريخ 1447/03/02هـ من قبل مكتب الاستقبال.
        </p>
      </PageGutter>
    </div>
  );
}
