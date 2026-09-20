Table footer — total, visible range and page-of-N with a typeable page field; a CSS pattern on `.ej-table-foot`, placed directly under a `Table` inside the same panel.

```html
<div class="ej-table-foot">
  <span><span class="ej-table-foot__total">2,480</span> معاملة · <span class="lat">1–25</span></span>
  <span class="ej-table-foot__spacer"></span>
  <span class="ej-table-foot__page">صفحة <input class="ej-table-foot__input" type="text" inputmode="numeric" value="1" aria-label="رقم الصفحة"> من <span class="lat">100</span></span>
  <span class="ej-table-foot__nav">
    <button type="button" class="ej-table-foot__btn" aria-label="السابق" disabled>‹</button>
    <button type="button" class="ej-table-foot__btn" aria-label="التالي">›</button>
  </span>
</div>
```

Parts: total in `heading` weight 500 first (the number the manager reads), then the range; page field (Enter jumps); previous/next as stroked chevrons (in RTL the "previous" chevron points right). Latin digits, `tabular-nums`. No page-number list and no page-size select by default — add a `ToolbarSelect` for 25/50/100 only on archives. Do not use "load more" on internal queues.
