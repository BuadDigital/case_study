import { StatCard, StatGrid, StatLabel, StatValue } from "@platform/ui-kit";

export function Default() {
  return (
    <StatGrid cols={3}>
      <StatCard accent="blue">
        <StatLabel>عدد الطلبات النشطة</StatLabel>
        <StatValue value="44" />
      </StatCard>
      <StatCard accent="green">
        <StatLabel>قيمة التقييمات المكتملة</StatLabel>
        <StatValue value="٢٫٤م ر.س" />
      </StatCard>
      <StatCard accent="amber">
        <StatLabel>متوسط زمن الإنجاز</StatLabel>
        <StatValue value="٣ أيام" />
      </StatCard>
    </StatGrid>
  );
}
