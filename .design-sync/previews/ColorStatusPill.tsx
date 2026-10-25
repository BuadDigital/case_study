import { ColorStatusPill } from "@platform/ui-kit";

/** `StatusPill` tinted by one CSS color. */
export function Default() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <ColorStatusPill label="مستلم" color="#3f8f5f" />
      <ColorStatusPill label="بانتظار التسليم" color="var(--gold)" />
      <ColorStatusPill label="مفقود" color="var(--red)" />
    </div>
  );
}
