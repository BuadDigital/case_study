# قضايا تدقيق نظام تصميم إجادة — للمستودع `BuadDigital/case_study`

المسار المعني: `packages/design-system/src` (tokens.css + components). كل قضية جاهزة للنسخ إلى GitHub Issues. الترتيب حسب الأولوية. بعد إغلاق أي دفعة: `/design-sync` لإعادة مزامنة نظام التصميم.

---

## #1 · إزالة الألوان الحرفية من InfathField / Toast / Note / Button danger
**Labels:** `design-system` `dark-mode` `P1`

**المشكلة:** 14 قيمة hex و10 قيم rgba مكتوبة مباشرة خارج الرموز، فلا تتغيّر في الوضع الداكن وتخالف الهوية.

| الملف | القيمة الحالية | الرمز البديل |
|---|---|---|
| `forms/InfathField.jsx` L13 | `#6b7280` (caret) | `var(--text-2)` |
| `forms/InfathField.jsx` L22 | `#1f2937` (section title) | `var(--heading)` |
| `tokens.css` `.ej-infath` | `#d1d5db`, `#94a3b8` | `var(--border-md)`, `var(--text-3)` |
| `tokens.css` `.ej-infath__label` | `#4b5563`, `#e11d48` (required *) | `var(--text-2)`, `var(--red-text)` |
| `tokens.css` `.ej-infath__control` | `#111827` | `var(--text-1)` |
| `tokens.css` `.ej-infath--error` | `#f87171` | `var(--red)` |
| `feedback/Modal.jsx` Toast icons | `#8fd0a5`, `#f0a8a0` | رمزان جديدان `--on-ink-success`, `--on-ink-danger` |
| `tokens.css` `.ej-note--danger` | `#922b21` | `var(--red-text)` |
| `tokens.css` `.ej-note--warn` | `#784212` | `var(--amber-text)` |
| `tokens.css` `.ej-btn--danger` | `#f7ddd4` | `var(--red-light)` |
| `tokens.css` × 7 | `color:#fff` | رمز جديد `--on-ink` |

**معايير القبول:** `grep -E '#[0-9a-f]{3,8}' packages/design-system/src/components` يعيد صفر نتائج؛ حقول إنفاذ تُعرض صحيحة في `data-theme="dark"`.

---

## #2 · رفع كل مقاس خط دون 12px إلى الحد الأدنى
**Labels:** `design-system` `a11y` `P1`

**المشكلة:** الدليل يفرض 12px حدًا أدنى، والكود يستخدم 10–11px في: `.ej-stat__label`, `.ej-stat__sub`, `.ej-tab__count`, `.ej-label--field`, `.ej-nav-badge`, `.ej-nav-group`, `.ej-btn--sm`, `.ej-card__foot`, `.ej-table-hint`, `.ej-infath__label`؛ و`fontSize: 11` في `EmptyState`.

**المطلوب:** استبدالها بـ `var(--fs-hint)` (12px). إن ضاق `tab__count` أو `nav-badge` يُقلَّص padding لا الحجم.

**معايير القبول:** لا `font-size` أقل من 12px في `tokens.css` ولا `fontSize` أقل من 12 في `components/`.

---

## #3 · Modal: لوحة المفاتيح وحبس التركيز
**Labels:** `design-system` `a11y` `P1`

**المطلوب في `feedback/Modal.jsx`:**
- إغلاق بـ `Escape` (`keydown` على `document` أثناء `open`).
- حبس التركيز (focus trap) داخل `.ej-modal`؛ التركيز الأول على العنوان أو أول عنصر تفاعلي.
- إعادة التركيز إلى العنصر الذي فتح النافذة عند الإغلاق.
- `aria-labelledby` يشير إلى `h2.ej-modal__title`.
- منع تمرير الخلفية (`overflow:hidden` على `body`).

**معايير القبول:** Tab لا يخرج من النافذة؛ Escape يغلقها؛ قارئ الشاشة يعلن العنوان.

---

## #4 · Tabs: تنقّل بالأسهم وحالة focus-visible
**Labels:** `design-system` `a11y` `P1`

**المطلوب في `navigation/Tabs.jsx`:**
- `ArrowRight`/`ArrowLeft` (مقلوبة لـ RTL) + `Home`/`End` للتنقّل بين التبويبات، `tabIndex={-1}` لغير النشط (roving tabindex).
- `aria-controls` عند وجود لوحة مرتبطة.
- دعم `disabled`.
- إضافة `.ej-tab:focus-visible` و`.ej-btn:focus-visible` و`.ej-modal__close:focus-visible` في `tokens.css` بحلقة `gold` 3px (الأزرار الآن بلا مؤشر تركيز ظاهر).

---

## #5 · حسم ازدواجية الزر الأساسي
**Labels:** `design-system` `consistency` `P2`

**المشكلة:** `.ej-btn--primary` (12.5px، وزن 400، بلا ظل) و`.ot-primary` (13px، وزن 700، ظل، رفع −1px) — زران "أساسيان" بمظهرين.

**القرار المطلوب من التصميم:** إمّا اعتماد مظهر واحد، أو إبقاء الثاني كـ `variant="toolbarPrimary"` داخل `Button` وحذف `ToolbarPrimaryButton`.

---

## #6 · مقياس تباعد وحركة كرموز
**Labels:** `design-system` `tokens` `P2`

**المشكلة:** 9 قيم padding/gap متفرقة و9 مدد حركة بلا رمز.

**المطلوب في `tokens.css`:**
```css
--space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-6:24px;
--motion-fast:120ms; --motion-base:150ms; --motion-slow:280ms;
--ease-out:cubic-bezier(.22,1,.36,1);
```
ثم استبدال القيم الحرفية في المكوّنات. قيم 6/7/10/14px تُقرَّب إلى أقرب درجة (قرار تصميم — انظر #10).

---

## #7 · توحيد قيم الزوايا
**Labels:** `design-system` `tokens` `P2`

21 قيمة حرفية مقابل 7 استخدامات للرمز؛ تظهر 4px و10px غير معرّفتين. استبدال: `8px→var(--radius)`, `12px→var(--radius-lg)`, `6px→var(--radius-sm)`, و`4px/10px` تُقرَّب لأقرب رمز. الأشكال الدائرية (`9999px`) تبقى.

---

## #8 · توحيد البادئات والأسماء
**Labels:** `design-system` `consistency` `P3`

- `ot-*` → `ej-*` (`.ot-search`, `.ot-sel`, `.ot-primary`).
- خاصية الخطأ: `hasError` في Input/Select/Textarea مقابل `error` في InfathField → اسم واحد.
- الألوان الدلالية: اعتماد `success/warning/danger/info` فقط في أسماء الفئات؛ `teal/amber/red/blue` و`green/warn` في `StatCard`/`ProgressBar`/`Tab count` تُصبح أسماء مستعارة مؤقتة ثم تُحذف.

---

## #9 · Table: حالات ناقصة
**Labels:** `design-system` `component` `P3`

- حالة فارغة (تستخدم `EmptyState`) وحالة تحميل (`Skeleton` rows).
- `scope="col"` على `<th>`.
- خاصية `dense` للكثافة المريحة (`[data-density="comfortable"]` موجودة في الرموز ولا يستخدمها أحد).
- ترتيب الأعمدة اختياري (`sortable`).

---

## #10 · قرارات تصميم مطلوبة قبل التنفيذ (ليست قضية برمجية)
**Labels:** `design-decision`

1. مظهر الزر الأساسي الواحد (#5).
2. تقريب قيم التباعد 6/7/10/14 (#6).
3. هل يُحتفظ بـ `Toast` بلا زر إغلاق، أم يُضاف إغلاق وإجراء اختياري؟
4. هل تبقى `.ot-*` أسماء بديلة لدورة إصدار واحدة أم تُحذف مباشرة؟

---

**ترتيب التنفيذ المقترح:** #1 → #2 → #3 → #4 (أسبوع)، ثم #10 قرارات، ثم #5–#9.
