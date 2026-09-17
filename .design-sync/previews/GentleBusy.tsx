import { GentleBusy } from "@platform/ui-kit";

/**
 * Delays showing `children` until `pending` has stayed true for ~300ms
 * (see useDeferredVisible). The capture pipeline navigates + waits for
 * network-idle + font/image decode before screenshotting, which comfortably
 * clears the 300ms delay, so `pending` renders its real content here.
 */
export function Pending() {
  return (
    <div style={{ maxWidth: 320, border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
      <GentleBusy pending>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-3)" }}>
          <span
            className="inline-block size-3 shrink-0 rounded-full border-2 border-current border-e-transparent motion-safe:animate-spin"
            aria-hidden
          />
          <span style={{ fontSize: 13 }}>جاري تحميل بيانات الصك…</span>
        </div>
      </GentleBusy>
    </div>
  );
}

/** Not pending — children render immediately, no delay applies. */
export function Settled() {
  return (
    <div style={{ maxWidth: 320, border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
      <GentleBusy pending={false}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
          رقم الصك 88120044991 — فعّال وغير موقوف.
        </p>
      </GentleBusy>
    </div>
  );
}
