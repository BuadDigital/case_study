import { ErrorBoundary } from "@platform/ui-kit";

/** Happy path — normal working children pass straight through. */
export function Default() {
  return (
    <ErrorBoundary>
      <div style={{ maxWidth: 380, fontSize: 13, color: "var(--text-2)" }}>
        <strong style={{ display: "block", marginBottom: 6, color: "var(--heading)" }}>
          بيانات الصك
        </strong>
        رقم الصك 88120044991 — صادر بتاريخ 1445/03/12هـ، فعّال وغير موقوف.
      </div>
    </ErrorBoundary>
  );
}

/** The fallback UI shown standalone (same markup ErrorBoundary renders on catch). */
export function FallbackShown() {
  return (
    <div style={{ maxWidth: 380 }} className="p-4">
      <div
        className="mb-3 rounded-[10px] border-r-[3px] border-solid px-3.5 py-3 text-[12.5px] leading-relaxed"
        style={{
          borderRightColor: "var(--danger)",
          background: "var(--danger-bg)",
          color: "#922b21",
        }}
      >
        حدث خطأ غير متوقع في هذه الشاشة.
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-3)" }}>
        تعذّر تحميل بيانات صك الملكية.
      </p>
      <button
        type="button"
        style={{
          background: "var(--primary)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "6px 14px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
