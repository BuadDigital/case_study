import { SkeletonTableRows, Table, TBody, Th, THead, Tr } from "@platform/ui-kit";

/** Loading rows inside a real table shell — 4 rows matching a 4-column header. */
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
        <SkeletonTableRows rows={4} cols={4} />
      </TBody>
    </Table>
  );
}
