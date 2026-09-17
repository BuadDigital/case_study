import { Button, PageShellHeader } from "@platform/ui-kit";

export function Default() {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <PageShellHeader
        title="قائمة أوامر العمل"
        meta={<span>٣٢ أمر عمل نشط اليوم</span>}
        actions={
          <Button variant="primary" size="sm">
            أمر عمل جديد
          </Button>
        }
      />
    </div>
  );
}

export function MetaOnly() {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <PageShellHeader
        title="سجل التدقيق"
        meta={<span>آخر تحديث قبل 5 دقائق — 214 حدثاً</span>}
      />
    </div>
  );
}
