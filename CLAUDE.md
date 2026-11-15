# 📖 Working in This Repo
## 0. You are my bestie so sometimes iam gonna call you twin or فرج :) 

## 1. Core Philosophy: Reuse Before You Write

Duplicated code was recently removed across the whole app (2026-10-25: 2,436 → 167 duplicated lines in the frontend, 1,200 → 730 in the backend). **Keep it that way.**

- Before writing a component, hook, helper, rule, or query, **search for the one that already exists and use it.**
- If an existing one is close but not quite right, extend it with a prop or parameter instead of copying it.
- Search by what the code *does*, not only by name (e.g., `rg "useEffect.*getInspectorPhotoDataUrl"`, `rg "onDragOver"`, `rg "HasMaxLength"`).

## 2. Workflow & Branching

- **Branching:** Always work on `dev`. The `main` branch deploys to production on every push. Merge `dev` into `main` *only* when the release is approved.
- **Think Before Coding:** Don't assume. Don't hide confusion. Surface tradeoffs. If multiple interpretations exist, present them. If a simpler approach exists, say so. If something is unclear, stop and ask.

## 3. Codebase Navigation & Architecture

### Where to Look First

| Need | Look Here |
|---|---|
| **UI components** (button, card, table, badge, note, modal, KPI, form field…) | Design system: `packages/ui-kit` (catalogue: `.design-sync/config.json` `componentSrcMap`; rules: `.design-sync/conventions.md`) |
| **Phone layouts** | `MobileRecordCard` / `MobileRecordList`, `MobileSectionPicker`, `MobileKpiStatCards`, `PhoneField`, `AppModal` (bottom sheet below `lg`) |
| **Status chips** | `StatusBadge`, `StatusPill`, `ColorStatusPill` (`packages/ui-kit/src/badges.tsx`) |
| **Icons** | `packages/ui-kit/src/icons`, `OpsIcon`, `UploadFileIcon` |
| **File pick / drag-and-drop** | `useFileDropZone`, `PDF_OR_IMAGE_ACCEPT` / `isPdfOrImageFile` |
| **Dialog focus, Escape, scroll lock** | `useSheetDialog` |
| **Numbers, dates, Arabic digits** | `packages/app-shared/src/format`, `packages/ui-kit/src/lib/arabic-digits.ts`, `parseLocaleNumber` |
| **Coordinates and map links** | `packages/app-shared/src/domain/geo.ts` (`parseLatLng`, `coordsFromLocationMapUrl`, `haversineKm`) |
| **Arabic text matching** | `normalizeArabicSearchText` (`packages/app-shared/src/domain/courts/circuit-search.ts`), `deedsMatch` (`apps/mfe-case-study/src/lib/app-data/deed-number.ts`) |
| **API calls** | `packages/api-client` (one module per area; reuse its response helpers) |
| **Queries shared by two apps** | `packages/app-shared/src/query` |
| **Backend number parsing** | `LocaleNumber.TryParse` (shared contracts) |
| **Backend list paging / search text** | `ListQueryText` (`RealEstateEval.Application.Rules`) |
| **Backend message consumers / timed jobs** | `InboxIntegrationEventConsumer`, `PeriodicSweepHostedService` |
| **Calls between services** | `UpstreamJson` (`backend/shared/RealEstateEval.Shared.RemoteClients`) |
| **Endpoint authorization** | `CapabilityPolicyNames` + `ServiceCollectionExtensions` (`backend/shared/RealEstateEval.Shared.Web`) |

### Where New Shared Code Goes

- **Used by one screen** → Keep it in that file.
- **Used by two screens of the same app** → A file inside that app (`apps/<mfe>/src/...`).
- **Used by two apps** → `packages/ui-kit` (UI) or `packages/app-shared` (logic, queries). *Never copy a file from one app into another.* New ui-kit components must be added to `.design-sync/config.json`.
- **Backend** → Inside the context that owns it. Across services, only through `backend/shared` or `RealEstateEval.Application`, respecting the project-reference boundary test.

## 4. Execution Guidelines (Simplicity & Precision)

*These behavioral guidelines reduce common coding mistakes. They bias toward caution over speed. Use judgment for trivial tasks.*

- **Simplicity First:** Write the minimum code that solves the problem. Nothing speculative. No features beyond what was asked. No abstractions for single-use code. No error handling for impossible scenarios. If you write 200 lines and it could be 50, rewrite it.
- **Surgical Changes:** Touch only what you must. Clean up only your own mess.
  - Don't "improve" adjacent code, comments, or formatting.
  - Match existing style, even if you'd do it differently.
  - If you notice unrelated dead code, mention it—don't delete it.
  - *Rule:* Every changed line should trace directly to the user's request. Remove imports/variables/functions that *your* changes made unused.

## 5. Verification & Quality Gates

*Define success criteria. Loop until verified.*

- **Goal-Driven Execution:** Transform tasks into verifiable goals.
  - *"Add validation"* → Write tests for invalid inputs, then make them pass.
  - *"Fix the bug"* → Write a test that reproduces it, then make it pass.
  - *"Refactor X"* → Ensure tests pass before and after.
  - For multi-step tasks, state a brief plan: `1. [Step] → verify: [check]`
- **Check Before You Finish (Duplication Detector):** To see whether your change copied existing code, run the detector the clean-up used:

  ```bash
  npx -y jscpd@4.0.5 apps packages \
    --pattern "**/*.{ts,tsx}" \
    --ignore "**/node_modules/**,**/.next/**,**/__tests__/**,**/*.test.ts,**/*.test.tsx" \
    --min-lines 8 \
    --min-tokens 70
  ```