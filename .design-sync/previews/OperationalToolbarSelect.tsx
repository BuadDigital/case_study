import {
  OperationalToolbarPrimaryButton,
  OperationalToolbarSearch,
  OperationalToolbarSelect,
} from "@platform/ui-kit";

const heroRing = {
  borderRadius: 11,
  boxShadow: "0 0 0 3px color-mix(in srgb, var(--gold) 30%, transparent)",
};

export function Default() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        padding: 14,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
      }}
    >
      <OperationalToolbarSearch
        placeholder="بحث برقم الطلب"
        defaultValue="PO-2026-0142"
      />
      <div style={heroRing}>
        <OperationalToolbarSelect defaultValue="active">
          <option value="all">الكل</option>
          <option value="active">نشط</option>
          <option value="done">مكتمل</option>
        </OperationalToolbarSelect>
      </div>
      <OperationalToolbarPrimaryButton>طلب جديد</OperationalToolbarPrimaryButton>
    </div>
  );
}
