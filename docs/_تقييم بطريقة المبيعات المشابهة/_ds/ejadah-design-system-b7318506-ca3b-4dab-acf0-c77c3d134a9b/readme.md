# Ejadah Design System — نظام إجادة

Design system for **إجادة (Ejadah)**, a Saudi real-estate valuation firm's internal operations platform: property valuation transactions, work orders (أوامر العمل), field inspections, key envelopes for courts (ظروف المفاتيح), engineering-office fees, finance/billing, and Infath (إنفاذ) government uploads. Fully **RTL Arabic**; users are internal staff (operations managers, evaluators, field inspectors, finance officers, government reviewers) plus external party portals (engineering offices, inspectors).

**Source:** GitHub `BuadDigital/case_study` (https://github.com/BuadDigital/case_study) — tokens and components rebuilt from `packages/design-system/src` (tokens.css, 26 React components), shell from `apps/shell/src` (AppShell.tsx, layout.tsx, globals.css), typography from `docs/الخطوط/ejadah-typography-spec.md`. Explore the repo for deeper context (docs/ is rich: pricing logic, roles, workflows).

## Content fundamentals

- **Language:** Arabic UI, formal but operational. Latin only for reference codes (`EJ-2026-0412`), bank names (`SNB Capital`), finance terms (`DSCR`).
- **Voice:** imperative labels («حفظ المعاملة», «إعادة المحاولة»), no pleasantries, no exclamation marks. Errors are calm and actionable: «تعذّر تنفيذ العملية — حاول مرة أخرى».
- **Status vocabulary is fixed:** جديد / قيد التنفيذ / قيد الدراسة / قيد المراجعة / مكتمل / متعذر / معتمد / معلّق / ناقص / محذوف. "متعذر" (obstructed), never "فشل".
- **No emoji.** Icons are stroked SVGs; counts and dates in Latin digits with `tabular-nums`.
- **Loading text:** «جاري التحميل», progress toasts like «جارٍ الحفظ…» then «تم حفظ المعاملة».
- Second person addressed politely and directly; hints are short: «ستظهر المعاملات الجديدة هنا فور إسنادها».

## Visual foundations

- **Palette:** deep navy ink `#102b4e` (sidebar, primary buttons, toasts, headings) + muted gold `#a4906f` family (accents, active states, focus rings, table header underline) on a warm cream page `#f5f3ee` with white surfaces. Semantic: success = **navy** (not green), warning amber, danger muted terracotta `#d9694f`, info blue. Fills use the light `*-bg`, labels use the dark `*-text`.
- **Type:** Tajawal (shipped app; 400/500/700/800). The approved spec mandates IBM Plex Sans Arabic + IBM Plex Sans (400/500 only) — both loaded; see caveat below. Scale: 20/17/14/13/12px, stat values 24–32px extrabold. Arabic line-height ≥1.6 (1.75 body), min 12px, no letter-spacing on Arabic, `tabular-nums` on numeric columns, `.lat` for Latin runs, `<bdi>` around reference codes.
- **Layout:** fixed 260px ink sidebar (72px collapsed rail), 66px topbar, 42px tab strip; content on cream canvas with 16px gutters; white panels 12px radius, 1px `--border`, mostly flat (shadows are whisper-quiet navy). Gradient header strip (surface-2 → surface) on queue pages.
- **Radii:** 8px controls/buttons, 12px cards/panels/modals, 6px small. Full-round pills for badges' dots and nav badges only.
- **Borders:** warm hairlines `#ece8df` / `#ddd8cc`; gold 2px table-header underline; 3px accent rails (stat card top, note start, KPI first cell, active nav item).
- **Focus:** gold border + 3px 22% gold ring on fields; Infath fields use blue ring. Buttons: color shift on hover (no lift), except `.ot-primary` which lifts -1px.
- **Motion:** enterprise-minimal — opacity/color fades 140–280ms, `cubic-bezier(.22,1,.36,1)` for toasts, shimmer skeletons, pulsing live status dot, gray-blink on opening queue rows. No bounces, no route transitions. `prefers-reduced-motion` respected.
- **Hover:** rows → cream `--row-hover`; nav items → white 6%; buttons → darker/lighter of same hue.
- **Imagery:** none in-app. Print materials use the official letterhead + stamp (assets/).
- **Dark mode:** `html[data-theme="dark"]` — deep slate surfaces, brightened gold, translucent semantic washes.
- **Transparency/blur:** none — solid surfaces; modal scrim is navy 45%.

## Iconography

- **Stroked inline SVGs only** (24×24 viewBox, stroke-width 1.8–2.2, round caps/joins, `currentColor`) — Lucide/Feather style, hand-inlined per component in the source (`NavIcon` takes a path `d`). No icon font, no PNG icons, no emoji.
- Sizes: 18px nav, 15–17px controls/toasts, 20px topbar.
- Unicode used sparingly: `×` modal close, `▾` Infath select caret, `⋮` row actions.
- If you need more glyphs, use **Lucide from CDN** (same stroke style) — flagged substitution, the repo has no icon package.
- Brand marks in `assets/`: `logo.svg` (navy, on light), `logo-sidebar.svg` (white, on ink), `ejadah-letterhead.png`, `ejadah-stamp.png`, `icon-512.png` (PWA).

## Components

Core: **Button**, **Badge**, **StatusBadge**, **StatusPill**, **Card** (CardHeader/CardTitle/CardBody/CardFoot), **Note**, **Spinner**, **Skeleton**
Forms: **Input**, **Select**, **Textarea**, **Label**, **FormField**, **FormRow**, **InfathField**, **InfathSection**
Data: **Table**, **StatCard**, **StatGrid**, **KpiBand**, **KpiCell**, **ProgressBar**
Navigation: **Tabs**, **TabBar**, **Tab**, **Toolbar**, **ToolbarSearch**, **ToolbarSelect**, **ToolbarPrimaryButton**
Feedback: **Modal**, **Toast**, **EmptyState**

Inventory mirrors `packages/design-system/src/index.ts`. Intentional simplifications: ErrorBoundary/QueryErrorPanel (runtime error plumbing) and MobileKpiStatCards/PageLayout/SubpagePanel primitives are represented by their CSS classes in `tokens/components.css` (`.ej-page-header`, `.ej-canvas`, `.ej-panel`, `.ej-progress`, …) rather than JSX exports.

## Index

- `styles.css` — global entry (imports everything below)
- `tokens/` — fonts.css, colors.css (116 tokens incl. dark theme), typography.css, animations.css, components.css (all `.ej-*` / `.ot-*` classes)
- `components/{core,forms,data,navigation,feedback}/` — JSX + .d.ts + prompt.md + specimen card per group
- `ui_kits/ejadah-app/` — interactive recreation (login, dashboard, active-transactions queue)
- `guidelines/` — brand / color / type / spacing / motion specimen cards
- `assets/` — logos, letterhead, stamp, PWA icon
- `SKILL.md`, `github.md`

## Caveats

- **Font conflict in source:** the shipped app uses Tajawal; `docs/الخطوط/ejadah-typography-spec.md` (marked final, July 2026) mandates IBM Plex Sans Arabic. Default here is Tajawal (matches the running product). No font binaries in the repo — both come from Google Fonts (flagged substitution; spec asks for self-hosted woff2 in production).
- No marketing website in the repo — the only product is the internal app.
