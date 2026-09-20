import { PageShell } from "@platform/ui-kit";

export function Sheet() {
  return (
    <div
      style={{
        height: 320,
        overflow: "hidden",
        border: "1px solid var(--border)",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <PageShell>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
            قائمة أوامر العمل
          </h1>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 12,
              fontSize: 13,
              color: "var(--text-2)",
            }}
          >
            أمر عمل رقم 40021 — تقييم عقاري لفيلا سكنية بحي الملقا.
          </div>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 12,
              fontSize: 13,
              color: "var(--text-2)",
            }}
          >
            أمر عمل رقم 40022 — مراجعة صك ومسح هندسي لأرض تجارية بحي العليا.
          </div>
        </div>
      </PageShell>
    </div>
  );
}

export function Canvas() {
  return (
    <PageShell variant="canvas" style={{ border: "1px solid var(--border)", borderRadius: 10 }}>
      <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
        لوحة الأوامر التشغيلية
      </h1>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
        يعرض هذا القسم ملخص أوامر العمل المفتوحة اليوم موزّعة حسب الحالة.
      </p>
    </PageShell>
  );
}
