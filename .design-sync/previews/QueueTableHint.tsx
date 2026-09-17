import {
  QueueTableHint,
  Table,
  TableFrame,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@platform/ui-kit";

export function Default() {
  return (
    <TableFrame style={{ border: "1px solid var(--border)", borderRadius: 10 }}>
      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th>رقم أمر العمل</Th>
            <Th>العقار</Th>
            <Th>الحالة</Th>
          </Tr>
        </THead>
        <TBody>
          <Tr>
            <Td>40021</Td>
            <Td>فيلا سكنية — حي الملقا</Td>
            <Td>قيد المعاينة الميدانية</Td>
          </Tr>
          <Tr>
            <Td>40022</Td>
            <Td>أرض تجارية — حي العليا</Td>
            <Td>بانتظار المقيم</Td>
          </Tr>
        </TBody>
      </Table>
      <QueueTableHint>يعرض هذا الجدول آخر 50 معاملة — اضغط الصف لفتح دراسة الحالة.</QueueTableHint>
    </TableFrame>
  );
}
