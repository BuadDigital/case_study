import {
  Button,
  OperationalToolbarSearch,
  OperationalToolbarSelect,
  PageToolbar,
} from "@platform/ui-kit";

export function Default() {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <PageToolbar>
        <OperationalToolbarSearch
          placeholder="بحث برقم الصك أو أمر العمل"
          style={{ flex: 1, minWidth: 180 }}
          readOnly
        />
        <OperationalToolbarSelect defaultValue="all" style={{ minWidth: 120 }}>
          <option value="all">كل الحالات</option>
          <option value="pending">قيد الانتظار</option>
          <option value="done">مكتملة</option>
        </OperationalToolbarSelect>
        <Button variant="outline" size="sm">
          تصفية
        </Button>
        <Button variant="ghost" size="sm">
          تصدير
        </Button>
      </PageToolbar>
    </div>
  );
}
