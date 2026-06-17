"use client";

import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import {
  Badge,
  Button,
  StatCard,
  StatGrid,
  StatLabel,
  StatValue,
  SubpageHeader,
  SubpagePanel,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@platform/design-system";
import { useSurveyOfficesQuery } from "../query/survey-queries";

export function SurveyView() {
  const { role } = usePrototype();
  const viewOnly = !isSuperAdmin(role) && role === "general-manager";
  const { data: offices = [] } = useSurveyOfficesQuery();

  return (
    <>
      <StatGrid>
        <StatCard accent="blue">
          <StatLabel>إجمالي طلبات الرفع</StatLabel>
          <StatValue value={43} />
        </StatCard>
        <StatCard accent="green">
          <StatLabel>مكتملة</StatLabel>
          <StatValue value={18} />
        </StatCard>
        <StatCard accent="warn">
          <StatLabel>قيد التنفيذ</StatLabel>
          <StatValue value={21} />
        </StatCard>
        <StatCard accent="red">
          <StatLabel>لم تُسند</StatLabel>
          <StatValue value={4} />
        </StatCard>
      </StatGrid>
      <SubpagePanel>
        <SubpageHeader title="المكاتب الهندسية المعتمدة">
          {!viewOnly ? (
            <Button size="sm" variant="primary">
              + إضافة مكتب
            </Button>
          ) : null}
        </SubpageHeader>
        <Table>
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
            {offices.map((row) => (
              <Tr key={row.name} hoverable={false}>
                <Td className="font-medium">{row.name}</Td>
                <Td>{row.active}</Td>
                <Td>{row.doneMonth}</Td>
                <Td>{row.avgDays}</Td>
                <Td>
                  <Badge tone="default" className="rounded-[20px] px-2.5 py-0.5 text-[11px] font-normal">
                    {row.contract}
                  </Badge>
                </Td>
                <Td>
                  {row.statusBusy ? (
                    <Badge tone="warning" className="rounded-[20px] px-2.5 py-0.5 text-[11px] font-normal">
                      مشغول
                    </Badge>
                  ) : (
                    <Badge tone="success" className="rounded-[20px] px-2.5 py-0.5 text-[11px] font-normal">
                      نشط
                    </Badge>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </SubpagePanel>
    </>
  );
}
