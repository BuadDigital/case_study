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
