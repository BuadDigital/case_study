"use client";

import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { StatusBadge, Button, Note, ReportPageBody, StatCard, StatGrid, StatLabel, StatSkeleton, StatValue, SubpageHeader, SubpagePanel, SkeletonTableRows, Table, TBody, Td, Th, THead, Tr } from "@platform/design-system";
import type { RoleId } from "@platform/types";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import { useValuationRequestsQuery } from "../query/valuation-queries";

function isValuationMgr(role: RoleId) {
  return (
    isSuperAdmin(role) ||
    role === "general-manager" ||
    role === "valuation-coordinator"
  );
}

export function ValuationRequestsView() {
  const { role } = usePrototype();
  const mgr = isValuationMgr(role);
  const isApp = role === "real-estate-appraiser";
  const { data: vr = [], isPending } = useValuationRequestsQuery();
  const done = vr.filter((v) => v.status === "done").length;
  const prog = vr.filter((v) => v.status === "progress").length;
  const ready = !isPending;

  const statCards = ready
    ? [
        <StatCard key="active" accent="blue">
          <StatLabel>طلبات نشطة</StatLabel>
          <StatValue value={vr.length} countUp />
        </StatCard>,
        <StatCard key="done" accent="green">
          <StatLabel>مكتملة</StatLabel>
          <StatValue value={done} countUp />
        </StatCard>,
        <StatCard key="prog" accent="warn">
          <StatLabel>قيد التنفيذ</StatLabel>
          <StatValue value={prog} countUp />
        </StatCard>,
        <StatCard key="appraisers">
          <StatLabel>مقيمون متاحون</StatLabel>
          <StatValue value={2} />
        </StatCard>,
      ]
    : Array.from({ length: 4 }, (_, index) => (
        <StatCard key={index} accent="gray">
          <StatSkeleton />
        </StatCard>
      ));

  return (
    <ReportPageBody>
      <StatGrid>{statCards}</StatGrid>
      <Note tone="info">
        هذه الطلبات واردة من قسم دراسة الحالة — يتولى منسق التقييم توزيعها على المقيمين المؤهلين
      </Note>
      <SubpagePanel>
        <SubpageHeader title="طلبات التقييم الواردة من دراسة الحالة" />
        <Table pending={!ready}>
          <THead>
            <Tr hoverable={false}>
              <Th>رقم الطلب</Th>
              <Th>العقار</Th>
              <Th>المنطقة</Th>
              <Th>النوع</Th>
              <Th>المقيم المُسند</Th>
              <Th>الحالة</Th>
              <Th>التاريخ</Th>
              <Th>إجراء</Th>
            </Tr>
          </THead>
          <TBody>
            {!ready ? (
              <SkeletonTableRows rows={5} cols={8} />
            ) : (
              vr.map((v) => (
              <Tr key={v.id} hoverable={false}>
                <Td className="text-[11px] font-semibold text-primary-light">{v.id}</Td>
                <Td className="text-[11px] text-primary-light">{v.propId}</Td>
                <Td>{v.area}</Td>
                <Td>{v.type}</Td>
                <Td className="text-[11px]">{v.appraiser}</Td>
                <Td>
                  <StatusBadge status={v.status} />
                </Td>
                <Td className="text-[11px] text-text-3">{v.date}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {isApp && v.status === "progress" ? (
                      <>
                        <Button size="sm" variant="accent">
                          رفع التقرير
                        </Button>
                        <Button size="sm" variant="danger">
                          تعذّر
                        </Button>
                      </>
                    ) : null}
                    {mgr && v.status === "progress" ? (
                      <Button size="sm">عرض</Button>
                    ) : null}
                  </div>
                </Td>
              </Tr>
            ))
            )}
          </TBody>
        </Table>
      </SubpagePanel>
    </ReportPageBody>
  );
}
