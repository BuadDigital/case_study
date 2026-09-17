import { PanelSkeleton } from "@platform/ui-kit";

/** Full panel / page loading block — centered brand card (gold spinner tile + hint). */
export function Default() {
  return (
    <div style={{ maxWidth: 480, border: "1px solid var(--border)", borderRadius: 12 }}>
      <PanelSkeleton />
    </div>
  );
}
