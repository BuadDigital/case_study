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
        <ModalTitle>طلب معاينة ميدانية جديد</ModalTitle>
        <ModalClose aria-label="إغلاق">×</ModalClose>
      </ModalHeader>
      <ModalBody>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
          سيتم تعيين المعاين "خالد العتيبي" لزيارة العقار خلال يومي عمل من
          تاريخ اعتماد الطلب.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" size="sm">
          إلغاء
        </Button>
        <Button variant="primary" size="sm">
          تعيين
        </Button>
      </ModalFooter>
    </ModalCard>
  );
}

export function RejectedDocument() {
  return (
    <ModalCard>
      <ModalHeader>
        <ModalTitle>رفض مستند الملكية</ModalTitle>
        <ModalClose aria-label="إغلاق">×</ModalClose>
      </ModalHeader>
      <ModalBody>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
          صورة الصك المرفوعة غير واضحة. يرجى إعادة رفع نسخة مقروءة من كتابة
          العدل قبل استكمال إجراءات التقييم.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="dangerOutline" size="sm">
          إغلاق
        </Button>
      </ModalFooter>
    </ModalCard>
  );
}
