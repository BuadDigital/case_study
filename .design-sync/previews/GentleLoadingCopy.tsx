import { GentleLoadingCopy } from "@platform/ui-kit";

/**
 * Only delays copy matching the «جاري …» loading-text pattern; the delay
 * (~300ms, see useDeferredVisible) is comfortably cleared by the capture
 * pipeline's network-idle + font/image settle wait before the screenshot.
 */
export function LoadingCopy() {
  return (
    <p style={{ margin: 0, fontSize: 13, color: "var(--text-3)" }}>
      <GentleLoadingCopy>جاري تحميل بيانات الطلب…</GentleLoadingCopy>
    </p>
  );
}

/** Non-loading copy renders immediately — no delay applies. */
export function OrdinaryCopy() {
  return (
    <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
      <GentleLoadingCopy>لا توجد طلبات حالياً</GentleLoadingCopy>
    </p>
  );
}
