Bulk-action bar — replaces the filter bar while one or more rows are selected. CSS pattern on `.ej-bulkbar`; rows get a `ej-td--select` checkbox column.

```html
<div class="ej-bulkbar">
  <span class="ej-bulkbar__count"><span class="lat">2</span> معاملتان محددتان</span>
  <span class="ej-bulkbar__sep"></span>
  <button type="button" class="ej-bulkbar__btn">إسناد إلى…</button>
  <button type="button" class="ej-bulkbar__btn">تغيير الحالة</button>
  <button type="button" class="ej-bulkbar__btn">تصدير</button>
  <button type="button" class="ej-bulkbar__close" aria-label="إلغاء التحديد">×</button>
</div>
```

Rules: navy ground so the mode is unmistakable; count first; 2–4 actions, destructive ones last and confirmed in a `Modal`; `×` (or Escape) clears the selection and brings the filter bar back. Selected rows carry `ej-tr--selected`. Header checkbox selects the visible page only.
