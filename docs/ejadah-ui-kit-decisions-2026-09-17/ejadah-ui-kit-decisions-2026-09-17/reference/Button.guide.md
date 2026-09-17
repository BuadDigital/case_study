Ejadah button — use `primary` (navy) for the main action, `default` for secondary, `accent` (gold) sparingly, `danger`/`dangerOutline` for destructive.

```jsx
<Button variant="primary">حفظ</Button>
<Button>إلغاء</Button>
<Button variant="danger" size="sm">حذف</Button>
```

Props: variant (default|primary|outline|accent|danger|dangerOutline|ghost), size (default|sm|lg), loading, disabled. `accent` is deprecated — gold is a mark, not a button.

Icons (approved 2026-09-17): the **primary** action carries a 16px stroked glyph before its label — a check for حفظ/اعتماد, a plus for معاملة جديدة, an arrow-up for رفع لإنفاذ — passed as the first child. Secondary, ghost and danger buttons stay text-only; the secondary keeps its grey `border-md` hairline (never a navy border, which would compete with the primary).

```jsx
<Button variant="primary"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>حفظ المعاملة</Button>
```
