import { EmptyIconBuilding, EmptyState } from "@platform/ui-kit";

export function Default() {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10 }}>
      <EmptyState line="لا توجد أوامر عمل حالياً" hint="ستظهر هنا فور استلام أمر عمل جديد من مكتب الاستقبال." />
    </div>
  );
}

export function Panel() {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10 }}>
      <EmptyState panel line="لا توجد عقارات مطابقة" hint="جرّب تعديل معايير البحث أو إزالة عوامل التصفية.">
        <EmptyIconBuilding />
      </EmptyState>
    </div>
  );
}
