import {
  KpiAlertIcon,
  KpiCheckIcon,
  KpiClipboardIcon,
  KpiClockIcon,
  MobileKpiStatCards,
} from "@platform/ui-kit";

export function Default() {
  return (
    <div style={{ maxWidth: 380 }}>
      <MobileKpiStatCards
        items={[
          {
            key: "active",
            label: "عدد الطلبات النشطة",
            sub: "قيد التنفيذ حاليًا",
            value: "44",
            icon: <KpiClipboardIcon />,
            iconClass: "bg-gold-soft text-gold-d",
            tone: "gold",
            valueClass: "!text-gold-d",
          },
          {
            key: "completed-value",
            label: "قيمة التقييمات المكتملة",
            sub: "خلال الشهر الحالي",
            value: "٢٫٤م ر.س",
            icon: <KpiCheckIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-success-text",
            tone: "ink",
            valueClass: "!text-success-text",
          },
          {
            key: "avg-time",
            label: "متوسط زمن الإنجاز",
            sub: "من الاستلام حتى الإصدار",
            value: "٣ أيام",
            icon: <KpiClockIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#b8791a]",
            tone: "ink",
          },
          {
            key: "stuck",
            label: "طلبات متعذرة",
            sub: "تحتاج معالجة فورية",
            value: "٢",
            icon: <KpiAlertIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red",
            tone: "red",
            valueClass: "!text-red",
          },
        ]}
      />
    </div>
  );
}
