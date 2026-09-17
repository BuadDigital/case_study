import { ShowAllEye } from "@platform/ui-kit";

export function Open() {
  return (
    <div style={{ fontSize: 32, color: "var(--ink)", display: "inline-block" }}>
      <ShowAllEye open />
    </div>
  );
}

export function Closed() {
  return (
    <div style={{ fontSize: 32, color: "var(--ink)", display: "inline-block" }}>
      <ShowAllEye open={false} />
    </div>
  );
}
