"use client";

import { useState } from "react";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import {
  Badge,
  Button,
  Note,
  StatCard,
  StatGrid,
  StatLabel,
  StatSkeleton,
  StatValue,
  SubpageHeader,
  SubpagePanel,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from "@platform/design-system";
import { markPropertyKeyReceived } from "../lib/keys-api";
import {
  useInvalidatePropertyKeys,
  usePropertyKeysQuery,
} from "../query/keys-queries";

export function KeysView() {
  const { showToast } = useToast();
  const { role } = usePrototype();
  const viewOnly = !isSuperAdmin(role) && role === "general-manager";
  const { data: kp = [], isPending } = usePropertyKeysQuery();
  const invalidate = useInvalidatePropertyKeys();
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const received = kp.filter((p) => p.status === "done").length;
  const ready = !isPending;

  async function handleReceive(id: string) {
    setReceivingId(id);
    const updated = await markPropertyKeyReceived(id);
    setReceivingId(null);
    if (updated) {
      invalidate();
      showToast("تم تسجيل استلام المفتاح.", "success");
    } else {
      showToast("تعذّر تسجيل الاستلام.", "error");
    }
  }

  const statCards = ready
    ? [
        <StatCard key="total" accent="blue">
          <StatLabel>إجمالي المفاتيح</StatLabel>
          <StatValue value={kp.length} countUp />
        </StatCard>,
        <StatCard key="received" accent="green">
          <StatLabel>مستلمة</StatLabel>
          <StatValue value={received} countUp />
        </StatCard>,
        <StatCard key="pending" accent="warn">
          <StatLabel>بانتظار الاستلام</StatLabel>
          <StatValue value={Math.max(0, kp.length - received)} countUp />
        </StatCard>,
        <StatCard key="delegates">
          <StatLabel>مندوبو المحكمة</StatLabel>
          <StatValue value={2} />
        </StatCard>,
      ]
    : Array.from({ length: 4 }, (_, index) => (
        <StatCard key={index} accent="gray">
          <StatSkeleton />
        </StatCard>
      ));

  return (
    <>
      <StatGrid>{statCards}</StatGrid>
      <Note tone="warn" className="mb-4">
        مندوبا المحكمة المعتمدان: فراس كمرين — خالد الشريف
      </Note>
      <SubpagePanel>
        <SubpageHeader title="العقارات التي تحتاج مفاتيح" />
        <Table pending={!ready}>
          <THead>
            <Tr hoverable={false}>
              <Th>رقم العقار</Th>
              <Th>PO</Th>
              <Th>المنطقة</Th>
              <Th>المحكمة</Th>
              <Th>حالة المفتاح</Th>
              <Th>المندوب</Th>
              <Th>إجراء</Th>
            </Tr>
          </THead>
          <TBody>
            {!ready ? (
              <SkeletonTableRows rows={5} cols={7} />
            ) : (
              kp.map((p) => (
              <Tr key={p.id} hoverable={false}>
                <Td className="text-[11px] font-semibold text-primary-light">
                  {p.idProp}
                </Td>
                <Td className="text-[11px] text-primary-light">{p.po}</Td>
                <Td>{p.area}</Td>
                <Td>محكمة {p.area}</Td>
                <Td>
                  {p.status === "done" ? (
                    <Badge tone="success" className="rounded-[20px] px-2.5 py-0.5 text-[11px] font-normal">
                      مستلم
                    </Badge>
                  ) : (
                    <Badge tone="warning" className="rounded-[20px] px-2.5 py-0.5 text-[11px] font-normal">
                      بانتظار الاستلام
                    </Badge>
                  )}
                </Td>
                <Td>فراس كمرين</Td>
                <Td>
                  {p.status === "done" || viewOnly ? (
                    "—"
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      loading={receivingId === p.id}
                      disabled={receivingId !== null}
                      onClick={() => void handleReceive(p.id)}
                    >
                      تسجيل الاستلام
                    </Button>
                  )}
                </Td>
              </Tr>
            ))
            )}
          </TBody>
        </Table>
      </SubpagePanel>
    </>
  );
}
