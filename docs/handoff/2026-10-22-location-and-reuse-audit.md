# Handoff — 2026-10-22: property location, bourse area, reuse audit

Branch: `dev2`. None of this is on `main` or deployed yet.

## Done (on dev2)

| Commit | What |
|---|---|
| 94acb204 | The appraiser's comparables bank uses the inspector's pin (EvaluatorWindow now passes `inspectionTaskId`). This was the actual fix for PO-067355 (الخرج showing Riyadh comparables). |
| bd3cec96 | «مساحة الأرض (م²)» is required to complete the bourse, client and server. |
| 04e32990 | Region/governorate city table — **superseded** by the commit below (it removes that table). |
| 9fda5615 | `propertyToEnfathDto` sends `area` and `deedStatus`, so saving the primary data no longer wipes them. |
| (this commit) | `packages/app-shared/src/domain/property-geo.ts` deleted: no location is ever guessed from the city name. |

### What the property-geo deletion changed

- `coordsFromLocationMapUrl` moved to `packages/app-shared/src/domain/geo.ts` (real data, kept).
- Without the inspector's pin (or a map link from the intake):

| Screen | Now |
|---|---|
| Comparables bank | matches comparables by city (`normalizeArabicSearchText` + «محافظة/مدينة» prefix strip) |
| Valuation report | prints no subject location; inspector pin only |
| Live records map | property stays off the map |
| Inspector map (wizard + field) | opens on the whole Kingdom until the pin is placed |
| Property detail map | inspector pin only |

- Removed as unused: the fallback params of `resolveSubjectMapCoords` / `collectComparablesMapPins`, the `property` prop of `MobileInspectMap` / `InspectorLocationCard` / `inspectorWizardMapGeo`, the re-exports in `po-intake-boundaries` / `po-intake-data`.
- Frontend: 2,094 tests pass, typecheck clean, lint 0 errors.

## Open — reuse audit of this session's commits (needs approval; items 1, 2, 4 and 6 touch logic)

### Behaviour risks first

1. **Final report status ignores replaced copies** (5f3aa175).
   - Where: `ValuationRequestService.GetFinalReportStatusByPropertyAsync` (`backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ValuationRequestService.cs:62`).
   - Problem: it takes the newest issuance without `SupersededAtUtc == null`, which every other current-copy reader applies. After a reopen, the Enfaz handover can be judged on a replaced copy.
2. **Two different "invoice issued" tests** (81d9ed2e).
   - Where: `PoEnfazInvoiceRules.cs`. `IssueBlockedReason` checks the status, while the existing `LinesLockedError` checks for an invoice number.
   - Problem: the two disagree when an invoice has no number.
   - Fix: extract one `IsIssued(invoice)` (number present) and use it in both.
3. **`propertyToDto` overrides the trimmed area/deedStatus** (9fda5615).
   - Where: `apps/mfe-case-study/src/lib/app-data/po-intake-model.ts`. The old untrimmed lines in `propertyToDto` now override the trimmed ones from `propertyToEnfathDto`.
   - Fix: delete the old lines.

### Duplicates of existing code

4. **`MaySubmit` repeats `MayWriteDraft`** (`PartyTaskSubmissionRules.cs`, 83f34f21).
   - Fix: `MaySubmit` = `MayWriteDraft(actor, task, task.Kind == FieldInspection && StaffMayCorrectPartyPackage(actor, task))`.
5. **`PropertyFinalReportStatusDto` copies `FinalReportStatusDto`** (5f3aa175).
   - Also, `"preparing"` is hard-coded in `TransactionStateRules.FinalReportBlocksHandover`.
   - Fix: reuse the DTO, and add a final-report wire-constants class next to `ValuationReportStageWire`.
6. **"Positive area" rule** (bd3cec96).
   - Server: `WorkOrderValidator.BourseAreaError` repeats `EngineeringSurveyFeeRules.TryParseAreaM2`.
     - Fix: add `LocaleNumber.TryParsePositive` in shared.
   - Client: `bourseAreaError` repeats `positiveAmount` (`comparable-entry.ts`).
     - Fix: add one `isPositiveLocaleNumber` in `packages/app-shared/src/format/number.ts`.
7. **«أدخله {name}» timeline text written three times** in `WorkOrderPropertyWriteRules.cs` (11e83f44, 56b46a8e).
   - Fix: have the bourse, primary-data and Enfath detail rows share one helper.
8. **Phone UI duplicates** (6eb9fc19).
   - `BottomSheet` repeats `AppModal`, which is already a bottom sheet below `lg`. Only `MobileSectionPicker` uses `BottomSheet`.
   - `AppModal` still has its own copy of the focus/scroll handling. It should use `useSheetDialog`.
   - `ComparablePropertiesPhone` copies `statusPills` / `sourceText` / button classes from `ComparablePropertiesView`.
   - `AuditLogView` and `PoPropertiesPage` hand-roll cards instead of using `MobileRecordCard`.
   - `PhoneField` is byte-identical in `PoPropertyBoundariesEntrySection.tsx` and `SpecialistComponentsTable.tsx`. Near-copies: `PhoneSlot`, `MoneySlot`, `phoneLabelClass`.
   - The segmented-control classes are copied in `AdjustmentsMatrixPhone`.

Checked and fine: inspector-pin wiring, `useViewportDesktop`, `MobileKpiStatCards`, `MobileSectionPicker`, the moved (not copied) cost/adjustment code, and the e2e visible-locator fix.

## Other pending decisions

- **Comparable price-deviation warning («انحراف 72%»)**: it should compare against the same city + district + property type, not the district only. The geocoder also returns some district names in English ("Al Maathar Municipality"). This is server logic, so it needs approval.
- **Deploy**: dev2 has commits that are not on `main`: 81d9ed2e, 8c9ed0fc, 5f3aa175, 7938e5b9 and everything above. Pushing to `main` deploys to production, so get explicit approval first.

## For the team, in the app (no code)

- The specialist enters the land area for the 12 properties whose bourse was completed without it:
  - PO-067355
  - PO-072534, 072783, 072407, 073806, 073815
  - PO-069205, 066623, 066624, 072693, 072781, 067455
- The appraiser corrects or un-adopts comparable CMP-A533C63F (the source of the 72% warning on PO-067355).
