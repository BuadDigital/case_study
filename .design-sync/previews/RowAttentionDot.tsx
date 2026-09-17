import { RowAttentionDot, Table, TBody, Td, Th, THead, Tr } from "@platform/ui-kit";

/** Inline next to a queue row's label, as it appears in a table cell. */
export function InQueueRow() {
  return (
    <Table framed>
      <THead>
        <Tr hoverable={false}>
          <Th>رقم الطلب</Th>
          <Th>المالك</Th>
          <Th>آخر تحديث</Th>
        </Tr>
      </THead>
      <TBody>
        <Tr>
          <Td>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <RowAttentionDot />
              PO-2026-0005
            </span>
          </Td>
          <Td>محمد العتيبي</Td>
          <Td>قبل 4 دقائق</Td>
        </Tr>
        <Tr>
          <Td>PO-2026-0011</Td>
          <Td>سارة القرني</Td>
          <Td>أمس</Td>
        </Tr>
      </TBody>
    </Table>
  );
}
