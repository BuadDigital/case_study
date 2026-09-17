import { Spinner } from "@platform/ui-kit";

/** Spinner is a single fixed-size mark (size comes via className) — shown at a few sizes. */
export function Sizes() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, color: "var(--primary)" }}>
      <Spinner className="size-3" />
      <Spinner className="size-5" />
      <Spinner className="size-8 border-[3px]" />
    </div>
  );
}

/** Inline usage next to loading copy, as it appears in buttons/status rows. */
export function InlineWithLabel() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-3)" }}>
      <Spinner />
      <span style={{ fontSize: 13 }}>جاري الحفظ…</span>
    </div>
  );
}
