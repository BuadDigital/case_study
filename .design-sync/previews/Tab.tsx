import { Tab, TabBar, TabPanel } from "@platform/ui-kit";

export function Default() {
  return (
    <div
      style={{
        maxWidth: 480,
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
        background: "var(--surface)",
      }}
    >
      <TabBar>
        <Tab active>بيانات الصك</Tab>
        <Tab>المستندات</Tab>
        <Tab>الجدول الزمني</Tab>
      </TabBar>
      <TabPanel>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
          رقم الصك 88120044991 — صادر بتاريخ 1445/03/12هـ، فعّال وغير موقوف.
        </p>
      </TabPanel>
    </div>
  );
}

export function DocumentsActive() {
  return (
    <div
      style={{
        maxWidth: 480,
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
        background: "var(--surface)",
      }}
    >
      <TabBar>
        <Tab>بيانات الصك</Tab>
        <Tab active>المستندات</Tab>
        <Tab>الجدول الزمني</Tab>
      </TabBar>
      <TabPanel>
        <ul
          style={{
            margin: 0,
            paddingInlineStart: 18,
            fontSize: 13,
            color: "var(--text-2)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <li>صورة الصك — مرفوعة</li>
          <li>كروكي الموقع — مرفوع</li>
          <li>رخصة البناء — بانتظار الرفع</li>
        </ul>
      </TabPanel>
    </div>
  );
}
