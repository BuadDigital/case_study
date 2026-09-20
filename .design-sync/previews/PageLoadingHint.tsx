import { PageLoadingHint } from "@platform/ui-kit";

/** Spinner + label, as used on settings-style pages while data loads. */
export function Default() {
  return (
    <div style={{ maxWidth: 420, border: "1px solid var(--border)", borderRadius: 12 }}>
      <PageLoadingHint />
    </div>
  );
}

/** Custom label — a screen-specific loading message. */
export function CustomLabel() {
  return (
    <div style={{ maxWidth: 420, border: "1px solid var(--border)", borderRadius: 12 }}>
      <PageLoadingHint label="جاري تحميل إعدادات المؤسسة…" />
    </div>
  );
}
