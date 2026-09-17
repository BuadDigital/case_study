Transaction row card — the queue row for narrow widths (external portals, phone), a CSS pattern on `.ej-rows`/`.ej-row`, not a bundle export.

```html
<div class="ej-rows">
  <a class="ej-row" href="/tx/412">
    <span class="ej-row__rail ej-row__rail--warning"></span>
    <span class="ej-row__main">
      <span class="ej-row__title">فيلا — حي الروضة <bdi class="lat">EJ-2026-0412</bdi></span>
      <span class="ej-row__meta">بنك الرياض · سالم الغريب · <span class="lat">2026-09-14</span></span>
    </span>
    <!-- StatusBadge -->
    <button type="button" class="ej-row__actions" aria-label="إجراءات">⋮</button>
  </a>
</div>
```

Parts: `ej-row__rail` with `--success|--warning|--danger|--info` (the status colour, 3px, never a fill); `ej-row__main` holding `ej-row__title` (property, then the reference in `.lat`) and `ej-row__meta` (client · assignee · date, one line, ellipsis); the `StatusBadge`; one `ej-row__actions` menu.

Use inside `.ej-table-wrap--responsive` beside the `Table` so the two swap at 900px, or alone on portals. The whole row is the link (44px+ target); the actions button stops propagation. Don't: stack more than two lines of meta, or show two badges.
