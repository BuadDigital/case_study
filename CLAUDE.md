# Working in this repo

## Reuse before you write

Duplicated code was removed across the whole app (2026-10-25: 2,436 → 167 duplicated lines in the
frontend, 1,200 → 730 in the backend). Keep it that way: **before writing a component, hook, helper,
rule or query, search for the one that already exists and use it.** If an existing one is close but
not quite right, extend it with a prop or parameter instead of copying it.

### Where to look first

| Need | Look here |
|---|---|
| UI component (button, card, table, badge, note, modal, KPI, form field…) | The design system: `packages/ui-kit` — its catalogue is `.design-sync/config.json` (`componentSrcMap`), with usage rules in `.design-sync/conventions.md` |
| Phone layouts | `MobileRecordCard` / `MobileRecordList`, `MobileSectionPicker`, `MobileKpiStatCards`, `PhoneField`, `AppModal` (a bottom sheet below `lg`) |
| Status chips | `StatusBadge`, `StatusPill`, `ColorStatusPill` (`packages/ui-kit/src/badges.tsx`) |
| Icons | `packages/ui-kit/src/icons`, `OpsIcon`, `UploadFileIcon` |
| File pick / drag-and-drop | `useFileDropZone`, `PDF_OR_IMAGE_ACCEPT` / `isPdfOrImageFile` |
| Dialog focus, Escape, scroll lock | `useSheetDialog` |
| Numbers, dates, Arabic digits | `packages/app-shared/src/format`, `packages/app-shared/src/lib/arabic-digits.ts`, `parseLocaleNumber` |
| Coordinates and map links | `packages/app-shared/src/domain/geo.ts` (`parseLatLng`, `coordsFromLocationMapUrl`, `haversineKm`) |
| Arabic text matching | `normalizeArabicSearchText` (`packages/app-shared/src/domain/courts/circuit-search.ts`), `deedsMatch` (`apps/mfe-case-study/src/lib/app-data/deed-number.ts`) |
| API calls | `packages/api-client` — one module per area; reuse its response helpers |
| Queries shared by two apps | `packages/app-shared/src/query` |
| Backend number parsing | `LocaleNumber.TryParse` (shared contracts) |
| Backend list paging / search text | `ListQueryText` (`RealEstateEval.Application.Rules`) |
| Backend message consumers / timed jobs | `InboxIntegrationEventConsumer`, `PeriodicSweepHostedService` |
| Calls between services | `UpstreamJson` (`backend/shared/RealEstateEval.Shared.RemoteClients`) |
| Who may call an endpoint | `CapabilityPolicyNames` + `ServiceCollectionExtensions` (`backend/shared/RealEstateEval.Shared.Web`) |

Search by what the code does, not only by name: `rg "useEffect.*getInspectorPhotoDataUrl"`,
`rg "onDragOver"`, `rg "HasMaxLength"`.

### Where new shared code goes

- Used by one screen → keep it in that file.
- Used by two screens of the same app → a file inside that app (`apps/<mfe>/src/...`).
- Used by two apps → `packages/ui-kit` (UI) or `packages/app-shared` (logic, queries) — never copy
  a file from one app into another. A new ui-kit component should also be added to
  `.design-sync/config.json` so the design system lists it.
- Backend: inside the context that owns it; across services only through `backend/shared` or
  `RealEstateEval.Application`, respecting the project-reference boundary test.

### Check before you finish

To see whether your change copied existing code, run the detector the clean-up used:

```
npx -y jscpd@4.0.5 apps packages --pattern "**/*.{ts,tsx}" --ignore "**/node_modules/**,**/.next/**,**/__tests__/**,**/*.test.ts,**/*.test.tsx" --min-lines 8 --min-tokens 70
```

## Branches

- Work on `dev`. `main` deploys to production on every push — merge `dev` into `main` only when the
  release is approved.
