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
  { po: "PO-2026-0051", owner: "سعود المالكي", deed: "56789012345", status: "مكتمل" as const },
  { po: "PO-2026-0052", owner: "ريم الشمري", deed: "67890123456", status: "قيد المراجعة" as const },
];

const TONE: Record<string, "success" | "warning" | "danger"> = {
  "مكتمل": "success",
  "قيد المراجعة": "warning",
};

/** Header cell — bold text, gold underline, start-aligned per RTL default. */
export function Default() {
  return (
    <Table framed>
      <THead>
        <Tr hoverable={false}>
          <Th>رقم الطلب</Th>
          <Th>المالك</Th>
          <Th>رقم الصك</Th>
          <Th>الحالة</Th>
          <ThAction>⋮</ThAction>
        </Tr>
      </THead>
      <TBody>
        {ROWS.map((r) => (
          <Tr key={r.po}>
            <TdLtr>{r.po}</TdLtr>
            <Td>{r.owner}</Td>
            <TdLtr>{r.deed}</TdLtr>
            <Td>
              <Badge tone={TONE[r.status]}>{r.status}</Badge>
            </Td>
            <TdAction>⋮</TdAction>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
