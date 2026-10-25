import { MobileRecordCard, MobileRecordList } from "@platform/ui-kit";

export function Default() {
  return (
    <div style={{ maxWidth: 360 }}>
      <MobileRecordList>
        <MobileRecordCard title="صك 611508007272" subtitle="الخرج — مشرف" />
        <MobileRecordCard title="صك 310112003308" subtitle="جدة — السلامة" />
      </MobileRecordList>
    </div>
  );
}

export function Empty() {
  return (
    <div style={{ maxWidth: 360 }}>
      <MobileRecordList isEmpty empty="لا توجد عقارات بعد.">{null}</MobileRecordList>
    </div>
  );
}
