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
        <ModalTitle>تفاصيل طلب التقييم</ModalTitle>
        <ModalClose aria-label="إغلاق">×</ModalClose>
      </ModalHeader>
      <ModalBody>
        <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-3)" }}>رقم الطلب</span>
            <span style={{ color: "var(--text)" }}>PO-4471</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-3)" }}>رقم الصك</span>
            <span style={{ color: "var(--text)" }}>88120044991</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-3)" }}>الأخصائي المكلف</span>
            <span style={{ color: "var(--text)" }}>سارة القحطاني</span>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" size="sm">
          إغلاق
        </Button>
      </ModalFooter>
    </ModalCard>
  );
}

export function ScrollableList() {
  const specialists = [
    "سارة القحطاني — معاينة ميدانية",
    "خالد العتيبي — مساحة هندسية",
    "أحمد الشهري — تقييم عقاري",
    "منى الدوسري — مراجعة مستندات",
    "فهد الحربي — اعتماد نهائي",
  ];
  return (
    <ModalCard>
      <ModalHeader>
        <ModalTitle>اختيار الأخصائي المناسب</ModalTitle>
        <ModalClose aria-label="إغلاق">×</ModalClose>
      </ModalHeader>
      <ModalBody style={{ maxHeight: 220 }}>
        <div style={{ display: "grid", gap: 6 }}>
          {specialists.map((name) => (
            <div
              key={name}
              style={{
                borderRadius: 8,
                border: "1px solid var(--border)",
                padding: "8px 10px",
                fontSize: 13,
                color: "var(--text)",
              }}
            >
              {name}
            </div>
          ))}
        </div>
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
