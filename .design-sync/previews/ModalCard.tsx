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
        <ModalTitle>تأكيد اعتماد الصك</ModalTitle>
        <ModalClose aria-label="إغلاق">×</ModalClose>
      </ModalHeader>
      <ModalBody>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
          هل تريد اعتماد صك الملكية رقم 88120044991 وإرساله إلى فريق المساحة
          الهندسية لبدء إجراءات التقييم؟
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

export function Wide() {
  return (
    <ModalCard wide>
      <ModalHeader>
        <ModalTitle>تقرير المساحة الهندسية</ModalTitle>
        <ModalClose aria-label="إغلاق">×</ModalClose>
      </ModalHeader>
      <ModalBody>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
          راجع نتائج المساحة الهندسية للعقار قبل ترحيلها إلى ملف التقييم
          النهائي. تشمل المراجعة أبعاد القطعة، حدود الجيران، ومطابقة المخطط
          المساحي مع الصك الصادر من كتابة العدل.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" size="sm">
          تعديل
        </Button>
        <Button variant="primary" size="sm">
          ترحيل للتقييم
        </Button>
      </ModalFooter>
    </ModalCard>
  );
}
