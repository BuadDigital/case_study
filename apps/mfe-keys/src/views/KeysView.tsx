"use client";

import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import {
  Badge,
  Button,
  Note,
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
import { markPropertyKeyReceived } from "../lib/keys-api";
import {
  useInvalidatePropertyKeys,
  usePropertyKeysQuery,
} from "../query/keys-queries";

export function KeysView() {
  const { role } = usePrototype();
  const viewOnly = !isSuperAdmin(role) && role === "general-manager";
  const { data: kp = [] } = usePropertyKeysQuery();
  const invalidate = useInvalidatePropertyKeys();
  const received = kp.filter((p) => p.status === "done").length;

  async function handleReceive(id: string) {
    const updated = await markPropertyKeyReceived(id);
    if (updated) invalidate();
  }

  return (
    <>
      <StatGrid>
        <StatCard accent="blue">
          <StatLabel>إجمالي المفاتيح</StatLabel>
          <StatValue value={kp.length} />
        </StatCard>
        <StatCard accent="green">
          <StatLabel>مستلمة</StatLabel>
          <StatValue value={received} />
        </StatCard>
        <StatCard accent="warn">
          <StatLabel>بانتظار الاستلام</StatLabel>
          <StatValue value={Math.max(0, kp.length - received)} />
        </StatCard>
        <StatCard>
          <StatLabel>مندوبو المحكمة</StatLabel>
          <StatValue value={2} />
        </StatCard>
      </StatGrid>
      <Note tone="warn" className="mb-4">
        مندوبا المحكمة المعتمدان: فراس كمرين — خالد الشريف
      </Note>
      <SubpagePanel>
        <SubpageHeader title="العقارات التي تحتاج مفاتيح" />
        <Table>
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
            {kp.map((p) => (
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
                      onClick={() => void handleReceive(p.id)}
                    >
                      تسجيل الاستلام
                    </Button>
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
