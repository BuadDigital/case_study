# Project memory

Last verified pass (this session):
- MFE typecheck: `npm run typecheck:mfes` — all 9 MFEs pass `tsc --noEmit`
  - mfe-case-study
  - mfe-dashboard
  - mfe-keys
  - mfe-financial
  - mfe-failures
  - mfe-engineering-office
  - mfe-evaluator
  - mfe-settings
  - mfe-valuation
- Frontend unit tests: `npm run test:unit` — 2085 passed, 3 failed
- React Hooks lint: `npm run lint:hooks` — 0 errors, 241 warnings

Environment note:
- First typecheck failed because `@noble/ciphers/aes.js` was missing for `packages/offline-client/src/crypto.ts`.
- Fixed by installing `@noble/ciphers` in this workspace before rerunning typecheck.
- Treat offline-client as the shared package most worth keeping installed and green.

Test failures to revisit:
- `packages/api-client/src/write-repository.test.ts`
  - `keeps application HTTP writes behind the repository`
  - failure mode: test timeout at 5000ms
- `packages/offline-client/src/offline-store.test.ts`
  - `caches prefetched attachment bytes without outbox upload`
  - failure mode: `expected undefined to be 'att-1'`
- `packages/offline-client/src/offline-sync-release.test.ts`
  - `encrypts without Web Crypto and matches standard AES-GCM`
  - failure mode: `decrypt` threw a TypedArray/ArrayBuffer type error

Where the risk looks concentrated:
- `packages/offline-client` — shared dependency used by multiple MFEs; both the install blocker and 2 of 3 unit failures came from here.
- `packages/api-client` — one timeout failure in write-repository test.
- React Hooks warnings are widespread; heaviest in `mfe-case-study`, `packages/app-shared`, and `packages/ui-kit`.

MFEs by apparent weight/surface:
- Heaviest: `@case-study/mfe`, `@evaluator/mfe`
- More bounded: `@dashboard/mfe`, `@valuation/mfe`, `@settings/mfe`, `@keys/mfe`, `@financial/mfe`, `@failures/mfe`, `@engineering-office/mfe`

Case-study report print/preview slice:
- Verified that `CaseStudyReportFrame` uses `buildCaseStudyReportPrintHtml(...)` with `embedded: true`.
- That HTML ends with the paginate script and sets `data-csrd-ready`, same path used by standalone print/download.
- No preview/print/download drift found in that slice.

Not yet verified this session:
- `npm run test:release` was started in background; completion not confirmed yet.
- Backend tests not run separately here.
- Playwright e2e not run here.
- Shell build/integration across MFEs not verified beyond per-MFE typecheck.

Coherent chunks:
- Shell = `@platform/shell`
- MFEs = `@case-study/mfe`, `@dashboard/mfe`, `@keys/mfe`, `@financial/mfe`, `@engineering-office/mfe`, `@evaluator/mfe`, `@failures/mfe`, `@settings/mfe`, `@valuation/mfe`
- Shared packages = `packages/app-shared`, `packages/ui-kit`, `packages/auth-client`, `packages/api-client`, `packages/offline-client`, `packages/types`

If reading this later, the one-line takeaway is:
- Frontend MFEs typecheck cleanly and mostly pass unit tests; the main shared-package risk right now is offline-client, and the main quality debt is React Hooks patterns, not a current build failure.
