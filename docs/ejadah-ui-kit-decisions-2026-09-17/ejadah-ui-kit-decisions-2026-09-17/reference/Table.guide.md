Data table for queues and lists: `surface-2` header with the 2px gold underline, 36px rows (32px `ej-table--dense`), cream `row-hover` on hover. The first column is the record key.

```jsx
<Table columns={["المرجع", "العقار", "الجهة", "الحالة"]}
  rows={[[<a href="/tx/412"><bdi className="lat">EJ-2026-0412</bdi></a>, "فيلا — حي الروضة", "بنك الرياض", <StatusBadge status="progress" />]]} />
```

Props: `columns` (strings), `rows` (arrays of cells), `hoverable` (default true), `renderCell(cell, rowIndex, colIndex)`, `className`.

Variants by `className` (custom markup uses the same classes on `.ej-table`):
- default — the active-transactions queue and every list under ~50 rows.
- `ej-table--dense` — 36px rows, 13px cells: archives, finance ledgers, anything in the hundreds.
- `ej-table--zebra` — alternating `surface-2` rows; combine with dense for wide tables (7+ columns).
- `ej-tr--selected` on a row — gold-soft fill for the active/bulk-selected row.

Cells: `ej-td--key` (500 weight, `heading` colour) on the column the user scans by — the reference or the property, one only; `ej-td--num` / `ej-th--num` on numeric columns (end-aligned, `tabular-nums`); links inside cells get the gold hairline underline; wrap Latin codes in `<bdi class="lat">`. Headers stick to the top of the scrolling `.ej-table-wrap`; a sortable header carries `aria-sort` and shows the gold caret.

Below 900px wrap the table and a `.ej-rows` list in `.ej-table-wrap--responsive` so the row-card pattern (`TransactionRow`) takes over. Empty and loading states: render `EmptyState` / `Skeleton` rows inside the wrap, never an empty `<tbody>`.

Status in a list has one size by rule: inside `.ej-table` and `.ej-row` a `StatusBadge` renders as its filled tone chip at 108×26px with the label centred and no dot, so the column reads as an aligned strip of equal chips; give the column `ej-th--status`/`ej-td--status`. Outside lists the badge keeps its natural width and dot.

Do: keep 5–7 columns, status last, one key column. Don't: colour whole rows by status (use the badge), centre text, or put two actions in a cell — one `⋮` menu.
