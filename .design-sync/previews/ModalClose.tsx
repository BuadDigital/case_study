import {
  Button,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@platform/ui-kit";

export function Default() {
  return (
    <ModalCard>
      <ModalHeader>
        <ModalTitle>رفض مستند الصك</ModalTitle>
        <ModalClose aria-label="إغلاق">×</ModalClose>
      </ModalHeader>
      <ModalBody>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
          يمكنك إغلاق هذه النافذة والعودة لاحقًا لاستكمال رفع مستندات الصك
          الصحيحة دون فقدان بيانات الطلب.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" size="sm">
          إلغاء
        </Button>
        <Button variant="primary" size="sm">
          حفظ ومتابعة لاحقًا
        </Button>
      </ModalFooter>
    </ModalCard>
  );
}

export function OpsStyle() {
  return (
    <ModalCard>
      <ModalHeader>
        <ModalTitle>إنشاء مهمة معاينة</ModalTitle>
        <ModalClose
          aria-label="إغلاق"
          style={{ background: "var(--surface-2)" }}
        >
          ×
        </ModalClose>
      </ModalHeader>
      <ModalBody>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
          حدد المعاين المسؤول والموعد المفضل لزيارة العقار قبل حفظ المهمة.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" size="sm">
          إلغاء
        </Button>
        <Button variant="primary" size="sm">
          حفظ المهمة
        </Button>
      </ModalFooter>
    </ModalCard>
  );
}
