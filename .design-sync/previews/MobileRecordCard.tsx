import { Button, MobileRecordCard, StatusPill, finStatusStyle } from "@platform/ui-kit";

/** One table row re-laid out for a phone. */
export function Default() {
  return (
    <div style={{ maxWidth: 360 }}>
      <MobileRecordCard
        title="صك 611508007272"
        subtitle="الخرج — مشرف"
        status={<StatusPill label="قيد المراجعة" style={finStatusStyle("deferred")} />}
        tone="gold"
        fields={[
          { label: "أمر العمل", value: "PO-067355", ltr: true },
          { label: "النوع", value: "عمارة" },
          { label: "ملاحظات", value: "بانتظار مساحة الأرض", wide: true },
        ]}
        actions={
          <>
            <Button variant="ghost" size="sm">تفاصيل</Button>
            <Button variant="primary" size="sm">اعتماد</Button>
          </>
        }
      />
    </div>
  );
}
