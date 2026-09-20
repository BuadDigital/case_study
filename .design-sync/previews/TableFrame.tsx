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
  { po: "PO-2026-0005", owner: "محمد العتيبي", deed: "88120044991", status: "مكتمل" as const },
  { po: "PO-2026-0011", owner: "سارة القرني", deed: "10203040506", status: "قيد المراجعة" as const },
  { po: "PO-2026-0013", owner: "خالد الدوسري", deed: "55009911223", status: "متعذر" as const },
];

const TONE: Record<string, "success" | "warning" | "danger"> = {
  "مكتمل": "success",
  "قيد المراجعة": "warning",
  "متعذر": "danger",
};

/** Framed card chrome (border/shadow) wrapping a full realistic table. */
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
