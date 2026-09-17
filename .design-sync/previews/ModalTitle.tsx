import {
  Button,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@platform/ui-kit";

export function Short() {
  return (
    <ModalCard>
      <ModalHeader>
        <ModalTitle>حذف الحالة</ModalTitle>
        <ModalClose aria-label="إغلاق">×</ModalClose>
      </ModalHeader>
      <ModalBody>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
          سيتم حذف حالة الأخصائي "أحمد الشهري" نهائيًا من قائمة الحالات
          النشطة. لا يمكن التراجع عن هذا الإجراء.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" size="sm">
          إلغاء
        </Button>
        <Button variant="danger" size="sm">
          حذف
        </Button>
      </ModalFooter>
    </ModalCard>
  );
}

export function LongWrapping() {
  return (
    <ModalCard>
      <ModalHeader>
        <ModalTitle>
          تأكيد ترحيل تقرير المعاينة الميدانية والمساحة الهندسية إلى ملف
          التقييم النهائي
        </ModalTitle>
        <ModalClose aria-label="إغلاق">×</ModalClose>
      </ModalHeader>
      <ModalBody>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
          تحقق من مطابقة جميع الحقول المطلوبة قبل الترحيل النهائي إلى ملف
          التقييم.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" size="sm">
          ترحيل
        </Button>
      </ModalFooter>
    </ModalCard>
  );
}
