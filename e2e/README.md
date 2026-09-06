# End-to-end tests

Playwright specs that drive the real shell (Next.js) against the real API
gateway. There are no mocks except where a spec explicitly stubs a route
(`failures-optimistic-rollback.spec.ts`).

## Prerequisites

Everything must already be running — the suite never starts it:

| Thing | Where | Check |
| --- | --- | --- |
| Shell (Next.js) | `http://127.0.0.1:3000` | `/login` answers 200 |
| API gateway | `http://127.0.0.1:5160` | `/health` answers 200 |
| Services | `127.0.0.1:5161`–`5169` | each `/ready` answers 200 |

Always use `127.0.0.1`, never `localhost` — the auth cookie and the API base are
resolved from the host name. `e2e/global-setup.ts` fails fast with a readable
message if either the gateway or the shell is down.

Overridable env vars: `SHELL_BASE_URL` (default `http://127.0.0.1:3000`) and
`API_HOST` (default `127.0.0.1`).

The dev database must carry the demo seed (`backend/tools/DevSeed`): the demo
users, the Infath client, the courts/regions catalogs, and the distribution
assignee slugs `fi-ahmed` / `val-abdullah` / `eo-jeddah` / `cs-osama`.

## Running

```bash
npx playwright test                      # everything
npx playwright test --reporter=list      # everything, one line per test
npx playwright test e2e/tests/journeys/inspector-submit-and-accept.spec.ts
npx playwright test -g "intake"          # by title
```

`workers: 1` and `fullyParallel: false` — the journeys write to a shared
database, so they must not overlap.

## Personas

`e2e/fixtures/auth.ts` maps every persona to its seeded demo mobile and logs in
passwordlessly through the API, then seeds the browser session:

- `localStorage` **and** `sessionStorage` under the `auth` key —
  `getAuthSession()` reads `localStorage` first, so a journey that switches
  persona mid-test must overwrite both.
- the `ree-auth` cookie — `apps/shell/src/proxy.ts` (Next 16 renamed
  `middleware.ts` to `proxy.ts`) redirects any non-prefetch navigation without
  it to `/login`, which silently turns a deep link into the persona's landing
  page instead of failing.

| Persona | `RELEASE_USERS` key | Landing |
| --- | --- | --- |
| `sliman` | `cdo` | `/dashboard` |
| `osama` | `caseSpecialist` | `/po` |
| `ahmed` | `fieldInspector` | `/operations-tasks` |
| `abdullah` | `appraiser` | `/operations-tasks` |
| `feras` | `governmentReviewer` | `/operations-tasks` |
| `jeddah_survey` | `engineeringOffice` | `/operations-tasks` |
| `eman` | `financialOfficer` | `/financial` |

## The transaction fixture

`e2e/fixtures/transaction.ts` builds a disposable transaction per run through
the API, mirroring what the UI does, and tears it down in `afterAll`:

```
POST /api/work-orders                              intake (header, optionally with a property)
POST /api/work-orders/{po}/properties               property added after a UI-only intake
POST /api/workflow-tasks/sync                       materialise the case-study slots
POST /api/workflow-tasks/{id}/advance-after-enfath  binds the property to the slot
PUT  /api/work-orders/{po}/properties/{id}/bourse   bourse-stage fields
POST /api/workflow-tasks/{id}/advance-after-bourse  (silently no-ops if bourse data is missing)
POST /api/workflow-tasks/{id}/confirm-distribution  spawns the three party children
```

It also provides `tinyPngBuffer()` / `tinyPdfBuffer()` (real PNG and PDF bytes —
the upload gate sniffs the magic numbers), `uploadAttachment()`,
`submitFieldInspection()`, `clearPoIntakeDraft()` and `deleteWorkOrder()`.

PO numbers are `E2E-<timestamp>-<n>` and deed numbers are freshly generated
12-digit strings, so every spec is independent and re-runnable.

Notable fixture choices:

- the property is a **built** property (`propertyType: "فيلا"`), because vacant
  land hides the الواجهة / حالة البناء proof-photo cells the inspector journey
  exercises;
- it carries `planNumber` + `plotNumber`, which makes the engineering office's
  site-validity letter optional
  (`PartyTaskSubmissionPayloadRules.RequireSiteLetterUnlessPlatted`);
- the PO intake draft is cleared before the intake journey — the modal autosaves
  on every keystroke and only clears the draft after a successful save, so an
  aborted run would otherwise pre-fill the next one.

## Journeys (`e2e/tests/journeys/`)

Each spec's header comment states exactly which steps are UI-driven and which
are API-driven, and why.

### `specialist-intake-to-distribution.spec.ts` — osama

UI: opens `أمر عمل جديد`, fills and saves the intake modal, lands on
`/po/<po>/property`; asserts the **server-paged** `البيانات الأولية` queue
(range label `عرض … من … نتيجة`, `الصفحة السابقة` / `الصفحة التالية`) and that
searching by PO number finds exactly one row; then asserts the three party
assignees in the property detail's `حالة الأطراف` panel and the
`توزيع المعاملة` timeline entry.

API: registering the property and walking the parent task
enfath → bourse → distribution — the intake modal always posts
`properties: []`, and confirm-distribution has no single-screen UI equivalent.

### `inspector-submit-and-accept.spec.ts` — ahmed, then osama

UI: the `/active-inspection` queue (search + open), then the whole three-step
wizard — coordinates and `تثبيت الموقع`, the access-contact block, the feature
values, the two proof photos (`الواجهة`, `حالة البناء`) uploaded through the
real `input[type=file]` and asserted to flip from `إرفاق صورة` to `مرفقة`, the
declaration checkbox, and `حفظ وإرسال`; then the specialist's property-detail
timeline showing `إتمام المعاينة الميدانية` and `استلام بيانات المعاينة`.

API: the specialist's **accept**. There is no accept control on the
`معاينة العقار` tab — `PropertyDetailPartyPackageReview` is mounted only on the
survey and appraisal tabs — so acceptance goes through
`POST /api/party-task-submissions/{taskId}/accept` and the assertion is the
timeline entry it writes.

### `engineering-office-survey.spec.ts` — jeddah_survey, then osama

UI: the `/active-survey` queue, the read-only workspace and its
`بدء الرفع المساحي` hand-off into `/entry`, `#eng-lat` / `#eng-lng`, the PDF
dropzone (asserting the dropzone unmounts and is replaced by a chip carrying the
file name plus a `حذف الملف` button), the site-confirmation declaration, all 13
checklist rows, and `إرسال الرفع المساحي`.

API: the sibling field inspection — the engineering office is blocked until it is
completed (`DocumentaryWorkflowRules.SurveyWorkBlockReason`).

The specialist's `قبول المخرجات` test **skips** while the engineering-survey
party-fee pricing table has no area tiers (see *Known gaps* below).

### `appraiser-report-to-issuance.spec.ts` — abdullah, then osama

UI: the evaluator workspace — `بدء التقييم` (which is the first real save,
`PUT …/approach-settings`), the toast, the screen tabs it unlocks
(`طريقة المقارنة`, `طريقة المقاول`), and the final-opinion screen
(`الرأي النهائي للقيمة`, `اعتماد التقييم — شروط الإصدار`).

API: the transaction plus completing **and accepting** the field inspection —
the appraiser cannot start until the inspection package is specialist-accepted
(`WorkflowTaskDto.FieldInspectionAccepted`).

The specialist's `تقييم العقار` report-panel test **skips** while the case
specialist is denied `GET /api/valuation-requests/open-by-property` (see
*Known gaps*).

Evaluator screen switches are `role="tab"` buttons inside
`aria-label="أقسام نافذة التقييم"` — not plain buttons. The older ad-hoc driver
`e2e/.smoke-evaluator.mjs` still uses `getByRole("button", …)` and is stale.

### `finance-billing.spec.ts` — eman, plus osama for the paged list

UI: `/financial`, the `التكاليف` payees area, and the engineering office's dues
account — its four account tabs, its `بحث المستحقات` ledger search, and the copy
that names the survey line scope; plus the server-paged work-order/billing list
on `/po` (range label, prev/next, `aria-current="page"`, a `pageSize=10`
request, at most 10 rows on a page, and the `مفوتر بالكامل` billing bucket in
the status filter).

API: the transaction, the field inspection, and the survey submission — each has
its own UI journey.

The ledger-row test **skips** for the same pricing reason as the survey accept.

## Known gaps found while writing these journeys

1. **Engineering-survey fees cannot be accrued.** The seeded
   `engineering-survey` party-fee pricing table has an empty `areaTiers`, so
   `POST /api/party-task-submissions/{id}/accept` for a survey fails with
   `تعذر تحديد الأتعاب من جدول التسعير — راجع ضبط الأسعار.` and no dues row is
   ever created. Both the survey-accept test and the finance ledger test skip
   with that reason and will start running as soon as a tier is configured under
   `/fee-pricing`.
2. **The case specialist cannot read the valuation request.**
   `GET /api/valuation-requests/open-by-property/{id}` is gated by the
   `ReadValuationQueue` capability, which `case-specialist` does not hold. The
   `تقييم العقار` tab therefore always renders
   `تعذّر تحميل تقرير التقييم` / `أعد المحاولة لاحقاً أو تحقق من الاتصال.`
   instead of the final-report panel. The CDO gets 200 on the same call.
3. **Desktop inspector wizard cannot satisfy its own photo rules.**
   `carEntrance` / `hasBasement` / `hasElevator` / `hasPool` / `kitchen` render
   in `مكوّنات العقار` as toggle pills with no upload control, yet answering
   `نعم` makes a proof photo mandatory
   (`listInspectorPhotoValidationIssues`). The journey answers all of them `لا`;
   a real inspector who answers `نعم` on the desktop wizard cannot submit.
4. **No finance screen is paged.** `/api/party-billing-statements` and
   `/api/enfaz-billing/*` return plain arrays with no paging parameters, and no
   screen under `/financial` renders a pager — the only server-paged billing
   list is the work-order list on `/po`, which the finance officer cannot reach.
