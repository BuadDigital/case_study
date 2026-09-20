import { DeedLabel } from "@platform/ui-kit";

export function DeedNumber() {
  return (
    <div dir="rtl" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
      <span>الصك:</span>
      <DeedLabel value="88120044991" />
    </div>
  );
}

export function EmptyDeed() {
  return (
    <div dir="rtl" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
      <span>الصك:</span>
      <DeedLabel value={null} />
    </div>
  );
}
