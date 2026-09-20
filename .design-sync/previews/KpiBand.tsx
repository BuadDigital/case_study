import {
  KpiAlertIcon,
  KpiBand,
  KpiCell,
  KpiCheckIcon,
  KpiClipboardIcon,
  KpiClockIcon,
} from "@platform/ui-kit";

export function Default() {
  return (
    <KpiBand>
      <KpiCell
        first
        icon={<KpiClipboardIcon />}
        iconClass="bg-gold-soft text-gold-d"
        label="عدد الطلبات النشطة"
        value="44"
        sub="قيد التنفيذ حاليًا"
        dot
      />
      <KpiCell
        icon={<KpiCheckIcon />}
        iconClass="bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-success-text"
        label="قيمة التقييمات المكتملة"
        value="٢٫٤م ر.س"
        valueClass="!text-success-text"
        sub="خلال الشهر الحالي"
      />
      <KpiCell
        icon={<KpiClockIcon />}
        iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#b8791a]"
        label="متوسط زمن الإنجاز"
        value="٣ أيام"
        sub="من الاستلام حتى الإصدار"
      />
      <KpiCell
        last
        icon={<KpiAlertIcon />}
        iconClass="bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red"
        label="طلبات متعذرة"
        value="٢"
        valueClass="!text-red"
        sub="تحتاج معالجة فورية"
      />
    </KpiBand>
  );
}
