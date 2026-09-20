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
  { po: "PO-2026-0091", owner: "بدر الحارثي", status: "مكتمل" as const },
  { po: "PO-2026-0092", owner: "أمل القرشي", status: "قيد المراجعة" as const },
  { po: "PO-2026-0093", owner: "سلطان العمري", status: "متعذر" as const },
];

const TONE: Record<string, "success" | "warning" | "danger"> = {
  "مكتمل": "success",
  "قيد المراجعة": "warning",
  "متعذر": "danger",
};

/** Compact ⋮ actions body cell — the row-level menu trigger, focus of this preview. */
export function Default() {
  return (
    <Table framed>
      <THead>
        <Tr hoverable={false}>
          <Th>رقم الطلب</Th>
          <Th>المالك</Th>
          <Th>الحالة</Th>
          <ThAction>⋮</ThAction>
        </Tr>
      </THead>
      <TBody>
        {ROWS.map((r) => (
          <Tr key={r.po}>
            <TdLtr>{r.po}</TdLtr>
            <Td>{r.owner}</Td>
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
