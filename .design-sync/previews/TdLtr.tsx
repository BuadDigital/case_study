import {
  Badge,
  Table,
  TBody,
  Td,
  TdAction,
  TdLtr,
  Th,
  ThAction,
  THead,
  Tr,
} from "@platform/ui-kit";

const ROWS = [
  { po: "PO-2026-0071", owner: "خالد الفيفي", deed: "88120044991", amount: "SAR 452,000", status: "مكتمل" as const },
  { po: "PO-2026-0072", owner: "دلال الرشيدي", deed: "10203040506", amount: "SAR 1,180,500", status: "قيد المراجعة" as const },
  { po: "PO-2026-0073", owner: "وليد باكر", deed: "55009911223", amount: "SAR 690,250", status: "متعذر" as const },
];

const TONE: Record<string, "success" | "warning" | "danger"> = {
  "مكتمل": "success",
  "قيد المراجعة": "warning",
  "متعذر": "danger",
};

/** LTR value cells: PO number, deed number, SAR amount stay LTR-isolated inside RTL rows. */
export function Default() {
  return (
    <Table framed>
      <THead>
        <Tr hoverable={false}>
          <Th>رقم الطلب</Th>
          <Th>المالك</Th>
          <Th>رقم الصك</Th>
          <Th>المبلغ</Th>
          <Th>الحالة</Th>
        </Tr>
      </THead>
      <TBody>
        {ROWS.map((r) => (
          <Tr key={r.po}>
            <TdLtr>{r.po}</TdLtr>
            <Td>{r.owner}</Td>
            <TdLtr>{r.deed}</TdLtr>
            <TdLtr>{r.amount}</TdLtr>
            <Td>
              <Badge tone={TONE[r.status]}>{r.status}</Badge>
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
