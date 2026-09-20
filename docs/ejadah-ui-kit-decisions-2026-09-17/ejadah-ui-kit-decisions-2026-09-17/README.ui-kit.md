## Using @platform/ui-kit

Ejadah's design system for an Arabic/RTL real-estate valuation platform (Tajawal typeface, navy + gold brand).

**Wrapping.** No required root provider for most components — `Button`, `Card`, `Table`, `Badge`, etc. render standalone. Two exceptions:
- Always wrap your page root in `dir="rtl" lang="ar"` — components assume an RTL ambient context (e.g. `TdLtr`/`LtrCode` explicitly *counteract* RTL for numbers/codes, which only makes sense inside an RTL page).
- If you use the `useToast()`/`useOptionalToast()` hooks, wrap the tree in `<ToastProvider>` first — toasts render through it, not standalone.

**Styling idiom: Tailwind v4 utility classes on real design tokens — never invent new color/spacing names.** Compose with these (defined in `tokens/colors.css`, `tokens/typography.css`, mapped through Tailwind's `@theme`):

| Purpose | Classes |
|---|---|
| Surfaces | `bg-bg` (page), `bg-surface` (card), `bg-surface-2` (subtle panel/header) |
| Text | `text-text` (body), `text-text-2` (secondary), `text-text-3` (muted) |
| Borders | `border-border`, `border-border-md` |
| Brand | `bg-ink`/`text-ink` (navy — primary actions), `bg-gold`/`text-gold`/`bg-gold-d` (accent) |
| Status | `bg-danger-bg`/`text-danger-text`, `bg-success-bg`/`text-success-text`, `bg-warning-bg`/`text-amber-text`, `bg-info-bg`/`text-info-text` |
| Shape/elevation | `rounded` (default radius), `rounded-lg`, `rounded-sm`, `shadow-card`, `shadow-modal` |

Merge conditional classes with the shipped `cn()` helper (`import { cn } from "@platform/ui-kit"`), not template strings.

**Where the truth lives.** Read `styles.css` (imports the full token/utility closure) and each component's own `.prompt.md` before styling — they show the exact class vocabulary and real usage examples. `tokens/colors.css` and `tokens/typography.css` are the token source of truth; don't guess a color name, grep it there.

**Idiomatic build snippet** (adapted from a verified preview):

```tsx
import { Badge, Button, Card, CardBody, CardHeader } from "@platform/ui-kit";

<div dir="rtl" lang="ar">
  <Card style={{ maxWidth: 380 }}>
    <CardHeader>
      <strong style={{ fontSize: 14 }}>بيانات الصك</strong>
      <Badge tone="success">مكتمل</Badge>
    </CardHeader>
    <CardBody>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
        رقم الصك 88120044991 — صادر بتاريخ 1445/03/12هـ.
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <Button variant="ghost" size="sm">إلغاء</Button>
        <Button variant="primary" size="sm">اعتماد</Button>
      </div>
    </CardBody>
  </Card>
</div>
```

**Notable brand-palette quirk**: `--success` maps to navy (`--ink`), not green — Ejadah's "success"/"complete" state is brand navy, not a literal green. Don't second-guess a navy "complete" badge/progress bar as a bug.

# EjadahUiKit (@platform/ui-kit@0.0.0)

This design system is the published @platform/ui-kit React library, bundled as a single
browser global. All 86 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.EjadahUiKit`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.EjadahUiKit.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { AppModal } = window.EjadahUiKit;
ReactDOM.createRoot(document.getElementById('ds-root')).render(<AppModal />);
```

## Tokens

218 CSS custom properties from @platform/ui-kit. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **color** (46): `--color-red-600`, `--color-amber-50`, `--color-amber-200`, …
- **spacing** (5): `--tw-space-y-reverse`, `--tw-ring-inset`, `--tw-inset-shadow`, …
- **typography** (13): `--font-sans`, `--font-mono`, `--font-weight-normal`, …
- **radius** (7): `--radius-sm`, `--radius-md`, `--radius-lg`, …
- **shadow** (10): `--shadow-lg`, `--shadow-modal`, `--tw-shadow`, …
- **other** (137): `--spacing`, `--container-xs`, `--container-sm`, …

## Components

### general
- `AppModal`
- `Badge`
- `Button`
- `Card`
- `CardBody`
- `CardHeader`
- `DeedLabel`
- `EmptyIconBuilding`
- `EmptyIconSearch`
- `EmptyState`
- `ErrorBoundary`
- `FormGroup`
- `FormRow`
- `GentleBusy`
- `GentleLoadingCopy`
- `GoogleMapPin`
- `InfathSection`
- `InfathSelectField`
- `InfathTextAreaField`
- `InfathTextField`
- `InlineLoadingSkeleton`
- `Input`
- `KpiBand`
- `KpiCell`
- `Label`
- `ListPager`
- `LtrCode`
- `MobileKpiStatCards`
- `ModalBody`
- `ModalCard`
- `ModalClose`
- `ModalFooter`
- `ModalHeader`
- `ModalOverlay`
- `ModalTitle`
- `Note`
- `OperationalPanel`
- `OperationalToolbarPrimaryButton`
- `OperationalToolbarSearch`
- `OperationalToolbarSelect`
- `PageGutter`
- `PageLoadingHint`
- `PageShell`
- `PageShellHeader`
- `PageToolbar`
- `PanelSkeleton`
- `PoLabel`
- `PoNumber`
- `ProgressBar`
- `QueueTableHint`
- `ReportPageBody`
- `RowAttentionDot`
- `RowMoreMenu`
- `Select`
- `Skeleton`
- `SkeletonTableRows`
- `Spinner`
- `StatCard`
- `StatGrid`
- `StatLabel`
- `StatusBadge`
- `StatusPill`
- `StatValue`
- `SubpageHeader`
- `SubpagePanel`
- `Tab`
- `TabBar`
- `Table`
- `TableEmptyRow`
- `TableFrame`
- `TabPanel`
- `TBody`
- `Td`
- `TdAction`
- `TdLtr`
- `Textarea`
- `Th`
- `ThAction`
- `THead`
- `ToastProvider`
- `Tr`

### icons
- `KpiAlertIcon`
- `KpiCheckIcon`
- `KpiClipboardIcon`
- `KpiClockIcon`
- `ShowAllEye`

## Migrated from a legacy design system

This system was carried over from the standalone version on 2026-09-17. The part of this README the author wrote predates the move, so any file names in it are the old ones. Where things are now:

- `styles.css`, `fonts/fonts.css`, `_ds_bundle.css` (the global stylesheets) → `project/components/bundle.css`, with the token declarations moved to `project/tokens.json` (`project/tokens.css` is generated from them)
- `_ds_bundle.js` → `project/components/bundle.js`
- the migration report, which lists what did not come across: `project/assets/notes/MIGRATION-REPORT.md`

---

# Brand book (approved 2026-09-17)

## The three contexts — pick the family first

| Context | Family token | Typeface | Use it for |
| --- | --- | --- | --- |
| Apps | `app` (= `sans`) | Tajawal 400/500/700/800 | Every screen of the operations platform, dashboards, portals, prototypes of them |
| Reports | `report` | IBM Plex Sans Arabic 400/500 (+ IBM Plex Sans for Latin) | Quotations «عروض الأسعار», proposals, slide decks, one-pagers, PDF reports |
| Letters | `letter` | Sakkal Majalla 400/700 (files in `fonts/`) | Official correspondence on `ejadah-letterhead.png`, memos, certificates |

Decide the context from the deliverable, never mix families in one artifact, and use the matching type styles: `body`/`h2`/`h3`/`app-*` in apps, `report-*` in reports, `letter-*` in letters. Colour, spacing, radii and iconography are shared by all three.

## Content fundamentals

- Write formal, operational Arabic. Imperative labels («حفظ المعاملة», «إعادة المحاولة»), no pleasantries, no exclamation marks. Address the user in the second person, politely and directly; hints are short: «ستظهر المعاملات الجديدة هنا فور إسنادها».
- Keep the status vocabulary fixed: جديد / قيد التنفيذ / قيد الدراسة / قيد المراجعة / مكتمل / متعذر / معتمد / معلّق / ناقص / محذوف. Say «متعذر» (obstructed), never «فشل». Render them with `StatusBadge`.
- Errors are calm and actionable: «تعذّر تنفيذ العملية — حاول مرة أخرى». Loading reads «جاري التحميل»; progress toasts go «جارٍ الحفظ…» then «تم حفظ المعاملة».
- Latin only for reference codes (`EJ-2026-0412`), bank names (`SNB Capital`) and finance terms (`DSCR`): wrap them in `.lat` and `<bdi>`. Counts and dates in Latin digits with `tabular-nums`.
- No emoji anywhere. Icons are stroked SVGs.
- Reports: lead with the client's need, then scope «نطاق العمل», methodology (TAQEEM standards), deliverables, fees `report-figure` with the currency after the number («12,500 ريال»), validity and terms. Letters: subject line first («الموضوع: …»), date in both calendars when required, signature block above the stamp.

## Visual foundations

**Colour.** Deep navy `ink` #102b4e is the brand: sidebar, primary buttons, toasts, headings. Muted gold `gold` #a4906f is the accent — decorative only: active states, focus border, the 2px table-header underline and 3px accent rails (`accent`). Gold is never a text colour and never a button fill; text that must read gold uses `gold-d` #7a6749 (5.2:1). Text on navy fills uses `on-ink`, never a literal white. Pages sit on warm cream `bg` #f5f3ee with white `surface` panels and `surface-2` headers. Semantic colours: **success is navy** (`success` = `ink`, never green), `warning` amber, `danger` terracotta `red` #c4553b (white on it 4.6:1), `info` blue. Fills use the light `*-bg`/`*-light` washes, labels the dark `*-text`. Dark theme (`data-theme="dark"`): deep slate surfaces, brightened gold, translucent semantic washes. Every legacy alias (`text`, `surface2`, `border2`, `primary-*`, `teal*`, `accent-*`, `bg2`) resolves to a canonical token — write the canonical name in new work.

**Type.** Arabic line-height ≥ 1.6 (`lh` 1.75 body), minimum 12px (`fs-hint`), no letter-spacing on Arabic, `tabular-nums` on numeric columns. App scale: `fs-page-title` 20 / `fs-section-title` 17 / `fs-body` 14 / `fs-label` 13 / `fs-hint` 12, stat values `app-stat` 24 and `app-kpi` 32 extrabold. Report scale: `report-title` 28 / `report-heading` 20 / `report-body` 14 (lh 1.7) / `report-figure` 24 — IBM Plex Sans Arabic has no bold in the approved spec, so hierarchy comes from size and `ink` vs `text-1`. Letter scale: `letter-heading` 18 / `letter-body` 16 (lh 1.8) / `letter-signature` 14, bold allowed (700 file present).

**Layout.** Fixed `sidebar-w` 260px navy sidebar (`sidebar-w-collapsed` 72px rail), `topbar-h` 66px, `tabs-h` 42px tab strip; content on the cream canvas with `page-gutter-x` gutters; internal gaps from the spacing scale `space-1`…`space-6` (4/8/12/16/24); white panels at `radius-lg` 12px with a 1px `border`, mostly flat. Queue pages get a gradient header strip `surface-2` → `surface`. Reports: A4/16:9 pages with generous margins, one idea per slide, tables with the gold header underline. Letters: the letterhead PNG at full bleed, text block inside its margins, stamp bottom-start.

**Buttons.** One height for every control: 38px (`Button`, fields, toolbar) — 32px `sm`, 44px `lg`; label `fs-body` 14px at weight 500. `primary` (navy) is the one main action per view and carries a 16px stroked glyph before its label (check, plus, upload); `default`/`outline` secondary with the grey `border-md` hairline (never navy), `ghost` quiet, `danger` destructive; `accent` (gold fill) is deprecated — mark with a gold dot or rail instead. Every control shows a 3px gold `focus-visible` ring.

**Tables and lists.** 36px rows (32px dense), header `fs-label` 500 in `text-2` on `surface-2` with the gold underline, sticky in a scrolling wrap; one key column in `heading` weight 500; numbers end-aligned with `tabular-nums`; status is a `StatusBadge` in the last column, which inside lists renders as an equal-size filled chip (108×26, centred label, no dot) so the column aligns; never a row fill; `ej-table--dense` (36px) + `ej-table--zebra` for archives and wide ledgers. Below 900px the row becomes a `TransactionRow` card with a 3px status rail. Every queue opens with a `FilterBar` (chips = the 4–6 most-asked statuses, the rest behind `تصفية`, which opens a `SideSheet`, never a popover) and swaps to a `BulkBar` while rows are selected. Every paged list ends in a `TableFooter`: total first, page-of-N, no page-number strip, never "load more" internally.

**Radii.** `radius` 8px for controls, buttons, fields, badges; `radius-lg` 12px for cards, panels, modals; `radius-sm` 6px for small pieces. Full-round only for badge dots and nav counts.

**Borders and rails.** Hairlines `border` #ece8df and `border-md` #ddd8cc; gold 2px table-header underline; 3px gold rails on stat-card top, note start, KPI first cell and the active nav item.

**Shadows.** `shadow` on resting panels (whisper-quiet navy), `shadow-lg` on menus, `shadow-modal` on dialogs. No other elevation.

**Focus and hover.** Fields: `gold` border + 3px 22% gold ring; Infath fields use a `blue` ring. Buttons shift colour on hover, no lift — except `ToolbarPrimaryButton` which lifts −1px. Rows hover to `row-hover`, nav items to white 6%.

**Motion.** Enterprise-minimal: opacity/colour fades 140–280ms, `cubic-bezier(.22,1,.36,1)` for toasts, shimmer skeletons, a pulsing live dot, gray-blink on opening queue rows. No bounces, no route transitions; honour `prefers-reduced-motion`. Durations are tokens: `motion-fast` 120ms (press), `motion-base` 150ms (hover/focus fades), `motion-slow` 280ms (progress, toast entry); easing `ease-out-quart`.

**Imagery.** None in the app. Print and letters use the official letterhead and stamp from `assets/Logos/`. Reports may use the navy `logo.svg` on light grounds; never recolour it.

**Transparency.** None — solid surfaces; the modal scrim is navy at 45%.

## Iconography

- Stroked inline SVGs only: 24×24 viewBox, stroke 1.8–2.2, round caps and joins, `currentColor` — Lucide/Feather style, hand-inlined per component. No icon font, no PNG icons, no emoji.
- Sizes: 18px in nav, 15–17px in controls and toasts, 20px in the top bar.
- Unicode sparingly: `×` modal close, `▾` Infath select caret, `⋮` row actions.
- Need more glyphs? Use Lucide (same stroke style) — a flagged substitution; the source has no icon package.
- Marks in `assets/Logos/`: `logo.svg` (navy, on light), `logo-sidebar.svg` (white, on `ink`), `ejadah-letterhead.png`, `ejadah-stamp.png`; PWA icon `assets/icon-512.png`.

## Components

Real components, on `window.EjadahUiKit`, grouped as the source groups them — each has a guide and a live preview:

- **Core:** `Button`, `Badge`, `StatusBadge`, `StatusPill`, `Card` (`CardHeader`/`CardTitle`/`CardBody`/`CardFoot`), `Note`, `Spinner`, `Skeleton`
- **Forms:** `Input`, `Select`, `Textarea`, `Label`, `FormField`, `FormRow`, `InfathField`, `InfathSection`
- **Data:** `Table`, `StatCard`, `StatGrid`, `KpiBand`, `KpiCell`, `ProgressBar`
- **Navigation:** `Tabs`, `TabBar`, `Tab`, `Toolbar`, `ToolbarSearch`, `ToolbarSelect`, `ToolbarPrimaryButton`
- **Feedback:** `Modal`, `Toast`, `EmptyState`

Showcase pages carried from the standalone version (plain HTML with the system's classes — copy the markup): `Core`, `Data`, `Feedback`, `Forms`, `Navigation`, and the interactive `Index` app shell (login → dashboard → active-transactions queue). Page-level primitives (`.ej-page-header`, `.ej-canvas`, `.ej-panel`, `.ej-progress`, …) are CSS classes in the ui-kit stylesheet, not JSX exports; `ErrorBoundary`/`QueryErrorPanel` are intentionally left out.

CSS-only patterns beside the exports: `SideSheet` (380px panel over the scrim — advanced filters and secondary forms), `FilterBar` (the stacked toolbar: search, `تصفية` button, quick-filter chips with counts, active tags), `BulkBar` (navy bar while rows are selected), `TableFooter` (`.ej-table-foot`: total · range, page-of-N with a typeable field, prev/next — under every paged list), `TransactionRow` (`.ej-rows`/`.ej-row`, the queue row below 900px) and the `Table` variants `ej-table--dense`, `ej-table--zebra`, `ej-tr--selected`, `ej-td--key`, `ej-td--num`.

Report and letter layouts have no components yet: build them as HTML/slides with the tokens, the `report-*`/`letter-*` styles and the assets above.

