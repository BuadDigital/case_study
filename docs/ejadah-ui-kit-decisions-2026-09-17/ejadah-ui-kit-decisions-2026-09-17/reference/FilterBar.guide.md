Filter bar above a list — search, an advanced-filter button and a row of quick-filter chips with counts; the default toolbar of every queue. CSS pattern on `Toolbar` (`ej-toolbar ej-toolbar--stacked`).

```html
<div class="ej-toolbar ej-toolbar--stacked">
  <div class="ej-toolbar__row">
    <!-- ToolbarSearch -->
    <span style="flex-grow:1"></span>
    <button type="button" class="ej-filter-btn">تصفية <span class="ej-filter-btn__count">2</span></button>
    <!-- Button variant="primary" with its glyph -->
  </div>
  <div class="ej-toolbar__chips">
    <button type="button" class="ej-chip ej-chip--active">الكل <span class="ej-chip__count">128</span></button>
    <button type="button" class="ej-chip">قيد التنفيذ <span class="ej-chip__count">23</span></button>
    <button type="button" class="ej-chip">متأخرة عن SLA <span class="ej-chip__count ej-chip__count--alert">4</span></button>
    <span class="ej-filter-tags">مصفّى: <span class="ej-filter-tag">الجهة: SNB <button class="ej-filter-tag__x" aria-label="إزالة">×</button></span></span>
  </div>
</div>
```

Rules: chips are the 4–6 most-asked questions (all, new, in progress, in review, past SLA, obstructed), one active at a time, counts live and in Latin digits; a count that means trouble (past SLA, obstructed) uses `ej-chip__count--alert`. Everything else (client, assignee, date range, city) lives behind the `تصفية` button in a side sheet; each applied filter appears as a removable `ej-filter-tag`. The primary action stays at the end of the first row.
