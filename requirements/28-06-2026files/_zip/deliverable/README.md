# CaseStudyReportDocument

Component React لتقرير دراسة الحالة — إجادة المهنية للتقييم العقاري.

## الملفات

```
src/
└── components/
    └── CaseStudyReportDocument/
        ├── CaseStudyReportDocument.tsx       ← Component الرئيسي
        ├── CaseStudyReportDocument.css       ← Stylesheet كامل
        ├── CaseStudyReportDocument.example.tsx ← مثال استخدام
        └── index.ts                          ← barrel export
src/
└── assets/
    ├── ejadah-header.png      ← ← ← ضع الصورة هنا
    ├── ejadah-footer.png
    ├── ejadah-watermark.png   (اختياري)
    ├── ejadah-stamp.png
    └── ejadah-signature.png
```

## الاستخدام

```tsx
import CaseStudyReportDocument from '@/components/CaseStudyReportDocument';

<CaseStudyReportDocument
  meta={{ orderNumber, orderDate, deedNumber }}
  section1={{ answers: [...11 items], notes }}
  section2={{ answers: [...7 items],  notes }}
  section3={{ answers: [...9 items],  meterType, meterNumber, notes }}
  section4={{ answers: [...6 items],  ownershipFee, notes }}
  section5={{ answers: [...4 items],  subNotes }}
  approval={{ approverName, approvalDate }}
/>
```

## قيم الـ `answers`

| القيمة | المعنى |
|--------|--------|
| `true`  | العمود الأيسر محدد (نعم / فعال / يوجد / تم التطبيق) |
| `false` | العمود الأيمن محدد (لا / غير فعال / لا يوجد) |
| `null`  | لا ينطبق — كلا العمودين فارغ |

## الطباعة

```tsx
import { useReactToPrint } from 'react-to-print';

const ref = useRef<HTMLDivElement>(null);
const print = useReactToPrint({ content: () => ref.current });

<div ref={ref}>
  <CaseStudyReportDocument ... />
</div>
<button onClick={print}>طباعة</button>
```

## Assets

إذا لم تُوجد صورة في `assets/`، يظهر CSS placeholder تلقائياً.
بمجرد إضافة الصورة تُستبدل الـ placeholder.

## Design Tokens

| Token | HEX |
|-------|-----|
| `--navy`       | `#0F2A4E` |
| `--gold`       | `#A38F67` |
| `--border`     | `#C8C8C8` |
| `--yellow-bg`  | `#FFFBEB` |
| `--approval-bg`| `#F8F9FA` |
