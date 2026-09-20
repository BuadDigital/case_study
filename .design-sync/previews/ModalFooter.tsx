import {
  Button,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@platform/ui-kit";

export function TwoActions() {
  return (
    <ModalCard>
      <ModalHeader>
        <ModalTitle>تأكيد اعتماد الطلب</ModalTitle>
        <ModalClose aria-label="إغلاق">×</ModalClose>
      </ModalHeader>
      <ModalBody>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
          هل تريد اعتماد هذا الطلب وإرساله إلى الأخصائي المعتمد؟
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" size="sm">
          إلغاء
        </Button>
        <Button variant="primary" size="sm">
          اعتماد
        </Button>
      </ModalFooter>
    </ModalCard>
  );
}

export function ThreeActions() {
  return (
    <ModalCard>
      <ModalHeader>
        <ModalTitle>مراجعة مستند الصك</ModalTitle>
        <ModalClose aria-label="إغلاق">×</ModalClose>
      </ModalHeader>
      <ModalBody>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
          اختر الإجراء المناسب لهذا المستند قبل ترحيل الطلب إلى مرحلة
          المساحة الهندسية.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="dangerOutline" size="sm">
          رفض
        </Button>
        <Button variant="outline" size="sm">
          طلب تعديل
        </Button>
        <Button variant="primary" size="sm">
          قبول
        </Button>
      </ModalFooter>
    </ModalCard>
  );
}
