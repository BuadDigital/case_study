Side sheet — a 380px panel sliding in from the start edge over a navy scrim, for advanced filters and any secondary form that must keep the list visible behind it. CSS pattern on `.ej-sheet`; contents are `FormField`s.

```html
<div class="ej-sheet-overlay"></div>
<aside class="ej-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-t">
  <header class="ej-sheet__header"><h2 id="sheet-t" class="ej-sheet__title">تصفية المعاملات</h2><button type="button" class="ej-sheet__close" aria-label="إغلاق">×</button></header>
  <div class="ej-sheet__body">
    <!-- FormField > Select / Input, FormRow for من/إلى -->
    <div class="ej-check-group"><span class="ej-check-group__label">الحالة</span><label class="ej-check"><input type="checkbox" checked> جديد</label>…</div>
  </div>
  <footer class="ej-sheet__footer"><!-- Button primary "تطبيق (2)" · Button "إلغاء" · Button ghost sm "مسح الكل" --></footer>
</aside>
```

Rules: one column of fields, date ranges in a `FormRow`; multi-choice status as `ej-check` boxes; the primary button says what it does and how many filters (`تطبيق (2)`), `مسح الكل` sits at the far end; Escape and the scrim close it without applying. Focus moves into the sheet on open and back to the `تصفية` button on close. Use a `Modal` instead when the user must decide before continuing; a popover is not used for filters.
