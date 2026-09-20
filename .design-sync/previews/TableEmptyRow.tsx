import { Table, TBody, Th, THead, TableEmptyRow, Tr } from "@platform/ui-kit";

/** Full table shell with only the empty-state row — no matching orders. */
export function Default() {
  return (
    <Table framed>
      <THead>
        <Tr hoverable={false}>
          <Th>رقم الطلب</Th>
          <Th>المالك</Th>
          <Th>رقم الصك</Th>
          <Th>الحالة</Th>
        </Tr>
      </THead>
      <TBody>
        <TableEmptyRow colSpan={4}>لا توجد طلبات مطابقة لبحثك</TableEmptyRow>
      </TBody>
    </Table>
  );
}
