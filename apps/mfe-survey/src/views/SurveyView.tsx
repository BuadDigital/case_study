"use client";

import {
  Badge,
  EmptyState,
  OperationalPanel,
  PageShell,
  StatCard,
  StatGrid,
  StatLabel,
  StatSkeleton,
  StatValue,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@platform/design-system";
import {
  useSurveyOfficesQuery,
  useSurveyRequestStatsQuery,
} from "../query/survey-queries";

export function SurveyView() {
  const { data: offices = [], isPending: officesPending } = useSurveyOfficesQuery();
  const { data: stats, isPending: statsPending } = useSurveyRequestStatsQuery();
  const ready = !officesPending && !statsPending;

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1">
      <StatGrid cols={4}>
        {ready ? (
          <>
            <StatCard accent="blue">
              <StatLabel>إجمالي طلبات الرفع</StatLabel>
              <StatValue value={stats?.total ?? 0} countUp />
            </StatCard>
            <StatCard accent="green">
              <StatLabel>مكتملة</StatLabel>
              <StatValue value={stats?.completed ?? 0} countUp />
            </StatCard>
            <StatCard accent="warn">
              <StatLabel>قيد التنفيذ</StatLabel>
              <StatValue value={stats?.inProgress ?? 0} countUp />
            </StatCard>
            <StatCard accent="red">
              <StatLabel>لم تُسند</StatLabel>
              <StatValue value={stats?.unassigned ?? 0} countUp />
            </StatCard>
          </>
        ) : (
          Array.from({ length: 4 }, (_, index) => (
            <StatCard key={index} accent="gray">
              <StatSkeleton />
            </StatCard>
          ))
        )}
      </StatGrid>

      <OperationalPanel className="min-h-0 flex-1">
        <Table pending={!ready}>
          <THead>
            <Tr hoverable={false}>
              <Th>اسم المكتب</Th>
              <Th>نشطة</Th>
              <Th>مكتملة هذا الشهر</Th>
              <Th>متوسط الإنجاز</Th>
              <Th>آلية التعاقد</Th>
              <Th>الحالة</Th>
            </Tr>
          </THead>
          <TBody>
            {!ready ? (
              <SkeletonTableRows rows={4} cols={6} />
            ) : offices.length === 0 ? (
              <Tr hoverable={false}>
                <Td colSpan={6}>
                  <EmptyState line="لا توجد مكاتب مسجّلة" />
                </Td>
              </Tr>
            ) : (
              offices.map((row) => (
                <Tr key={row.id} hoverable={false}>
                  <Td className="font-medium">{row.name}</Td>
                  <Td>{row.active}</Td>
                  <Td>{row.doneMonth}</Td>
                  <Td>{row.avgDays}</Td>
                  <Td>
                    <Badge
                      tone="default"
                      className=""
                    >
                      {row.contract}
                    </Badge>
                  </Td>
                  <Td>
                    {row.statusBusy ? (
                      <Badge
                        tone="warning"
                        className=""
                      >
                        مشغول
                      </Badge>
                    ) : (
                      <Badge
                        tone="success"
                        className=""
                      >
                        نشط
                      </Badge>
                    )}
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </OperationalPanel>
    </PageShell>
  );
}
