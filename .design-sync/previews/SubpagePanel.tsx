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
        <SubpageHeader title="تفاصيل العقار" />
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
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                color: "var(--text-2)",
                marginBottom: 4,
              }}
            >
              <span>نسبة اكتمال المعاينة الميدانية</span>
              <span>60%</span>
            </div>
            <ProgressBar value={60} tone="primary" />
          </div>
        </div>
      </SubpagePanel>
    </div>
  );
}
