import { StatCard, StatGrid, StatLabel, StatValue } from "@platform/ui-kit";

export function Default() {
  return (
    <StatGrid cols={4}>
      <StatCard accent="blue">
        <StatLabel>عدد الطلبات النشطة</StatLabel>
        <StatValue value="44" />
      </StatCard>
      <StatCard accent="green">
        <StatLabel>قيمة التقييمات المكتملة</StatLabel>
        <StatValue value="2.4م ر.س" />
      </StatCard>
      <StatCard accent="amber">
        <StatLabel>متوسط زمن الإنجاز</StatLabel>
        <StatValue value="3 أيام" />
      </StatCard>
      <StatCard accent="red">
        <StatLabel>طلبات متعذرة</StatLabel>
        <StatValue value="2" />
      </StatCard>
    </StatGrid>
  );
}
