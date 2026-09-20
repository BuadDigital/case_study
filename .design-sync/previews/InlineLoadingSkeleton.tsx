import { InlineLoadingSkeleton } from "@platform/ui-kit";

/** Compact inline loading block — a side panel or tab waiting on data. */
export function Default() {
  return (
    <div style={{ maxWidth: 320, border: "1px solid var(--border)", borderRadius: 12 }}>
      <InlineLoadingSkeleton />
    </div>
  );
}
