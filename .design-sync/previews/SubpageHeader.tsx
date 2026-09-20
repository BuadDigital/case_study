import { ProgressBar, SubpageHeader, SubpagePanel } from "@platform/ui-kit";

export function Default() {
  return (
    <div
      style={{
        display: "flex",
        height: 420,
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <SubpagePanel>
        <SubpageHeader title="تفاصيل العقار">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 999,
              padding: "3px 10px",
              fontSize: 12,
              fontWeight: 700,
              background: "color-mix(in srgb, var(--gold) 18%, transparent)",
              color: "color-mix(in srgb, var(--gold) 70%, #000)",
            }}
          >
            قيد المعاينة
          </span>
        </SubpageHeader>
        <div
          style={{
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
            عقار سكني — حي النرجس، الرياض. رقم الصك 88120044991، مساحة
            الأرض 625 م².
          </p>
          <ProgressBar value={60} tone="primary" />
        </div>
      </SubpagePanel>
    </div>
  );
}
