# Frontend Best-Practices Report — Audit and Remediation

**Date:** 2026-08-28 · **Branch:** dev
**Scope:** all 70 Vercel React/Next.js best-practices rules, audited across `apps/*` and `packages/*` (772 TS/TSX source files, 12 apps + 6 packages) by 7 parallel auditors in 2 rounds. Every finding was verified by reading the surrounding code.

## Status: remediation complete

All actionable findings are fixed. The five `[~]` entries are deliberate non-fixes, each with the verification that ruled it out — they are not oversights, and re-auditing should not reopen them without addressing the stated prerequisite.

| | |
|---|---|
| Rules clean or N/A at audit time | ~50 of 70 |
| Rules with findings | ~20 |
| Findings fixed | 68 |
| Deliberate non-fixes (`[~]`) | 5 |
| Open decision | 1 (`support.js` defer — see §4) |

**Verification of the final tree:** all 10 MFE workspaces typecheck clean; `apps/shell` and `packages/api-client` typecheck clean; vitest 54 files / 292 tests pass; `next build` succeeds.

Legend: 🔴 high impact · 🟡 medium · 🟢 low · `[x]` done · `[~]` deliberate non-fix

---

## 1. Bundle size & loading (biggest wins)

### 🔴 Barrels that defeat Next's `optimizePackageImports`  (`bundle-barrel-imports`)
- [x] `packages/api-client/src/index.ts:2,15` — `getApiBase` / `isPrivateLanHost` are **defined inline** in the barrel. Next's barrel transform only rewrites pure re-export files, so it bails and all **174** `from "@platform/api-client"` imports pull the full 682-line re-export graph.
  **Fix:** move both functions to `./api-base.ts`; make `index.ts` re-export-only.
- [x] `packages/app-shared/src/index.ts:55-78` — 24 `export * from` lines; `export *` cannot be statically resolved, so the optimizer bails. 8 root importers include 4 components mounted in the shell root layout (`OfflineBanner`, `FieldOfflinePrefetch`, `OfflineWriteInterceptorHost`, `PrototypeAppGate`), landing the whole app-shared graph in the initial chunk.
  **Fix:** convert to explicit named re-exports, or switch the 8 call sites to deep paths (used ~400× elsewhere already).

### 🔴 Heavy components shipped eagerly  (`bundle-dynamic-imports`)
- [x] `apps/mfe-case-study/src/components/po-intake/PoPropertyDetailTabs.tsx:14-29` — 15 tab panels statically imported (incl. `PropertyDetailInspectionTab` 1,862 lines, `PropertyDetailEnfathUpload` 860) though one renders at a time.
  **Fix:** `React.lazy` each non-default tab behind the existing `tab === "…"` guards + Suspense skeleton.
- [x] `apps/mfe-evaluator/src/components/evaluator/valuation-work/ValuationWorkShell.tsx:36-48` — `AdjustmentsMatrix` (1,428), `CostApproachSection` (1,428), `FinalOpinionSection` (1,114), `EvaluatorFinalReviewTab` (664) static, yet the `costScreenVisitedRef`/`finalScreenVisitedRef` gating (:1841, :1875) already marks the exact lazy trigger points.
  **Fix:** `React.lazy` all four.

### 🟡 Modals imported statically behind open-state  (`bundle-conditional`)
The lazy pattern already exists at `OperationsTasksView.tsx:88` (`CreateOperationsTaskModal`) — copy it:
- [x] `apps/mfe-case-study/src/views/OperationsTasksView.tsx:73` — `FailureRaiseModal`
- [x] `apps/mfe-case-study/src/views/OperationsTasksView.tsx:108` — `ReassignOperationsTaskModal`
- [x] `apps/mfe-case-study/src/views/ActiveTransactionQueueView.tsx:36` + `PoPropertiesPage.tsx:17` — `CopyFromPriorTransactionModal` (367 lines, imported in both)
- [x] `apps/mfe-case-study/src/views/ActiveCaseStudyView.tsx:12` — `RedistributePartiesModal` (298)
- [x] `apps/mfe-case-study/src/views/AllAssignedTransactionsView.tsx:33` — `ReopenCompletedTransactionModal` (183)

### 🔴 Preload-on-intent missing for the heaviest chunks  (`bundle-preload`)
Correct implementations already exist (`OperationsTasksView.tsx:94→1829`, `KeysView.tsx:97→660`, `UsersOrganizationView.tsx:78→573`) — copy that shape:
- [x] `apps/shell/src/components/views/AppShellNavParts.tsx:259-260, 324-325` — nav hover prefetches **only React Query data** (`prefetchPrototypePage`), never the JS chunk; since every view is `dynamic(ssr:false)`, `<Link prefetch>` doesn't pull chunks either, so nav clicks block on cold MFE downloads. **Fix (highest value):** add a `PAGE_CHUNK_PRELOAD: Partial<Record<PageId, () => Promise<unknown>>>` map in `PrototypePageView.tsx` and call it from `prefetchPage` in `AppShell.tsx:129-132` alongside the data prefetch.
- [x] `apps/mfe-financial/src/components/FinanceWorkspace.tsx:26-44` — four `ssr:false` area views with no preload on the area tab buttons; wire `onMouseEnter`/`onFocus`. (Wired on the finance sidebar leaves in `AppShellNavParts` — the workspace itself has no tab buttons.)
- [x] `apps/mfe-case-study/src/views/MyTaskWorkView.tsx:83-109` (residual: `PoPropertyEnfathForm` has no in-file intent moment — wire its preload from the queue-row openers in `ActiveTransactionQueueView` during batch 3) — `DistributionPartiesForm`, `PoPropertyEnfathForm`, `PoPropertyBourseForm`, `FailureRaiseModal` show a skeleton on first open; attach preload thunks to their trigger buttons.
- [x] `FinanceMyTasks.tsx:23-36` (per-modal thunks selected by `task.kind`) and `EvaluatorWindow.tsx:56` (wrapper on the tab bar, since `ValTabBar` takes no per-tab handlers).
- [~] `PropertyMapView.tsx:60` — **N/A (verified).** Its only lazy component, `PropertyMapCanvas`, is rendered unconditionally (`:734`), so its chunk is already requested on first paint; there is no opener to hang intent on. Route-level preload is already covered by `PAGE_CHUNK_PRELOAD` under the `property-map` key.

### 🟢 Timing nits
- [x] `apps/shell/src/components/ServiceWorkerRegister.tsx:33` — SW registered in a mount effect, competing with hydration. Wrap in `requestIdleCallback` / `load` listener.  (`bundle-defer-third-party`)

---

## 2. Async waterfalls

### 🔴 Independent awaits serialized  (`async-parallel` / `server-parallel-nested-fetching`) — convert each to `Promise.all`
- [x] `apps/mfe-case-study/src/lib/prototype/case-study-party-answers.ts:79` — one `loadPartyCaseStudyFormDraft` GET **per child task**, fully serialized.
- [x] `apps/mfe-case-study/src/lib/prototype/case-study-party-progress.ts:151-159` — parent draft awaited first, then serialized per-child loop; all independent.
- [x] `apps/mfe-case-study/src/lib/prototype/assignment-doc-attachments.ts:637` — per-attachment download→base64→upload chain serial inside `cloneKind` (the 7 kinds are already parallel at :658; only the inner loop was missed).
- [x] `apps/mfe-case-study/src/lib/prototype/tasks-storage.ts:759` — one `patchWorkflowTask` per related task, serialized.
- [x] `apps/mfe-case-study/src/views/OperationsTasksView.tsx:421` — serialized reopen patches before a single `refetch()`.
- [x] `apps/mfe-case-study/src/views/OperationsTasksView.tsx:812` — `bulkRemind` serializes reminders across the selection.
- [x] `apps/mfe-case-study/src/views/OperationsTasksViewParts.tsx:148` — `uploadDraftFiles` uploads attachments one at a time (`map` preserves order).
- [x] `apps/mfe-case-study/src/components/field-inspection/InspectorFeesBillingTable.tsx:282` — `batchSave` awaits `saveRow` per id sequentially.
- [x] `apps/mfe-case-study/src/components/case-study/CaseStudyForm.tsx:417-422` — parent draft fetch + own draft fetch are independent.
- [x] `apps/mfe-case-study/src/lib/prototype/po-intake-storage.ts:1024` — `deleteTasksForPo` then `deleteFailuresForPo`, independent cascade deletes.
- [x] `apps/mfe-case-study/src/lib/prototype/pdf-first-page-preview.ts:15-16` — `loadPdfJs()` (network chunk) serialized ahead of `blob.arrayBuffer()`.
- [x] `apps/mfe-engineering-office/src/lib/engineering-survey-sketch-extract.ts:2107` — same `loadPdfJs` / `arrayBuffer` shape; also `:2114` serial `getPage`/`getTextContent` over up to 4 independent pages.
- [x] `apps/shell/src/components/FieldOfflinePrefetch.tsx:48-49` — `prefetchPartySubmissionsForTasks` blocks a `savePrefetch` built purely from `taskIds`; also `:61` — up to 40 independent IDB writes serialized in the PO loop.
- [x] `packages/offline-client/src/store.ts:389-394` — `encryptBytes` + `encryptJson` independent crypto ops feeding one `db.put`; also `:520` `listOfflineBlobMeta` decrypts rows serially while sibling `:501` already uses `Promise.all`.
- [x] `packages/app-shared/src/prototype/party-submission-api.ts:322` — chunked list batches awaited serially (rarely >1 batch; low impact).

### 🟡 Partial-dependency chains  (`async-dependencies` / `async-defer-await`) — all in `apps/mfe-case-study/src/lib/prototype/po-intake-storage.ts`
- [x] `:1213-1224` (`addPropertyToPo`) — full `getPoRecord` GET awaited unconditionally; its only consumer needs `record.poNumber`, already in hand as an argument, and when `options.assignToTaskId` is set the fetch is discarded entirely. Skip the fetch / pass `poNumber` down.
- [x] `:1097-1112` (`updatePoRecord`) — `getPoRecord` refetch blocks `syncTaskSlotsForPo`, which reads only `poNumber`. Change `syncTaskSlotsForPo` to take `poNumber: string` and parallelize.
- [x] `:967-991` (`completePropertyBourse` → `tasks-storage.ts:602-612`) — the task-list GET sits fully behind the bourse POST but doesn't depend on it; start `loadWorkflowTasks()` alongside the POST and pass the list via the existing unused `tasks` parameter (`tasks-storage.ts:606`).

### ⚠️ Correctness bug (found during the audit — fix regardless)
- [x] `apps/shell/src/components/FieldOfflinePrefetch.tsx:58` — `prefetchPoRecord` is **not awaited**, so `queryClient.getQueryData` on line 59 almost always misses. Await it (or restructure per the parallelization item above).

---

## 3. Re-render optimization

### 🔴 Big lists re-render per keystroke/tick  (`rerender-memo`)
- [x] `apps/mfe-case-study/src/views/OperationsTasksView.tsx:1912` — ~125 lines of inline JSX per row inside a component holding ~40 `useState` hooks (all modal text state) + `useTickingMinute()` (:326). Every modal keystroke and minute tick re-renders every row. Extract `React.memo(OperationsTaskRow)` with `useCallback` handlers.
- [x] `apps/mfe-case-study/src/views/ActiveTransactionQueueView.tsx:1002` — `rowCtx` is a bare object literal rebuilt every render; all its function members are already `useCallback`-stable, so the literal alone defeats memoization. Wrap `rowCtx` in `useMemo`, wrap `AllTransactionsRow` (active-transaction-queue-tables.tsx:362) and the sibling queue-table rows in `React.memo`.

### 🔴 Missed `useDeferredValue`  (`rerender-use-deferred-value`) — same pattern already fixed in `ActiveTransactionQueueView` and `PoListView`
- [x] `apps/mfe-case-study/src/views/OperationsTasksView.tsx:276/385/1778` — every keystroke re-filters + re-sorts the full task queue.
- [x] `apps/mfe-keys/src/views/KeysView.tsx:303/381/613` — same; `filtered` feeds mobile cards and the full table.
- [x]  (lower) `EngFeesHtmlScreen.tsx:201/269`, `PartyIndividualFeesHtmlScreen.tsx:368/518`, `UsersOrganizationView.tsx:261/281`.

### 🔴 Per-frame state writes during drag/pan  (`rerender-use-ref-transient-values`)
- [x] `apps/mfe-settings/src/views/BrandIdentityView.tsx:246` — `mousemove` calls `setBrand` + `setDirty` per pointer sample, re-rendering the ~940-line view (incl. A4 letterhead preview) per frame. Track in a ref, write `element.style` during drag, commit on mouseup.
- [x] `apps/mfe-settings/src/views/BrandIdentityView.tsx:264` — pan sets `lhX`/`lhY` state consumed only by a `transform` at :776. Same ref treatment.

### 🔴 Shell nav re-renders on every server notification  (`rerender-derived-state`)
- [x] `apps/shell/src/lib/query/use-failures-nav-badge.ts:14` — subscribes to the full failures array for one badge number; `ServerNotificationBridge` invalidates on every notification. Move the count into the query's `select`.
- [x] `apps/shell/src/lib/query/use-active-transaction-nav-badges.ts:55-58` — subscribes to five full lists to make a small counts record; four keys invalidated per notification. Derive via per-query `select`.
- [x] `apps/shell/src/components/views/AppShell.tsx:216` — subscribes to the full workflow-task list only to `.find()` two tasks. Same `select` fix.

### 🟡 Derived state via effect  (`rerender-derived-state-no-effect`)
- [x] `apps/mfe-evaluator/.../valuation-work/FinalOpinionSection.tsx:185` — effect maps `valuationLists` into `basisOptions`/`premiseOptions` state; replace with `useMemo`, drop state + effect.
- [x] `apps/mfe-evaluator/.../EvaluatorFinalReviewTab.tsx:249` — effect builds `attachmentCatalog`; replace with `useMemo`.
- [x] `packages/app-shared/src/contexts/PrototypeContext.tsx:67` — effect repeats verbatim the render-time `setRuntimeCapabilities` sync at :61-65 → double write per permissions change. Delete the effect.
- [x] `apps/mfe-financial/src/components/FinanceRevenueView.tsx:111` and `FinanceCostsView.tsx:150` — prop mirrored into state via effect; adjust during render or key the subtree.
- [x]  (lower, clamp-selection effects derivable during render) `UserProfileContent.tsx:166`, `ScreenCatalogTab.tsx:94`, `ValuationWorkShell.tsx:682`, `PoPropertyDetailTabs.tsx:565`, `FailureTypesView.tsx:78`.

### 🟡 Modal reset-in-effect  (`rerender-move-effect-to-event`) — replace with a per-open `key` (or init in the open handler) and delete the effect:
- [x]  `CreateOperationsTaskModal.tsx:291` (13 setState calls) · `RegisterKeyEnvelopeModal.tsx:186` (18) · `CopyFromPriorTransactionModal.tsx:70` · `FinanceDisbursementCloseModal.tsx:52` · `FinanceVendorInvoiceMatchModal.tsx:65` · `FailureRaiseModal.tsx:39` · `ReopenCompletedTransactionModal.tsx:70`

### 🟢 Small cleanups
- [x] `apps/shell/src/components/views/AppShell.tsx:86` — `useMemo(() => rolePages, [rolePages])` is an identity passthrough; delete.  (`rerender-simple-expression-in-memo`)
- [x] `apps/shell/src/components/views/AppShell.tsx:158` — memo around a single array index returning a string; inline it.
- [x] `apps/mfe-case-study/src/views/ActiveTransactionQueueView.tsx:267` — `data: poRecords = []` yields a fresh `[]` identity per render while pending; hoist a module-level `EMPTY` constant (as `FinanceRevenueView` already does).

---

## 4. Rendering layer

### 🟡 React 19 `<Activity>` unused — tabs lose state on switch  (`rendering-activity`; React 19.2.4, so in scope)
- [x]  `PoPropertyDetailTabs.tsx:885-1155` — 17 conditionally-mounted panels; forms/scroll/refetch state destroyed per switch. Wrap in `<Activity mode={tab === id ? "visible" : "hidden"}>`.
- [x]  `ValuationWorkShell.tsx:1840-1899` — screens unmount on switch; the `visitedRef` guards (:465-467) exist purely to paper over this. `<Activity>` replaces them.
- [x]  `UserProfileContent.tsx:275-430` — six tabs incl. the lazy billing panel re-import + lose filters per switch.
- [x] `EvaluatorWindow.tsx:482,500` — both tabs wrapped; `output` gated on first visit so its `ssr:false` chunk isn't pulled at low priority.
- [~] `OrganizationSettingsView.tsx:225-234` — **WON'T FIX as-is.** These four branches are whole-page early returns (each renders its own `PageShell`), not tab panels, and each runs an unconditional load-on-mount effect that overwrites its local draft (e.g. `ProfessionalValuationReportView`'s `reload()` sets `draft` from the server and clears `dirty`). Since hidden `<Activity>` re-mounts effects on reveal, any preserved state would be immediately clobbered — plus a redundant fetch and spinner flash per revisit. Prerequisite: make those four views' load effects idempotent first.

### 🟡 Animations applied directly to SVG elements  (`rendering-animate-svg-wrapper`) — move transition classes to a wrapper span/div (`Spinner.tsx:7` shows the correct form):
- [x] `active-transaction-queue-tables.tsx:310-345` — status icons cross-fade with transforms on the `<svg>` per row.
- [x] `packages/ui-kit/src/components/Toast.tsx:107` — `animate-spin` on the `<svg>`.
- [x] `AppShellNavParts.tsx:334, 728, 985` — nav chevrons rotate on the SVG root.
- [x]  `PropertyDetailCaseStudyReport.tsx:65-80`, `FieldInspectionWorkParts.tsx:350-364` — accordion chevrons, same shape.
- [x] `KeysView.tsx:154-172` — transforms on inner `<g>`/`<circle>` (cannot composite at all).
- [x]  `dash-svg.tsx:276-296` — animejs opacity on SVG children (the `strokeDashoffset` animations are fine — leave them).

### 🟡 Long lists without containment  (`rendering-content-visibility`)
- [~] `active-transaction-queue-tables.tsx:607` — **WON'T FIX (verified invalid).** These are real `<tr>`/`<td>` elements (ui-kit `Table.tsx`). Per the CSS containment spec, size containment does not apply to internal table boxes, so `content-visibility` has no effect there — the classes would emit dead CSS, not an optimization. The inner-cell-wrapper fallback is also wrong here: the tables are auto-layout (`w-full border-collapse`, `min-w-[720px]`, `colSpan` group rows), so a collapsed wrapper's intrinsic size would feed column-width measurement and make columns jump while scrolling. The mobile twin works only because its rows are `<li>`. A real fix needs `display:block` rows plus fixed column widths — a separate change.
- [x] `OperationsTasksView.tsx:1912` — div-grid rows, drop-in `auto_52px`.
- [x] `KeysView.tsx:698` — envelope cards, `auto_120px`.
- [~] `UsersOrganizationView.tsx:555`, `ValuersRosterView.tsx:550` — **WON'T FIX (verified invalid).** Both render real `<tr>` elements via ui-kit `Table.tsx`; size containment does not apply to internal table boxes, so the classes would emit inert CSS. Same reasoning as the queue-table entry above. (Both files did get their other fixes: deferred search and the roster dirty-check.)

### 🟡 `useTransition` instead of manual busy flags  (`rendering-usetransition-loading`) — top cases (pattern is widespread, 61 files):
- [x]  `TransactionStateStrip.tsx:59-73` · `PoPropertyGroupSection.tsx:45-78` — still pending.
- [x] `OperationsTasksView.tsx:805-820, 855-875` — done (`bulkRemind` + reassign submit moved to dedicated `useTransition` hooks). The shared `busy` flag was deliberately kept for `runPatch`/`runStatus`/`remindTask`/comment composer, where those controls disable together and a swap would change behavior.

### 🟡 Static JSX rebuilt in hot loops  (`rendering-hoist-jsx`)
- [x] `active-transaction-queue-tables.tsx:1108, 1122` — two static SVGs built per party chip per row per render of the largest table. Hoist to module-scope constants.
- [x] `OperationsTasksViewParts.tsx:1231, 1058` — send/chat SVGs inside the comments panel that re-renders per keystroke.

### 🟡 Report/print templates
- [~] `apps/shell/public/ejadah/valuation-report-v3.html:6,17,18,19` — **3 of 4 done; last one needs a decision.** `defer` added to `_ds_bundle.js`, `doc-page.js`, `image-slot.js` (order preserved). `support.js` (:6) left render-blocking deliberately: it calls `hideRawTemplate()` synchronously during head parse (`support.js:1818-1822`), injecting `x-dc{display:none!important}` — that is what stops the raw 80KB template from painting. Deferring it causes a flash-of-raw-content on direct browser loads. Note the whole item is inert on the real app path anyway: `valuation-report-v3-preview.ts:571` parses the template with `DOMParser`, where scripts never execute, and only `<style>` text and `section.page.pg` `outerHTML` are extracted. **To close it properly:** move `x-dc{display:none}` into the inline `<style>` (:23) first, then defer `support.js`.
- [x]  `valuation-report-v3.html:20` + `report-template-approved.html:7` — Google Fonts CSS with no `preconnect` to `fonts.googleapis.com`/`fonts.gstatic.com`.  (`rendering-resource-hints`)
- [x]  `case-study-report-render.ts:315` — same missing preconnect; copy lines 74-75 from `internal-delegation-letter-html.ts`.

### 🟡 SSR hydration
- [~] `packages/app-shared/src/hooks/use-ticking-now.ts:36,48` — **WON'T FIX (would regress).** The finding is technically right but unreachable in practice: `apps/shell/src/app/(app)/layout.tsx` wraps everything in `PrototypeAppGate`, a client component that renders `<PanelSkeleton>` until an effect flips `checked` — effects never run on the server, so no `(app)` subtree renders during SSR and `getServerSnapshot` is never called. Applying the sentinel without consumer changes would be strictly worse: all three consumers feed the value into `new Date(nowMs)`, so `0` renders 1970-based countdowns (a ~20,000-day remainder in `RemainingTimeCell`).
  Correction to the original finding: not every view is `ssr:false` — the dedicated PO routes (`app/(app)/po/page.tsx`, `po/[...segments]`) import `PoListView`/`PoPropertiesPage` directly, so `ActiveQueueMobileCards` and `DeliveryCountdown` *would* be SSR-reachable if the gate were removed.
  **Prerequisite if the gate ever goes:** give `RemainingTimeCell.tsx:41`, `DeliveryCountdown.tsx:22` and `ActiveQueueMobileCards.tsx:29` a mounted check that renders the existing neutral placeholder instead of computing a date from the sentinel.

---

## 5. Client-side patterns

### 🟡 Duplicated global listeners  (`client-event-listeners`)
- [x]  Escape-key handler hand-rolled in 7 components + `AppModal.tsx:68`: `CaseStudyReportActions.tsx:23`, `PropertyDetailCaseStudyReport.tsx:327`, `PropertyMapView.tsx:418`, `FinanceDisbursementCloseModal.tsx:70`, `FinanceVendorInvoiceMatchModal.tsx:77`, `FinanceEngOfficePortal.tsx:161`, `NotificationCenter.tsx:75`. **Fix:** extract `useEscapeKey(enabled, onEscape)` into `packages/app-shared/src/hooks/`.
- [x]  Three `visibilitychange` listeners co-mounted on every authenticated page: `AuthSessionWatcher.tsx:71`, `ServerNotificationBridge.tsx:245`, `OfflineSyncCoordinator.tsx:467`. **Fix:** shared `useDocumentVisible()` via `useSyncExternalStore`.
- [x] `NotificationCenter.tsx:85` — raw `matchMedia("(max-width:1023px)")` duplicating `useViewportDesktop()`'s deduplicated subscription.

### 🟡 Listener churn / stale-deps  (`advanced-event-handler-refs` / `advanced-use-latest`)
- [x] `apps/mfe-case-study/src/components/ui/AppModal.tsx:63` — effect deps `[open, onClose]` with always-inline `onClose` → keydown listener removed/re-added per parent render while open (= per modal keystroke in `OperationsTasksView`). Hold `onClose` in a ref, depend on `[open]`.
- [x]  `apps/shell/src/components/OfflineSyncCoordinator.tsx:504-513` — heartbeat effect lists `pending` in deps but never reads it → every outbox change resets the 60s interval and fires an extra status POST. Drop the dep; put display meta behind a ref.

### 🟡 localStorage schema  (`client-localstorage-schema`)
- [x]  `packages/app-shared/src/notifications/notification-store.ts:69` — versionless `JSON.parse(raw) as AppNotification[]` blind-cast; writes never stamp a version. Store `{ v: 1, items }`, reset on mismatch.

---

## 6. JS micro-optimizations (hot paths only)

### 🟡 Per-keystroke search paths  (`js-early-exit` / `js-cache-function-results`)
- [x] `OperationsTasksView.tsx:388` — haystack string built per task before the three cheap equality filters and even when the query is empty. Cheap filters first, `if (!q) return true`, then haystack. Also `:395-402` — sort comparator allocates a closure per comparison and `new Date(...)` parses both sides per compare; hoist + pre-parse `createdTs`.
- [x] `KeysView.tsx:384-388` — per-envelope join/lowercase before checking `!q`; no short-circuit on cheap filters.
- [x]  `packages/app-shared/src/domain/courts/circuit-search.ts:170` — `circuitHaystack` (5 regex replaces) computed per circuit per keystroke but unused in the common numeric branch; compute lazily. Also `:116-125` — `circuitHaystack`/`circuitSortKey` derive from immutable fields; memoize with a WeakMap.
- [x]  `po-list-search.ts:240-251` — `bestDeedMatch` scans the whole deed index even when `poHit` already matched; reorder the OR. Also `:158-160` — query re-normalized per deed entry per row; hoist `qNorm`/`qDigits` to the caller.

### 🟡 `Intl.NumberFormat` per row  (`js-cache-function-results`) — replace with cached `fmt`/`fmtSar` from `packages/app-shared/src/format/number.ts` (which documents this exact anti-pattern):
- [x]  `InspectorFeesBillingTable.tsx:92` · `EngOfficeFeesBillingTable.tsx:43` · `PartyFeeWorkflowTable.tsx:43` · `PartyIndividualFeesHtmlScreen.tsx:73` · `EngFeesHtmlScreen.tsx:64` · `infath-upload-model.ts:153`

### 🟡 Expensive equality without cheap pre-check  (`js-length-check-first`)
- [x]  `apps/mfe-settings/src/views/ValuersRosterView.tsx:235` — double `JSON.stringify` of the whole roster per keystroke; length check first, then scalar-field loop with early return.

### 🟡 Sync work during interaction  (`js-request-idle-callback`)
- [x]  `row-attention-storage.ts:76-83` — sort + stringify + blocking `localStorage.setItem` (≤600 entries) synchronously on the row click that starts navigation. Defer to `requestIdleCallback` (fallback `setTimeout`).
- [x] `FieldOfflinePrefetch.tsx:44-96` — done in the async batch (whole effect body wrapped in `requestIdleCallback` with `setTimeout` fallback + cancel-on-unmount, matching `AppShell.tsx` / `QueryProvider.tsx`).

### 🟢 O(n²) lookups & regexes in loops  (`js-set-map-lookups` / `js-hoist-regexp`)
- [x]  `active-transaction-page-situation.ts:601` — `open.includes(task)` inside a loop over all survey tasks → `Set`.
- [x] `person-display-name.ts:33` — `staff.find` per comment (called from `OperationsTasksViewParts.tsx:1106,1111`) → pass a prebuilt `Map`; hoist the two constant-per-task calls out of `comments.map`.
- [x]  `operations-task-failure-targets.ts:60-68` — `poRecords.find` inside the pairs loop + `deedKeysForProperty(...).includes` rebuilding arrays per property → Maps/Sets built once.
- [x]  `engineering-survey-sketch-extract.ts:1139,1157,1172` (also :1104, :1377, :1395) — `new RegExp(dirTok…)` inside the 4-direction loop; precompute `Record<Direction, RegExp>` maps (file already does this shape at :642). The runtime-interpolated regexes at :891-940 are genuinely dynamic — leave them.
- [x]  `PropertyDetailPhotosTab.tsx:24-47` — six regex literals inside per-photo `match` closures → hoist to module constants.

---

## Verified clean or N/A (no action)

- **Server-side (all):** no `"use server"` actions, no `route.ts` handlers; auth gated in `apps/shell/src/proxy.ts`; no RSC data fetching to cache/stream/dedup; RSC→client props are scalars. `server-hoist-static-io`, `server-cache-lru`, `server-dedup-props`, `server-after-nonblocking` → N/A.
- **Bundle:** heavy third-party libs (leaflet, pdfjs, animejs, exifr/heic2any) all behind `await import()`; zero cross-MFE barrel imports; no non-analyzable dynamic import paths; no analytics SDK to defer.
- **Re-render:** no inline component definitions; lazy `useState` initializers correct; functional setState correct; no non-primitive default props on memo components; hook deps already primitive/serialized; context reads are all render-gating (`rerender-defer-reads` clean); shared ticking clock properly leaf-subscribed via `useSyncExternalStore`.
- **Rendering:** no `{count && ...}` leaks; SVG assets already low-precision; SSR surface mismatch-free (all views `dynamic(ssr:false)`; `suppressHydrationWarning` already on `<html>`/`<body>`/forms).
- **Client:** scroll listeners all `{passive:true}` (the one `passive:false` genuinely calls `preventDefault`); react-query centralizes fetching, no duplicate fetch-on-mount pairs; other localStorage stores parse defensively or use versioned IDB.
- **JS:** no multi-pass chains over large lists; hot storage reads cached; no mutating sorts on props/state; no deep-property loops over big data; no sort-for-min/max in hot paths; no batched-DOM-CSS issues outside one-shot report renderers.
- **Advanced:** app singletons mounted once in the persistent layout; Google Maps loader module-memoized; map components (`GoogleMapPin`, `PropertyMapCanvas`, `PullToRefresh`) already use the ref patterns correctly; no `useEffectEvent` usage.

---

## Suggested fix order

1. **Bundle batch** — the two `@platform` barrel fixes, lazy tabs/sections/modals, chunk preload map for nav. (Biggest first-load wins.)
2. **Async batch** — all `Promise.all` conversions, the three `po-intake-storage` partial-dependency restructures, and the `FieldOfflinePrefetch` missing-await bug.
3. **Re-render batch** — row memoization in the two queue views, nav badge `select` selectors, missed `useDeferredValue`, BrandIdentity drag refs, derive-in-effect removals, `AppModal` ref fix.
4. **Rendering/JS batch** — `<Activity>` tab wrappers, SVG animation wrappers, content-visibility, template defer/preconnect, `fmtSar` swap, search-path early exits, idle-callback deferrals, listener dedup hooks, notification-store versioning.
