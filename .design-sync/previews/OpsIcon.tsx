import { OpsIcon } from "@platform/ui-kit";

const PATHS = {
  plus: "M12 5v14M5 12h14",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  check: "M20 6 9 17l-5-5",
};

export function Default() {
  return (
    <div style={{ display: "flex", gap: 16, color: "var(--heading)" }}>
      <OpsIcon path={PATHS.plus} />
      <OpsIcon path={PATHS.grid} />
      <OpsIcon path={PATHS.check} size={18} />
    </div>
  );
}
