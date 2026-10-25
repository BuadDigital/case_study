import { useState } from "react";
import { MobileSectionPicker } from "@platform/ui-kit";

/** Up to 3 short sections: a full-width segmented control. */
export function Segmented() {
  const [active, setActive] = useState("dues");
  return (
    <div style={{ maxWidth: 360 }}>
      <MobileSectionPicker
        sections={[
          { id: "dues", label: "المستحقات", count: 4 },
          { id: "statements", label: "الكشوف", count: 2 },
          { id: "paid", label: "المدفوع" },
        ]}
        active={active}
        onChange={setActive}
      />
    </div>
  );
}

/** More sections: one button that opens a sheet listing them all. */
export function Sheet() {
  const [active, setActive] = useState("basic");
  return (
    <div style={{ maxWidth: 360 }}>
      <MobileSectionPicker
        title="القسم"
        sections={[
          { id: "basic", label: "البيانات الأساسية" },
          { id: "docs", label: "المستندات", count: 7 },
          { id: "photos", label: "الصور" },
          { id: "failures", label: "التعثرات", count: 1, warn: true },
        ]}
        active={active}
        onChange={setActive}
      />
    </div>
  );
}
