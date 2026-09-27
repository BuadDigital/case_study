# Codebase audit — September 2026

Audit of the whole Ejada codebase (backend contexts and services, gateway, shell and micro-frontends, shared packages, infra/CI) run on 2026-09-26 against commit `0b8736e7` (production at the time).

> The 259 verified findings reduce to 169 distinct issues. The most urgent is critical and in production now: anyone on the internet can sign in as the CDO with just a username, because Auth__EnableDevLogin=true and an anonymous endpoint lists every username. Every deploy also runs the demo seeder against live data, and nothing is backed up. Several offline-sync paths can silently lose an inspector's work. Many write endpoints never check that the caller is assigned to the property. Finance and valuation outputs print wrong or unreadable figures: Arabic text comes out as boxes in server-made PDFs, the land value can be inflated by orders of magnitude, and the tax invoice totals don't add up.

## How this was produced

- 21 auditors each read one area of the code (per backend context, per front-end app/package, infra/CI) or one cross-cutting concern (authorization/IDOR, frontend↔backend contracts, dependencies and secrets, cross-service consistency, tests/CI). A completeness pass then sent 6 more targeted probes: Valuation and invoice math correctness; Time zone, Hijri dates, Arabic digits, numbering; HTML injection and token exposure; Offline device: photos and data at rest; Unread UI modules: valuation, party fees, distribution; Migrations, schema drift and ops scripts.
- Every finding was handed to independent reviewers who read the code and tried to refute it (three reviewers for critical/high, one for medium/low). 272 findings were raised, 13 were refuted and dropped, 259 were confirmed.
- The confirmed findings were merged where several auditors reported the same root cause, which gives the **169 distinct issues** below. The audit was read-only: nothing was changed, built or run against production.
- Line numbers refer to commit `0b8736e7`; they may drift as the code changes.

## Summary

| Severity | Count |
|---|---|
| 🔴 critical | 1 |
| 🟠 high | 34 |
| 🟡 medium | 79 |
| ⚪ low | 55 |
| **Total** | **169** |

Severity: **critical** = data loss, security breach or outage likely now; **high** = wrong behaviour in a main flow or an exploitable weakness; **medium** = real bug in a secondary path or a latent risk with a plausible trigger; **low** = minor real defect.

| Theme | 🔴 | 🟠 | 🟡 | ⚪ | Total |
|---|---|---|---|---|---|
| [Login and accounts](#login-and-accounts) | 1 | 0 | 2 | 1 | 4 |
| [Access control](#access-control) | 0 | 3 | 11 | 3 | 17 |
| [Deploy, infra and CI](#deploy-infra-and-ci) | 0 | 2 | 4 | 9 | 15 |
| [Offline field app](#offline-field-app) | 0 | 13 | 8 | 6 | 27 |
| [Event messaging and service calls](#event-messaging-and-service-calls) | 0 | 2 | 4 | 3 | 9 |
| [Case-study workflow](#case-study-workflow) | 0 | 3 | 6 | 4 | 13 |
| [Failures, keys and operations](#failures-keys-and-operations) | 0 | 1 | 8 | 4 | 13 |
| [Finance and billing](#finance-and-billing) | 0 | 3 | 4 | 7 | 14 |
| [Valuation and report output](#valuation-and-report-output) | 0 | 5 | 8 | 5 | 18 |
| [Saving, concurrency and error handling (UI)](#saving-concurrency-and-error-handling-ui) | 0 | 1 | 10 | 4 | 15 |
| [Dates, numbers and Arabic text](#dates-numbers-and-arabic-text) | 0 | 0 | 6 | 3 | 9 |
| [Settings and admin](#settings-and-admin) | 0 | 1 | 3 | 5 | 9 |
| [Performance and scale](#performance-and-scale) | 0 | 0 | 5 | 1 | 6 |

## Suggested order of work

1. **Now (production exposure):** A-001 (open login — needs a decision: switching `Auth__EnableDevLogin` off without a real OTP locks everyone out), the demo seeder running on every deploy, and production backups.
2. **Next:** the offline data-loss issues, the missing Arabic font in server PDFs, and the cost-approach land value.
3. **Then:** the remaining high issues, then medium and low theme by theme.

## Critical and high — quick list

| ID | Severity | Theme | Issue |
|---|---|---|---|
| [A-001](#a-001) | 🔴 critical | Login and accounts | Production login needs only a username or mobile, and an anonymous endpoint lists all usernames |
| [A-002](#a-002) | 🟠 high | Access control | ✅ **Solved** — Any role can download and delete any attachment |
| [A-003](#a-003) | 🟠 high | Access control | Reporting dashboard is cached under one global key but built with the first caller's token |
| [A-004](#a-004) | 🟠 high | Access control | Government reviewers can read every party's fees and billing statements |
| [A-005](#a-005) | 🟠 high | Deploy, infra and CI | ✅ **Solved** — Every production deploy runs the demo seeder against live data |
| [A-006](#a-006) | 🟠 high | Deploy, infra and CI | No backups of production Postgres or attachments |
| [A-007](#a-007) | 🟠 high | Offline field app | ✅ **Solved** — Each deploy deletes the offline pages and code on field devices |
| [A-008](#a-008) | 🟠 high | Offline field app | ✅ **Solved** — Offline sync writes a stale snapshot back over edits made during the pass |
| [A-009](#a-009) | 🟠 high | Offline field app | ✅ **Solved** — A queued offline save replays after newer online saves and reverts them |
| [A-010](#a-010) | 🟠 high | Offline field app | ✅ **Solved** — Photos taken offline keep local: ids in the open form and overwrite the uploaded ids |
| [A-011](#a-011) | 🟠 high | Offline field app | ✅ **Solved** — A failed inspection read is treated as 'no draft', and a blank draft is saved over the real one |
| [A-012](#a-012) | 🟠 high | Offline field app | ✅ **Solved** — App start logs field users out on any transient token-refresh failure |
| [A-013](#a-013) | 🟠 high | Offline field app | ✅ **Solved** — Non-field roles' saves and submits are queued offline but never replayed |
| [A-014](#a-014) | 🟠 high | Offline field app | ✅ **Solved** — Key-envelope writes with an idempotency key are sent without Authorization |
| [A-015](#a-015) | 🟠 high | Offline field app | ✅ **Solved** — Replacing an attachment deletes the old file first and treats any rejection as 'offline' |
| [A-016](#a-016) | 🟠 high | Offline field app | ✅ **Solved** — Offline court-access updates replay with local: attachment ids and never sync |
| [A-017](#a-017) | 🟠 high | Offline field app | ✅ **Solved** — Key-envelope detail crashes after an offline or network-failed action |
| [A-018](#a-018) | 🟠 high | Offline field app | Inspection limits and building inventory are manual-save and online-only in the inspector form |
| [A-019](#a-019) | 🟠 high | Offline field app | ⚠️ **Partial** — Case-study question chips ignore failed saves and are not kept offline |
| [A-020](#a-020) | 🟠 high | Event messaging and service calls | Background consumers call protected APIs with a service token that carries no capabilities (403) |
| [A-021](#a-021) | 🟠 high | Event messaging and service calls | ✅ **Solved** — Batch lookups put hundreds of GUIDs in GET URLs and fail with 414 past about 200 ids |
| [A-022](#a-022) | 🟠 high | Case-study workflow | ✅ **Solved** — Task-cascade delete endpoints hard-delete live work and paid fee ledgers with no role or state check |
| [A-023](#a-023) | 🟠 high | Case-study workflow | Structure inventory is hard-deleted on a land-type submit or a «لا» tap (against ق-5) |
| [A-024](#a-024) | 🟠 high | Case-study workflow | A reopened completed transaction can never be edited or completed again |
| [A-025](#a-025) | 🟠 high | Failures, keys and operations | Registering an eviction overwrites an existing failure, and lifting it resolves unrelated failures |
| [A-026](#a-026) | 🟠 high | Finance and billing | Discount flags and incentive suspensions skip department scoping and allow self-approval |
| [A-027](#a-027) | 🟠 high | Finance and billing | Cancelling a party billing statement strands its fees permanently |
| [A-028](#a-028) | 🟠 high | Finance and billing | Enfaz invoice is issued from the last-saved lines while the screen shows unsaved totals |
| [A-029](#a-029) | 🟠 high | Valuation and report output | Server-generated report and invoice PDFs print Arabic as boxes in production |
| [A-030](#a-030) | 🟠 high | Valuation and report output | Cost approach multiplies a whole-property land value by land area |
| [A-031](#a-031) | 🟠 high | Valuation and report output | Reconciliation screen and server disagree on weights and final value |
| [A-032](#a-032) | 🟠 high | Valuation and report output | Adopted comparables are silently un-adopted on every load |
| [A-033](#a-033) | 🟠 high | Valuation and report output | Two-stage ق-6 issuance is unreachable and issuance gates run only in the browser |
| [A-034](#a-034) | 🟠 high | Saving, concurrency and error handling (UI) | Property edit reopens an old in-memory autosave instead of server data and writes it back |
| [A-035](#a-035) | 🟠 high | Settings and admin | Changing the certified valuer outside the roster corrupts the roster |

## All issues by theme

### Login and accounts

Production login has no password or OTP, and an anonymous endpoint lists usernames. Staff changes to mobile, name or role are not audited, disabled users' devices are not always wiped, and the refresh-token grace window has gaps.

#### A-001

**🔴 CRITICAL — Production login needs only a username or mobile, and an anonymous endpoint lists all usernames**

- **Where:** [`infra/docker-compose.prod.yml:151`](../../infra/docker-compose.prod.yml#L151), [`backend/services/identity/RealEstateEval.Identity.Api/Controllers/AuthController.cs:34`](../../backend/services/identity/RealEstateEval.Identity.Api/Controllers/AuthController.cs#L34), [`backend/services/identity/RealEstateEval.Identity.Api/Controllers/AuthController.cs:54`](../../backend/services/identity/RealEstateEval.Identity.Api/Controllers/AuthController.cs#L54)
- **Problem:** Auth__EnableDevLogin=true in production enables POST /api/auth/login with no password or OTP; the OTP screen is cosmetic. GET /api/auth/dev-login-users is anonymous and returns every active username, with sliman (CDO) first.
- **Impact:** Anyone on the internet can get a CDO session in two requests and read or change every work order, report, fee and user.
- **Fix:** Set EnableDevLogin=false now. Make the flag fail at startup outside Development, and delete dev-login-users. Ship server-verified password+OTP before re-enabling mobile login, with a test that Production returns 404.

#### A-036

**🟡 MEDIUM — Staff edits that change mobile, name or role are not audited**

- **Where:** [`backend/contexts/identity/RealEstateEval.Identity.Application/Services/UserRegistrationService.cs:231`](../../backend/contexts/identity/RealEstateEval.Identity.Application/Services/UserRegistrationService.cs#L231)
- **Problem:** The identity-changed branch never flushes the queued audit entries. Disable and unlock can commit and still report failure.
- **Impact:** Changes to the mobile number, which is the login identifier, leave no trace (spec §7).
- **Fix:** Flush the audit after UpdateAsync, or better, write audit rows through an outbox in the same transaction.

#### A-037

**🟡 MEDIUM — A disabled user's device is not wiped once their refresh token has expired**

- **Where:** [`packages/app-shared/src/auth/ensure-fresh-session.ts:48`](../../packages/app-shared/src/auth/ensure-fresh-session.ts#L48)
- **Problem:** The client skips the server call for an expired token, so the account-disabled wipe never runs. The login refusal carries no wipe code.
- **Impact:** Encrypted drafts, photos, deeds and the key stay on a personal device indefinitely (§3.4).
- **Fix:** When online, still post the expired token to /refresh, or have login return the disabled code and purge the device.

#### A-115

**⚪ LOW — Refresh-token grace window can revive a logged-out session**

- **Where:** [`backend/contexts/identity/RealEstateEval.Identity.Infrastructure/Services/AuthSessionService.cs:105`](../../backend/contexts/identity/RealEstateEval.Identity.Infrastructure/Services/AuthSessionService.cs#L105)
- **Problem:** A rotated predecessor is accepted within the grace window even after logout or reuse detection, and can mint unlimited siblings.
- **Impact:** A captured token outlives logout.
- **Fix:** Refuse when the session family is revoked, and allow one sibling per token.
- **Status:** ✅ **Solved** (2026-09-26, commit `20d38960` on `dev`; not yet merged to `main`). A grace replay is refused unless the session family still has a live token, and a rotated token gets only one grace sibling. Tests: `AuthSessionServiceTests`.

### Access control

Checks are by capability only, never by assignment. Every role can read and delete any attachment. Government reviewers see all fees. The reporting dashboard cache leaks data between users. Personal and bank data is exposed. The CSP is weak, and there is an open redirect.

#### A-002

**🟠 HIGH — Any role can download and delete any attachment**

- **Where:** [`backend/RealEstateEval.Application/Rules/AttachmentAccessRules.cs:45`](../../backend/RealEstateEval.Application/Rules/AttachmentAccessRules.cs#L45), [`backend/contexts/attachments/RealEstateEval.Attachments.Infrastructure/Services/AttachmentService.cs:191`](../../backend/contexts/attachments/RealEstateEval.Attachments.Infrastructure/Services/AttachmentService.cs#L191)
- **Problem:** Every role holds manage-attachments, which the rule treats as operational access, so the uploader-only branch never runs. DELETE has no state check.
- **Impact:** External offices and cooperators can read deeds, court letters and receipts for any property and delete evidence, including key-envelope financial proof.
- **Fix:** Remove manage-attachments from the bypass and authorize by property or task assignment. Limit delete to the uploader while the record is a draft, or to managers.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). `manage-attachments` is upload-only and no longer a read/delete bypass. Read still allows the uploader, case staff (`CanManagePartySubmissions`), and valuation/finance/operations capabilities. Delete is the uploader or case staff. Tests: `AttachmentAccessRulesTests`, `AttachmentReadAuthorizationTests`.

#### A-003

**🟠 HIGH — Reporting dashboard is cached under one global key but built with the first caller's token**

- **Where:** [`backend/services/reporting/RealEstateEval.Reporting.Api/Controllers/ReportingController.cs:49`](../../backend/services/reporting/RealEstateEval.Reporting.Api/Controllers/ReportingController.cs#L49), [`backend/shared/RealEstateEval.Shared.Contracts/Abstractions/CacheKeys.cs:5`](../../backend/shared/RealEstateEval.Shared.Contracts/Abstractions/CacheKeys.cs#L5)
- **Problem:** The 60 s cache key has no user or role component, while the upstream data is filtered for whoever called first.
- **Impact:** Field inspectors and offices see the CDO's fees, failures and team loads, and managers sometimes see a single inspector's slice.
- **Fix:** Put the caller's scope in the key, or build with a service identity and filter per caller. Don't cache sections that soft-failed.

#### A-004

**🟠 HIGH — Government reviewers can read every party's fees and billing statements**

- **Where:** [`backend/contexts/identity/RealEstateEval.Identity.Infrastructure/Permissions/PlatformPermissionCatalog.cs:124`](../../backend/contexts/identity/RealEstateEval.Identity.Infrastructure/Permissions/PlatformPermissionCatalog.cs#L124), [`backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/InspectorFeesController.cs:213`](../../backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/InspectorFeesController.cs#L213), [`backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/PartyBillingStatementsController.cs:130`](../../backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/PartyBillingStatementsController.cs#L130)
- **Problem:** 'Operations manager' is decided by the manage-operations claim, which the government-reviewer field role holds.
- **Impact:** A paid party sees other inspectors' and offices' fees, discounts and statements across all departments.
- **Fix:** Decide by prototype role, or give reviewers a narrower key-custody capability.

#### A-038

**🟡 MEDIUM — Property-level party writes do not check assignment**

- **Where:** [`backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/InspectionLimitsController.cs:33`](../../backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/InspectionLimitsController.cs#L33), [`backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/BuildingInventoryService.cs:30`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/BuildingInventoryService.cs#L30), [`backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/WorkOrdersController.cs:336`](../../backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/WorkOrdersController.cs#L336)
- **Problem:** Inspection limits, building inventory, map URL and specialist report extras accept any holder of the capability, for any PO or property.
- **Impact:** Any inspector or office can wipe another property's structures, change its scope (which clears the ق-7 approval) or alter what the report prints.
- **Fix:** Require a case-staff role or an assigned open party task on that property, and gate the GETs too.

#### A-039

**🟡 MEDIUM — Any appraiser can give the ق-7 desktop-scope approval for any property**

- **Where:** [`backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/InspectionLimitsService.cs:85`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/InspectionLimitsService.cs#L85)
- **Problem:** Approval checks the scope state but not who the appraiser is.
- **Impact:** The blocking gate can be satisfied by an appraiser unrelated to the property.
- **Fix:** Require the actor to be the appraisal assignee or the signatory.

#### A-040

**🟡 MEDIUM — Distribution-assignees endpoint returns national ID, IBAN, tax number and fees to non-admin roles**

- **Where:** [`backend/services/identity/RealEstateEval.Identity.Api/Controllers/DistributionAssigneesController.cs:12`](../../backend/services/identity/RealEstateEval.Identity.Api/Controllers/DistributionAssigneesController.cs#L12), [`backend/contexts/identity/RealEstateEval.Identity.Infrastructure/Persistence/RegistrationMapper.cs:21`](../../backend/contexts/identity/RealEstateEval.Identity.Infrastructure/Persistence/RegistrationMapper.cs#L21)
- **Problem:** The endpoint returns the full user DTO, and reviewers and appraisers can call it.
- **Impact:** Personal and banking data of every assignee is exposed to freelance field roles.
- **Fix:** Return a slim DTO (id, name, role, city, status).

#### A-041

**🟡 MEDIUM — Party users can edit or deactivate any comparable, silently changing adopted valuations**

- **Where:** [`backend/services/valuation/RealEstateEval.Valuation.Api/Controllers/ComparablePropertiesController.cs:84`](../../backend/services/valuation/RealEstateEval.Valuation.Api/Controllers/ComparablePropertiesController.cs#L84), [`backend/contexts/valuation/RealEstateEval.Valuation.Application/Services/ComparablePropertyService.cs:151`](../../backend/contexts/valuation/RealEstateEval.Valuation.Application/Services/ComparablePropertyService.cs#L151)
- **Problem:** WriteComparableBank includes submit-party-work. Edits have no owner, adoption or freeze check and no audit, and selections read the price live.
- **Impact:** An inspector can change a comparable's price and so alter both issued and in-progress valuations, leaving no trace.
- **Fix:** Restrict edits to valuation roles, block edits on adopted or frozen rows (or snapshot the values at adoption), and audit.

#### A-042

**🟡 MEDIUM — Report-PDF endpoint accepts arbitrary HTML and any report number for any request**

- **Where:** [`backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ValuationReportPdfService.cs:82`](../../backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ValuationReportPdfService.cs#L82), [`backend/services/valuation/RealEstateEval.Valuation.Api/Controllers/ValuationReportPdfController.cs:29`](../../backend/services/valuation/RealEstateEval.Valuation.Api/Controllers/ValuationReportPdfController.cs#L29)
- **Problem:** Any appraiser can post HTML and a report number for any request. It is rendered with JavaScript on, published at a public link for 90 days, and older genuine copies are pruned. No UI calls it any more.
- **Impact:** Forged 'official' reports can be served from the company domain to courts and Enfath.
- **Fix:** Remove the route if the feature is shelved. Otherwise check assignment and state, derive the number server-side, build the HTML on the server, disable Gotenberg JavaScript, and audit.

#### A-043

**🟡 MEDIUM — Web Push endpoints are not validated (SSRF and delivery stalls)**

- **Where:** [`backend/contexts/platform/RealEstateEval.Platform.Infrastructure/Services/PushSubscriptionService.cs:56`](../../backend/contexts/platform/RealEstateEval.Platform.Infrastructure/Services/PushSubscriptionService.cs#L56), [`backend/contexts/platform/RealEstateEval.Platform.Infrastructure/Services/WebPushDeliveryHandler.cs:124`](../../backend/contexts/platform/RealEstateEval.Platform.Infrastructure/Services/WebPushDeliveryHandler.cs#L124)
- **Problem:** Users can register unlimited subscriptions to any URL. Sends are sequential with a 100 s timeout and follow redirects.
- **Impact:** Blind POSTs to internal services, and a push backlog of hours for everyone.
- **Fix:** Allow-list push-service domains, https only, cap subscriptions per user, 10 s timeout, no redirects.

#### A-044

**🟡 MEDIUM — Weak CSP plus tokens in localStorage make any HTML injection an account takeover**

- **Where:** [`apps/shell/next.config.ts:119`](../../apps/shell/next.config.ts#L119), [`apps/mfe-evaluator/src/lib/evaluator/valuation-report-v3-preview.ts:514`](../../apps/mfe-evaluator/src/lib/evaluator/valuation-report-v3-preview.ts#L514), [`apps/mfe-case-study/src/lib/app-data/property-photos-pdf.ts:24`](../../apps/mfe-case-study/src/lib/app-data/property-photos-pdf.ts#L24)
- **Problem:** script-src allows unsafe-inline and unsafe-eval, and connect-src allows any host. Letterhead and photo data URLs are concatenated unescaped into same-origin print documents.
- **Impact:** A crafted letterhead value (admin-set) can run script in the report printer's session and steal their refresh token.
- **Fix:** Use a nonce CSP and restrict connect-src. Set URLs through DOM APIs with strict patterns. Move the refresh token to an HttpOnly cookie.

#### A-045

**🟡 MEDIUM — Open redirect after login**

- **Where:** [`apps/shell/src/app/login/login-ui.tsx:57`](../../apps/shell/src/app/login/login-ui.tsx#L57)
- **Problem:** Only a literal '//' is blocked, so '?from=/\evil.example' passes.
- **Impact:** A genuine Ejada link can redirect staff to a phishing page for their mobile number and OTP.
- **Fix:** Parse with new URL and require the same origin. Reject backslashes and control characters.

#### A-046

**🟡 MEDIUM — Executive signature and company stamp are publicly downloadable**

- **Where:** [`apps/shell/public/case-study/emad-signature.png`](../../apps/shell/public/case-study/emad-signature.png), [`apps/mfe-case-study/src/lib/app-data/case-study-form-data.ts:24`](../../apps/mfe-case-study/src/lib/app-data/case-study-form-data.ts#L24)
- **Problem:** The files are tracked in a public repo and served without authentication, and they are used on official letters and invoices.
- **Impact:** Anyone can forge Ejada reports or invoices addressed to courts or Enfath.
- **Fix:** Remove them from public/ and from git history, serve them through an authenticated endpoint, and make the repo private.

#### A-047

**🟡 MEDIUM — Party-fee pricing tables are readable by any signed-in user**

- **Where:** [`backend/services/financial/RealEstateEval.Financial.Api/Controllers/FinancialController.cs:55`](../../backend/services/financial/RealEstateEval.Financial.Api/Controllers/FinancialController.cs#L55)
- **Problem:** The GET routes have no policy and run seeding writes on read.
- **Impact:** Engineering offices can see every negotiated rate and which offices are on which table.
- **Fix:** Add a ReadFinancialData policy and move seeding to startup.

#### A-048

**🟡 MEDIUM — Recall approval is unreachable for the case specialist**

- **Where:** [`backend/services/valuation/RealEstateEval.Valuation.Api/Controllers/EvaluatorRecallsController.cs:46`](../../backend/services/valuation/RealEstateEval.Valuation.Api/Controllers/EvaluatorRecallsController.cs#L46)
- **Problem:** Approve and reject require manage-valuation-requests (CDO and GM only), and the panel is not mounted for specialists.
- **Impact:** Recall requests stay pending forever.
- **Fix:** Use ManageWorkOrders or a dedicated policy, and mount the panel.

#### A-116

**⚪ LOW — The R3 post-Enfaz decision always rejects the general manager**

- **Where:** [`backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/TransactionStateController.cs:68`](../../backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/TransactionStateController.cs#L68)
- **Problem:** The service compares the JWT identity role ('Editor') with 'general-manager'.
- **Impact:** R3 can never be recorded.
- **Fix:** Pass the prototype role, and add a test.

#### A-117

**⚪ LOW — Task visibility also matches on display name**

- **Where:** [`backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Rules/WorkflowTaskVisibilityRules.cs:43`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Rules/WorkflowTaskVisibilityRules.cs#L43)
- **Problem:** Users with the same name and role see each other's tasks.
- **Impact:** PO, deed and location details leak between users, and queue rows break.
- **Fix:** Drop the name clause and backfill AssigneeId.

#### A-118

**⚪ LOW — Permissions failure falls back to the general-manager role**

- **Where:** [`packages/app-shared/src/contexts/AppAccessContext.tsx:45`](../../packages/app-shared/src/contexts/AppAccessContext.tsx#L45)
- **Problem:** An errored or unknown role defaults to general-manager.
- **Impact:** Users are shown GM navigation and routes.
- **Fix:** Treat this as no access and show a retry screen.

### Deploy, infra and CI

Each deploy runs the demo seeder. There are no backups. Rollback cannot undo migrations. Frontend tests and migration-drift checks do not gate deploys. Every service uses the Postgres superuser. Images, actions and secrets need hardening.

#### A-005

**🟠 HIGH — Every production deploy runs the demo seeder against live data**

- **Where:** [`infra/docker-compose.prod.yml:126`](../../infra/docker-compose.prod.yml#L126), [`backend/tools/DevSeed/DataSeeder.cs:60`](../../backend/tools/DevSeed/DataSeeder.cs#L60), [`backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Data/ComparableBankSeed.cs:191`](../../backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Data/ComparableBankSeed.cs#L191)
- **Problem:** The migrate job runs on every deploy with SeedDemoData=true. Each run re-activates seeded users, re-adds CDO roles and resets phones and passwords (user1234). It also re-activates 14 fake comparable sales and rewrites child-task assignees, including Completed ones, and pricing table assignments.
- **Impact:** Disabled accounts come back and admin changes are undone. Fake 'executed' sales can be adopted in court valuations, and completed work moves to the wrong person.
- **Fix:** Set SeedDemoData=false for production and make DbMigrate refuse to seed in Production. Once in prod: delete the demo comparables and disable the demo accounts.
- **Status:** ✅ **Solved** (2026-09-26, commits `cea3af61` + `cfd22b3c`, deployed to production in `ca4d739a`). The migrate job has `Database__SeedDemoData: "false"`; DbMigrate ignores that flag in Production and refuses `seed` without `--confirm-production`; every deploy runs `retire-demo-data`, which deactivated the 14 demo comparables and disabled `admin@local.dev` in production. Left for a person: 3 production valuations that adopted a demo comparable, 16 active accounts still on demo mobiles (+9665000000xx), and any task/pricing assignments the old seeder rewrote.

#### A-006

**🟠 HIGH — No backups of production Postgres or attachments**

- **Where:** [`infra/docker-compose.prod.yml:531`](../../infra/docker-compose.prod.yml#L531), [`.github/workflows/deploy.yml:403`](../../.github/workflows/deploy.yml#L403)
- **Problem:** All nine databases and every photo and deed file live on local Docker volumes. There is no scheduled dump, no off-host copy and no dump before migrate.
- **Impact:** Disk loss, `down -v` or a bad migration means total, unrecoverable loss of data.
- **Fix:** Schedule pg_dump plus an attachments rsync to off-host storage with retention, dump before every migrate, and rehearse a restore.

#### A-049

**🟡 MEDIUM — All services connect to Postgres as the superuser**

- **Where:** [`infra/docker-compose.prod.yml:153`](../../infra/docker-compose.prod.yml#L153), [`scripts/ops/verify-prod-db-ownership.sql:1`](../../scripts/ops/verify-prod-db-ownership.sql#L1)
- **Problem:** Every connection string uses the postgres user, and the 'ownership' verify script never checks roles.
- **Impact:** An injection or RCE in any one service gives full control of the cluster (COPY TO PROGRAM, dropping every database).
- **Fix:** Create one non-superuser role per context database, keep the superuser for migrate only, and extend the verify script to check this.

#### A-050

**🟡 MEDIUM — Deploy rollback swaps images but not the already-migrated schema**

- **Where:** [`.github/workflows/deploy.yml:403`](../../.github/workflows/deploy.yml#L403), [`.github/workflows/deploy.yml:375`](../../.github/workflows/deploy.yml#L375)
- **Problem:** Migrate runs before up, and rollback only restores the old images. Destructive migrations (drops, SET SCHEMA) have already shipped, and streams commit independently.
- **Impact:** A failed smoke check 'rolls back' into a broken production.
- **Fix:** Use expand/contract migrations, take a pg_dump before migrate, and refuse an image-only rollback when migrations ran.

#### A-051

**🟡 MEDIUM — Frontend tests and typecheck never run before production**

- **Where:** [`.github/workflows/frontend.yml:3`](../../.github/workflows/frontend.yml#L3)
- **Problem:** frontend.yml runs only on pull requests, but deploys are direct pushes to main. A component-size test is already red on main, and container migration tests are off on the deploy path.
- **Impact:** The offline PWA and about 180 vitest files shipped without ever being run in CI.
- **Fix:** Make a frontend job a prerequisite of build-and-push. Fix the two oversized components first.

#### A-052

**🟡 MEDIUM — Missing migrations are not detected before deploy**

- **Where:** [`backend/tools/DbMigrate/Program.cs:267`](../../backend/tools/DbMigrate/Program.cs#L267)
- **Problem:** DbMigrate suppresses PendingModelChangesWarning, and no test compares each model with its snapshot.
- **Impact:** A forgotten migration deploys green and then fails at runtime.
- **Fix:** Add a HasPendingModelChanges test per context and remove the suppression.

#### A-119

**⚪ LOW — Rate limits pool whole offices and internal services**

- **Where:** [`backend/gateway/RealEstateEval.Gateway/appsettings.json:20`](../../backend/gateway/RealEstateEval.Gateway/appsettings.json#L20), [`backend/shared/RealEstateEval.Shared.Web/RateLimitingExtensions.cs:243`](../../backend/shared/RealEstateEval.Shared.Web/RateLimitingExtensions.cs#L243)
- **Problem:** Login and refresh share 10 per minute per public IP, and service-to-service calls share one bucket per container.
- **Impact:** Offices behind one NAT and bulk syncs get 429s.
- **Fix:** Take refresh out of the login budget, raise the limit, and exempt internal callers.

#### A-120

**⚪ LOW — Gateway's 100 s timeout is shorter than the 120 s PDF render budget**

- **Where:** [`backend/gateway/RealEstateEval.Gateway/appsettings.json:274`](../../backend/gateway/RealEstateEval.Gateway/appsettings.json#L274)
- **Problem:** The valuation cluster uses YARP's 100 s default.
- **Impact:** Long renders fail with a bare 504.
- **Fix:** Set ActivityTimeout to 3 minutes.

#### A-121

**⚪ LOW — TLS renewal fix exists only on the server**

- **Where:** [`infra/setup-hetzner-server.sh:126`](../../infra/setup-hetzner-server.sh#L126)
- **Problem:** The setup script ('safe to re-run') installs the hook configuration the team verified breaks renewal.
- **Impact:** Re-running it makes certificates expire, and the PWA cannot sync.
- **Fix:** Commit the real deploy hook, and fix the script and docs.

#### A-122

**⚪ LOW — A manual workflow run deploys any branch to production**

- **Where:** [`.github/workflows/deploy.yml:204`](../../.github/workflows/deploy.yml#L204)
- **Problem:** There is no branch check and no environment protection.
- **Impact:** Unmerged code and migrations can reach production and retag :latest.
- **Fix:** Require refs/heads/main and a protected environment.

#### A-123

**⚪ LOW — Outdated Node and Redis images with known CVEs; Redis has no auth**

- **Where:** [`apps/shell/Dockerfile:91`](../../apps/shell/Dockerfile#L91), [`infra/docker-compose.prod.yml:83`](../../infra/docker-compose.prod.yml#L83)
- **Problem:** Node 22.17.1 is pinned by digest, and Redis 7.4.2 runs without requirepass.
- **Impact:** Remote DoS on the shell. RCE in Redis from any foothold on the network.
- **Fix:** Bump both, add requirepass, and add a Dependabot config for docker, nuget and actions.

#### A-124

**⚪ LOW — Deploy actions are pinned by mutable tags and receive every secret**

- **Where:** [`.github/workflows/deploy.yml:250`](../../.github/workflows/deploy.yml#L250)
- **Problem:** The appleboy ssh and scp actions are referenced by tag.
- **Impact:** A re-pointed tag would leak the SSH key and production secrets.
- **Fix:** Pin to commit SHAs.

#### A-125

**⚪ LOW — A VAPID private key is committed to the repo**

- **Where:** `Platform.Api/appsettings.Development.json:21`
- **Problem:** The dev key pair is public and could be reused in production.
- **Impact:** Forged push notifications if production shares the pair.
- **Fix:** Check the production key, rotate, and purge from history.

#### A-126

**⚪ LOW — PWA and offline-interceptor tests run nowhere or assert nothing**

- **Where:** [`e2e/pwa-assets.spec.ts:13`](../../e2e/pwa-assets.spec.ts#L13), [`packages/offline-client/src/offline-store.test.ts:91`](../../packages/offline-client/src/offline-store.test.ts#L91)
- **Problem:** The spec is outside testDir and only greps comments, and the interceptor test only asserts typeof.
- **Impact:** Offline regressions go undetected.
- **Fix:** Write behavioural service-worker tests and table-driven classifyWrite tests.

#### A-127

**⚪ LOW — Pre-split data copy scripts no longer work, and they advise dropping the shared DB too early**

- **Where:** [`infra/postgres/copy-operations-data.sh:31`](../../infra/postgres/copy-operations-data.sh#L31)
- **Problem:** The scripts target tables that have since been relocated or dropped, and they print the drop instruction after each copy.
- **Impact:** A restore fails partway, and the source can be dropped.
- **Fix:** Update or retire the scripts, and verify counts before any drop.

### Offline field app

Several data-loss paths: stale snapshot write-backs, replays that revert newer saves, local: photo ids, service-worker cache wipes on every deploy, sessions cleared on weak signal, broken lease and lock rules, logout wipes, and misleading photo stamps.

#### A-007

**🟠 HIGH — Each deploy deletes the offline pages and code on field devices**

- **Where:** [`apps/shell/public/sw.js:56`](../../apps/shell/public/sw.js#L56), [`apps/shell/src/lib/offline-page-cache.ts:60`](../../apps/shell/src/lib/offline-page-cache.ts#L60)
- **Problem:** When it activates, the new service worker deletes the previous build's page and chunk caches. The warm-up was sent to the old worker, so the new caches are empty.
- **Impact:** An inspector who closes the app without tapping «تحديث الآن» gets only offline.html at the site. This happens after every deploy.
- **Fix:** Carry the previous caches over, or warm registration.waiting before activation. Delete old caches only after a successful warm. Add a two-build test.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). Warm goes to `registration.waiting` and `active`. «تحديث الآن» warms the waiting worker before `SKIP_WAITING`. Activate deletes old caches only when the new pages cache has an offline profile.

#### A-008

**🟠 HIGH — Offline sync writes a stale snapshot back over edits made during the pass**

- **Where:** [`packages/offline-client/src/sync.ts:793`](../../packages/offline-client/src/sync.ts#L793), [`packages/offline-client/src/repository.ts:32`](../../packages/offline-client/src/repository.ts#L32)
- **Problem:** The replay loop snapshots the outbox and writes each row back from that snapshot when it changes status. That overwrites autosaves folded into the row in the meantime, and completeSave then deletes the device draft.
- **Impact:** The inspector's last answers, including the ق-10 completion stamp, are lost from both the server and the device.
- **Fix:** Re-read the row and change only the status fields. Compare against the payload actually sent. Add a regression test.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). The replay loop re-reads each outbox row before marking it uploading, and folds continue into an in-flight save. Test: `offline-sync-release.test.ts`.

#### A-009

**🟠 HIGH — A queued offline save replays after newer online saves and reverts them**

- **Where:** [`packages/app-shared/src/offline/offline-write.ts:106`](../../packages/app-shared/src/offline/offline-write.ts#L106), [`packages/offline-client/src/sync.ts:410`](../../packages/offline-client/src/sync.ts#L410)
- **Problem:** Online saves go straight to the server while an older full snapshot of the same task is still queued, and the replay sends that old snapshot last.
- **Impact:** Corrections made after signal returns are silently rolled back to the offline snapshot.
- **Fix:** A successful online save should supersede older queued saves for that task, or saves should go through the queue while one is waiting.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). A successful online save/submit deletes queued `party-submission-save` rows for that task.

#### A-010

**🟠 HIGH — Photos taken offline keep local: ids in the open form and overwrite the uploaded ids**

- **Where:** [`packages/offline-client/src/sync.ts:400`](../../packages/offline-client/src/sync.ts#L400), [`apps/mfe-case-study/src/lib/app-data/inspector-workspace-commands.ts:317`](../../apps/mfe-case-study/src/lib/app-data/inspector-workspace-commands.ts#L317)
- **Problem:** Only the queued copy is rewritten to server ids. The live draft keeps local:* ids and is flushed on submit, after the local bytes have been released.
- **Impact:** Submit is refused, the server payload keeps dead ids, and the photos are lost.
- **Fix:** Publish the local-to-server id mapping and rewrite the live draft. Refuse to PUT any payload that still contains local: ids.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). Uploads rewrite stored drafts and remaining outbox JSON, publish `ejada-offline-attachment-map` for the open form, and saves with leftover `local:` ids wait or go terminal.

#### A-011

**🟠 HIGH — A failed inspection read is treated as 'no draft', and a blank draft is saved over the real one**

- **Where:** [`apps/mfe-case-study/src/lib/app-data/inspector-workspace-reads.ts:59`](../../apps/mfe-case-study/src/lib/app-data/inspector-workspace-reads.ts#L59), [`apps/mfe-case-study/src/lib/app-data/inspector-workspace-commands.ts:73`](../../apps/mfe-case-study/src/lib/app-data/inspector-workspace-commands.ts#L73)
- **Problem:** 5xx, 403 and offline misses all collapse to null, and getOrCreateInspectorWorkspace then PUTs (or queues) a blank draft.
- **Impact:** A 502 during a deploy can wipe a started inspection's answers and photo references.
- **Fix:** Create a draft only after a confirmed 404 and rethrow everything else. Offline with no local copy should show 'not downloaded'.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). Inspection reads no longer swallow 5xx/403. Offline with no local copy throws «المسودة غير محمّلة على الجهاز». `getOrCreateInspectorWorkspace` only creates after a confirmed empty/404.

#### A-012

**🟠 HIGH — App start logs field users out on any transient token-refresh failure**

- **Where:** [`apps/shell/src/components/PrototypeAppGate.tsx:43`](../../apps/shell/src/components/PrototypeAppGate.tsx#L43), [`packages/app-shared/src/auth/ensure-fresh-session.ts:69`](../../packages/app-shared/src/auth/ensure-fresh-session.ts#L69)
- **Problem:** When navigator.onLine is true (weak signal, captive Wi-Fi, a deploy), a refresh timeout or 5xx is treated the same as a revoked login.
- **Impact:** Inspectors at a site with weak signal are sent to /login, which needs the network, so they cannot work.
- **Fix:** Return a typed result from renew() and clear the session only on auth failures. Keep offline-capable users whose refresh token is valid.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). `resolveFreshAuthSession` distinguishes ok / auth / transient. The app gate keeps field users after a refresh timeout even when `navigator.onLine` is true.

#### A-013

**🟠 HIGH — Non-field roles' saves and submits are queued offline but never replayed**

- **Where:** [`packages/app-shared/src/offline/offline-write.ts:89`](../../packages/app-shared/src/offline/offline-write.ts#L89), [`apps/mfe-case-study/src/lib/app-data/operations-tasks-commands.ts:119`](../../apps/mfe-case-study/src/lib/app-data/operations-tasks-commands.ts#L119), [`apps/mfe-engineering-office/src/lib/engineering-survey-submission-commands.ts:188`](../../apps/mfe-engineering-office/src/lib/engineering-survey-submission-commands.ts#L188)
- **Problem:** The offline fallbacks queue writes for any signed-in user and treat server errors as connectivity loss, but only field roles run the replay. The UI reports success.
- **Impact:** Engineering-office and appraiser submits, supervisor task changes and specialist corrections made during a blip or a deploy never reach the server.
- **Fix:** Gate every offline fallback on isOfflineCapableRole and show the error for all other roles.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). Draft/submit/upload fallbacks, operations-task writes and key-envelope queues only run for an offline field session. Other roles see the original error.

#### A-014

**🟠 HIGH — Key-envelope writes with an idempotency key are sent without Authorization**

- **Where:** [`packages/api-client/src/prototype-modules.ts:457`](../../packages/api-client/src/prototype-modules.ts#L457), [`packages/api-client/src/idempotency-key.ts:16`](../../packages/api-client/src/idempotency-key.ts#L16)
- **Problem:** A Headers object is spread into a plain object, which copies nothing, so Authorization, Content-Type and Idempotency-Key are all dropped.
- **Impact:** Registering envelopes and confirming assignments and handoffs always fail with 401, both online and on replay.
- **Fix:** Merge headers with the Headers API (or return a plain record), and add a test asserting Authorization is present.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). `withIdempotencyKey` returns a plain record; key-envelope fetch merges via `mergeHeaderRecords`. Test: `idempotency-key.test.ts`.

#### A-015

**🟠 HIGH — Replacing an attachment deletes the old file first and treats any rejection as 'offline'**

- **Where:** [`packages/app-shared/src/app-data/task-attachments-api.ts:183`](../../packages/app-shared/src/app-data/task-attachments-api.ts#L183), [`apps/mfe-engineering-office/src/lib/engineering-survey-attachments.ts:204`](../../apps/mfe-engineering-office/src/lib/engineering-survey-attachments.ts#L204)
- **Problem:** uploadTaskScopedAttachment deletes the existing files, maps every upload failure to a network error, queues the file and returns a local: id as if it had succeeded.
- **Impact:** Deposit certificates and survey reports are deleted on the server while the replacement sits only in the browser, and submits pass while pointing at local: ids.
- **Fix:** Upload first and delete only after success. Surface validation and auth errors as real errors. Never accept local: ids for roles that are not offline-capable.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). Scope replace deletes other files only after a successful online upload. Validation/auth are not mapped to `Failed to fetch`. Non-field roles cannot keep `local:` ids.

#### A-016

**🟠 HIGH — Offline court-access updates replay with local: attachment ids and never sync**

- **Where:** [`packages/offline-client/src/sync.ts:571`](../../packages/offline-client/src/sync.ts#L571), [`apps/mfe-keys/src/lib/keys-envelope-api.ts:692`](../../apps/mfe-keys/src/lib/keys-envelope-api.ts#L692)
- **Problem:** The court-access replay does not rewrite local ids, so the server returns 400 every 30 s and the row never becomes terminal.
- **Impact:** Eviction holds are never set. Because the outbox never drains, the stale lease locks the device at the next offline session.
- **Fix:** Rewrite ids and wait for uploads, as the envelope handlers already do, and mark 400s as terminal.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). Court-access replay rewrites `local:` ids, waits on uploads, and treats validation 400s as terminal.

#### A-017

**🟠 HIGH — Key-envelope detail crashes after an offline or network-failed action**

- **Where:** [`apps/mfe-keys/src/lib/keys-envelope-api.ts:522`](../../apps/mfe-keys/src/lib/keys-envelope-api.ts#L522), [`apps/mfe-keys/src/components/useKeyEnvelopeDetailWorkflow.ts:168`](../../apps/mfe-keys/src/components/useKeyEnvelopeDetailWorkflow.ts#L168)
- **Problem:** Queued writes return a stub {id} cast to KeyEnvelopeRow, and that stub is set as the envelope.
- **Impact:** The keys screen throws after an offline match, handoff or receive, which invites duplicate actions.
- **Fix:** Return the current row with the change applied, or a 'queued' flag that keeps the existing envelope.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). Queued key writes return `queued: true`. The detail screen keeps the existing envelope instead of setting a stub `{id}`.

#### A-018

**🟠 HIGH — Inspection limits and building inventory are manual-save and online-only in the inspector form**

- **Where:** [`apps/mfe-case-study/src/components/field-inspection/InspectionLimitsSection.tsx:78`](../../apps/mfe-case-study/src/components/field-inspection/InspectionLimitsSection.tsx#L78), [`apps/mfe-case-study/src/components/field-inspection/BuildingInventorySection.tsx:163`](../../apps/mfe-case-study/src/components/field-inspection/BuildingInventorySection.tsx#L163)
- **Problem:** Both sections keep local state until their own save button is pressed. Submit neither saves nor validates them, and they cannot load offline.
- **Impact:** The scope, restriction reason and uninspected units are lost on submit, and offline inspections go in without the mandatory scope.
- **Fix:** Move them into the autosaved offline draft (or autosave them and flush before submit), and validate the scope.

#### A-019

**🟠 HIGH — Case-study question chips ignore failed saves and are not kept offline**

- **Where:** [`apps/mfe-case-study/src/components/field-inspection/InspectorCaseStudyChips.tsx:187`](../../apps/mfe-case-study/src/components/field-inspection/InspectorCaseStudyChips.tsx#L187), [`apps/mfe-case-study/src/components/field-inspection/InspectorWorkspaceWizard.tsx:287`](../../apps/mfe-case-study/src/components/field-inspection/InspectorWorkspaceWizard.tsx#L287)
- **Problem:** Save failures have no handling. The chips are editable for users the server rejects with 403, offline answers are not persisted, and late responses overwrite newer answers.
- **Impact:** Answers look saved but revert on reload, and deed-matching answers given offline are lost.
- **Fix:** Make the chips read-only unless the viewer can write. Revert and show errors on failure, sequence the responses, and route the writes through the offline layer.
- **Status:** ⚠️ **Partial** (2026-09-27, uncommitted on `dev`). Failed chip saves revert and toast, and overlapping responses are dropped. Offline persistence of case-study form drafts was not added — that needs a new outbox kind.

#### A-053

**🟡 MEDIUM — Offline replay can duplicate comments, assignments and envelopes**

- **Where:** [`packages/app-shared/src/offline/install-offline-write-interceptor.ts:303`](../../packages/app-shared/src/offline/install-offline-write-interceptor.ts#L303), [`apps/shell/src/lib/offline-sync-replay.ts:134`](../../apps/shell/src/lib/offline-sync-replay.ts#L134)
- **Problem:** If connectivity drops mid-sync, the interceptor re-enqueues replay traffic without its key. Comment and assignment replays send no idempotency key at all.
- **Impact:** Comments are posted twice, envelopes duplicated and fees double-counted.
- **Fix:** Bypass the interceptor for replay traffic, and send idempotency keys for every kind.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). Replay runs inside `runAsOfflineReplay` so the interceptor does not re-queue. Comments, patches, court-access and envelope writes now carry an idempotency key.

#### A-054

**🟡 MEDIUM — One refused upload blocks its save and submit forever and keeps the offline lease alive**

- **Where:** [`packages/offline-client/src/sync.ts:401`](../../packages/offline-client/src/sync.ts#L401)
- **Problem:** A save that references a terminal upload stays retryable forever, and 400 upload errors are retried endlessly.
- **Impact:** Items stay stuck, the device locks as soon as it next goes offline, and the update is refused.
- **Fix:** Mark dependent rows terminal, treat 400 as terminal, and clear the lease on a successful online login.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). Upload and court-access 400s are terminal; saves that only reference refused uploads go terminal. A successful token refresh clears the lease.

#### A-055

**🟡 MEDIUM — The 3-hour offline lock is undone 30 seconds later**

- **Where:** [`packages/offline-client/src/lease.ts:22`](../../packages/offline-client/src/lease.ts#L22)
- **Problem:** beginOfflineLease replaces a locked lease with a fresh one, and cold start never checks the lease.
- **Impact:** The lock required by §3.3 can be bypassed.
- **Fix:** Never replace a locked lease, and gate cold start on the lease.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). `beginOfflineLease` returns an existing lease, including locked. The session watcher still sends a locked device to login.

#### A-056

**🟡 MEDIUM — Hourly offline warnings are never shown**

- **Where:** [`apps/shell/src/components/AuthSessionWatcher.tsx:57`](../../apps/shell/src/components/AuthSessionWatcher.tsx#L57)
- **Problem:** The watcher's lease tick uses up the warn flags without showing any toast.
- **Impact:** The app locks at 3 hours with no 1-hour or 2-hour warning.
- **Fix:** Show the toasts from the tick, and tick on an interval while offline.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). The watcher and the sync coordinator both toast 1h/2h warnings from the lease tick, and the coordinator ticks every 30 s while offline.

#### A-057

**🟡 MEDIUM — Logout deletes unsynced drafts, photos and submits**

- **Where:** [`apps/shell/src/hooks/useAppShellLogout.ts:44`](../../apps/shell/src/hooks/useAppShellLogout.ts#L44)
- **Problem:** Logout purges everything, and the pending-count check races an 800 ms timeout that returns 0.
- **Impact:** A finished inspection that has not synced can be destroyed without any prompt.
- **Fix:** Keep unsynced rows (encrypted) and make a full wipe an explicit choice.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). Logout no longer treats a pending-count timeout as zero. Confirming logout with unsynced work keeps the encrypted store.

#### A-058

**🟡 MEDIUM — Logout does not wait for the offline wipe to finish**

- **Where:** [`apps/shell/src/hooks/useAppShellLogout.ts:45`](../../apps/shell/src/hooks/useAppShellLogout.ts#L45)
- **Problem:** Navigation can abort the purge transaction.
- **Impact:** Prefetched deeds and the key remain on the device after logout.
- **Fix:** Await the purge, with a time cap, before navigating, and clean up leftovers on the login page.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). Empty-queue logout awaits purge (2 s cap) before navigating. Leftover cleanup on the login page was not added.

#### A-059

**🟡 MEDIUM — Photo stamps misstate location and time when EXIF is missing, and mix calendars**

- **Where:** [`apps/mfe-case-study/src/lib/app-data/inspector-photo-upload.ts:237`](../../apps/mfe-case-study/src/lib/app-data/inspector-photo-upload.ts#L237), `process-evidence-photo.ts:176`
- **Problem:** Without EXIF, the stamp falls back to the map pin (the Jeddah default until the pin is moved) and the task-open time. The «صك» line may show «خانة N», and EXIF time prints in Hijri with seconds.
- **Impact:** Evidence stamps misrepresent where and when a photo was taken. iPhone camera photos are always affected.
- **Fix:** Print «موقع غير متاح» or the device time, pass the deed number explicitly, and use one Gregorian formatter.

#### A-060

**🟡 MEDIUM — Stamping re-encodes photos above the 1 MB client limit**

- **Where:** [`apps/mfe-case-study/src/lib/app-data/inspector-photo-stamp.ts:49`](../../apps/mfe-case-study/src/lib/app-data/inspector-photo-stamp.ts#L49)
- **Problem:** The stamp step re-encodes at quality 0.85 after the compression loop.
- **Impact:** Detailed photos are refused on every retry.
- **Fix:** Stamp inside the compression loop so there is a single encode.

#### A-128

**⚪ LOW — Offline sync status is stored per user, not per device**

- **Where:** [`backend/contexts/platform/RealEstateEval.Platform.Infrastructure/Services/FieldSyncStatusService.cs:30`](../../backend/contexts/platform/RealEstateEval.Platform.Infrastructure/Services/FieldSyncStatusService.cs#L30)
- **Problem:** A second device reporting 0 pending clears the first device's row.
- **Impact:** The supervisor misses stuck items.
- **Fix:** Key by (UserId, DeviceId), and take name and role from claims.

#### A-129

**⚪ LOW — Photo location flag trusts client-sent property coordinates**

- **Where:** [`backend/contexts/attachments/RealEstateEval.Attachments.Infrastructure/Services/AttachmentService.cs:141`](../../backend/contexts/attachments/RealEstateEval.Attachments.Infrastructure/Services/AttachmentService.cs#L141), [`apps/mfe-case-study/src/lib/app-data/inspector-photo-upload.ts:357`](../../apps/mfe-case-study/src/lib/app-data/inspector-photo-upload.ts#L357)
- **Problem:** The flag compares against the inspector's own pin or the Jeddah default, and is never recomputed.
- **Impact:** False 'out of range' warnings, or «مطابق» wherever the inspector is.
- **Fix:** Use the property's coordinates from the server and recompute when the pin is saved.

#### A-130

**⚪ LOW — Queued offline submit shows a connection toast the spec forbids**

- **Where:** [`apps/mfe-case-study/src/components/field-inspection/useFieldInspectionWorkflow.ts:318`](../../apps/mfe-case-study/src/components/field-inspection/useFieldInspectionWorkflow.ts#L318)
- **Problem:** §4.1/4.2 forbid pop-ups about connection status.
- **Impact:** Deviation from the spec.
- **Fix:** Show normal success, and let the sync icon indicate status.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). Queued inspector submit uses the same success toast as an online send.

#### A-131

**⚪ LOW — Sync icon and lock overlay are hidden on phones in the inspection form**

- **Where:** [`apps/shell/src/components/views/AppShell.tsx:213`](../../apps/shell/src/components/views/AppShell.tsx#L213)
- **Problem:** The coordinator renders inside a topbar that is hidden on phones.
- **Impact:** No sync status (§4.2), and the lock is not enforced there.
- **Fix:** Portal the overlay, and add the icon to the mobile header.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). `OfflineSyncProvider` always renders the lock overlay. The sync icon is in the mobile inspection header and the desktop topbar.

#### A-132

**⚪ LOW — Offline store weaknesses: key stored with the data, plaintext metadata, key-creation race, shared-device collisions**

- **Where:** [`packages/offline-client/src/store.ts:224`](../../packages/offline-client/src/store.ts#L224), [`packages/offline-client/src/store.ts:214`](../../packages/offline-client/src/store.ts#L214), [`packages/offline-client/src/repository.ts:66`](../../packages/offline-client/src/repository.ts#L66)
- **Problem:** The key sits in the same IndexedDB (raw bytes on Android), and PO numbers and tokens are stored in plaintext. Two first writes can create two keys, and undecryptable rows are silently skipped. Row ids are not scoped to the user.
- **Impact:** Encryption adds little on Android, some rows are lost silently, and users on a shared device overwrite each other.
- **Fix:** Wrap the key with a secret that is not stored with it, memoize key creation, surface decrypt failures, and prefix ids with the userId.

#### A-133

**⚪ LOW — Offline session ends at the 12-hour login window instead of the 3-hour lease**

- **Where:** [`packages/app-shared/src/auth/offline-session.ts:18`](../../packages/app-shared/src/auth/offline-session.ts#L18)
- **Problem:** Offline usability is tied to refresh-token expiry.
- **Impact:** Inspectors are locked out early in long days.
- **Fix:** Decide offline usability by the lease.

### Event messaging and service calls

Outbox events are unconfirmed or dead-lettered during broker blips. Inbox claims lose messages on shutdown. Valuation notices are never delivered. Background calls get 403. Unbounded GET id lists hit 414 errors.

#### A-020

**🟠 HIGH — Background consumers call protected APIs with a service token that carries no capabilities (403)**

- **Where:** [`backend/shared/RealEstateEval.Shared.RemoteClients/UpstreamServiceBearer.cs:55`](../../backend/shared/RealEstateEval.Shared.RemoteClients/UpstreamServiceBearer.cs#L55), [`backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/WorkflowAssigneesController.cs:17`](../../backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/WorkflowAssigneesController.cs#L17)
- **Problem:** Consumers and sweeps run without an HttpContext and send a service JWT with no capability claims. Since Sep 8 the endpoints they call require capability policies.
- **Impact:** 'New report' and 'new request' notifications are dead-lettered, and the ops reminder sweep fails silently in production.
- **Fix:** Authorize the upstream-service principal (tokenUse plus X-REE-Upstream) or move these lookups to dispatch routes. Add a no-HttpContext integration test.

#### A-021

**🟠 HIGH — Batch lookups put hundreds of GUIDs in GET URLs and fail with 414 past about 200 ids**

- **Where:** [`backend/shared/RealEstateEval.Shared.RemoteClients/HttpCaseStudyLookup.cs:27`](../../backend/shared/RealEstateEval.Shared.RemoteClients/HttpCaseStudyLookup.cs#L27), [`backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Services/InspectorFeeSummaryQuery.cs:254`](../../backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Services/InspectorFeeSummaryQuery.cs#L254), [`packages/app-shared/src/app-data/party-submission-api.ts:356`](../../packages/app-shared/src/app-data/party-submission-api.ts#L356)
- **Problem:** Up to 2,000 ids at about 39 bytes each go into query strings, with no chunking. Kestrel and nginx cap the request line at 8 KB.
- **Impact:** Past about 200 ledgers, the fee screens, statements, vendor run and ledger sweeps return 500, and queue badges lose their submission states.
- **Fix:** Chunk to about 150 ids or move these reads to POST bodies, pass distinct ids, and add a test with 500+ ids.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). Owner HTTP lookups and party-submission prefetch chunk distinct ids at 150 per GET. Tests: `QueryIdBatchTests`, `HttpCaseStudyLookupBatchTests` (500 ids → 4 GETs, each under 8 KB).

#### A-061

**🟡 MEDIUM — Valuation workflow notices (recall, reopen) are never delivered**

- **Where:** [`backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/EvaluatorRecallsService.cs:92`](../../backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/EvaluatorRecallsService.cs#L92), [`backend/services/platform/RealEstateEval.Platform.Api/Integration/NotificationIntegrationEventConsumer.cs:84`](../../backend/services/platform/RealEstateEval.Platform.Api/Integration/NotificationIntegrationEventConsumer.cs#L84)
- **Problem:** The notice is added to the outbox after the last SaveChanges, so it is never persisted, and no queue is bound to valuation.workflow.notice.v1.
- **Impact:** Recall requests and decisions, and deposit reopens, reach nobody.
- **Fix:** Publish before SaveChanges, bind the routing key, and test that every handled event type is bound.

#### A-062

**🟡 MEDIUM — Event consumers lose messages on shutdown or short outages**

- **Where:** [`backend/RealEstateEval.Infrastructure/Integration/IntegrationEventInbox.cs:168`](../../backend/RealEstateEval.Infrastructure/Integration/IntegrationEventInbox.cs#L168), [`backend/services/platform/RealEstateEval.Platform.Api/Integration/NotificationIntegrationEventConsumer.cs:153`](../../backend/services/platform/RealEstateEval.Platform.Api/Integration/NotificationIntegrationEventConsumer.cs#L153), [`backend/services/case-study/RealEstateEval.CaseStudy.Api/Integration/ValuationIntegrationEventConsumer.cs:139`](../../backend/services/case-study/RealEstateEval.CaseStudy.Api/Integration/ValuationIntegrationEventConsumer.cs#L139)
- **Problem:** The inbox claim commits before handling and is released with the already-cancelled stoppingToken. Retry is a single immediate requeue into an unmonitored dead-letter queue.
- **Impact:** Deploys and brief upstream outages permanently drop notifications and appraisal-task completion.
- **Fix:** Release with CancellationToken.None, or commit the claim together with the handler's writes. Use delayed retries and add a DLQ alert and replay tool.

#### A-063

**🟡 MEDIUM — A RabbitMQ outage of about 40 s dead-letters healthy outbox events**

- **Where:** [`backend/RealEstateEval.Infrastructure/Integration/RabbitMqMessagePublisher.cs:43`](../../backend/RealEstateEval.Infrastructure/Integration/RabbitMqMessagePublisher.cs#L43), [`backend/RealEstateEval.Infrastructure/Integration/OutboxDispatcherHostedService.cs:140`](../../backend/RealEstateEval.Infrastructure/Integration/OutboxDispatcherHostedService.cs#L140)
- **Problem:** Connection errors throw, so the 'refund the attempt' branch is unreachable, and they count toward 10 attempts. Closed channels are reused.
- **Impact:** A broker restart (the pending logging change will recreate it) drops events such as valuation-report-submitted for good.
- **Fix:** Treat connection errors as broker-unavailable: reset the connection and refund the attempt. Add re-queue tooling.

#### A-064

**🟡 MEDIUM — Outbox marks events as sent without broker confirmation, and RabbitMQ has no fixed hostname**

- **Where:** [`backend/RealEstateEval.Infrastructure/Integration/RabbitMqMessagePublisher.cs:51`](../../backend/RealEstateEval.Infrastructure/Integration/RabbitMqMessagePublisher.cs#L51), [`infra/docker-compose.prod.yml:65`](../../infra/docker-compose.prod.yml#L65)
- **Problem:** Publishes are transient, non-mandatory and unconfirmed. The broker's node name follows the container id.
- **Impact:** Recreating the broker orphans its queues, and restarts lose queued events while the outbox records them as delivered.
- **Fix:** Set a fixed hostname. Publish persistent and mandatory with confirms, and mark rows processed only after the ack.

#### A-134

**⚪ LOW — Live notification stream is buffered by nginx**

- **Where:** [`infra/nginx.conf:98`](../../infra/nginx.conf#L98)
- **Problem:** There is no proxy_buffering off and no X-Accel-Buffering header.
- **Impact:** No live delivery; clients reconnect about every 75 s.
- **Fix:** Set X-Accel-Buffering: no, or add an nginx location for the stream.

#### A-135

**⚪ LOW — Live-stream subscribe/unsubscribe race**

- **Where:** [`backend/contexts/platform/RealEstateEval.Platform.Infrastructure/Notifications/NotificationRealtimeHub.cs:32`](../../backend/contexts/platform/RealEstateEval.Platform.Infrastructure/Notifications/NotificationRealtimeHub.cs#L32)
- **Problem:** Removal is not synchronized with GetOrAdd.
- **Impact:** A tab silently stops receiving live notifications.
- **Fix:** Lock, or remove only if the entry is the same instance.

#### A-136

**⚪ LOW — Idempotency record is saved with RequestAborted**

- **Where:** [`backend/shared/RealEstateEval.Shared.Web/Middleware/CommandIdempotencyMiddleware.cs:102`](../../backend/shared/RealEstateEval.Shared.Web/Middleware/CommandIdempotencyMiddleware.cs#L102)
- **Problem:** If the client drops after the commit, the record is never written.
- **Impact:** The offline retry re-runs the command.
- **Fix:** Save with CancellationToken.None, or reserve the key first.

### Case-study workflow

Unsafe cascade deletes. Structure inventory is hard-deleted, against ق-5. Reopened transactions get stuck. Blocked or cancelled work can still be submitted. Row versions are never sent to clients, so stale saves overwrite silently.

#### A-022

**🟠 HIGH — Task-cascade delete endpoints hard-delete live work and paid fee ledgers with no role or state check**

- **Where:** [`backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/WorkflowTasksController.cs:188`](../../backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/WorkflowTasksController.cs#L188), [`backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/WorkflowTaskLifecycleCommands.Deletion.cs:93`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/WorkflowTaskLifecycleCommands.Deletion.cs#L93)
- **Problem:** DELETE /workflow-tasks/by-po and /by-property need only manage-work-orders and ignore the task phase. They delete across services without a transaction and remove disbursed fee ledgers.
- **Impact:** A case specialist can erase a live PO's inspections, submissions and paid-fee history, with no audit record.
- **Fix:** Require CanDeletePo/CanDeleteProperty and prior removal, and refuse completed work. Do local deletes in one transaction and call Financial after commit. Void fees instead of deleting them, and audit.
- **Status:** ✅ **Solved** (2026-09-27, uncommitted on `dev`). `DELETE /workflow-tasks/by-po` and `.../properties/{id}` now require `CanDeletePo` / `CanDeleteProperty` (supervisor or CDO) and refuse completed, Done, or CaseStudy work. Tests: `WorkflowTaskLifecycleRulesTests`. Left: allowed deletes still hard-delete draft fee ledgers (no void/audit), and the CS/Financial calls are not one transaction.

#### A-023

**🟠 HIGH — Structure inventory is hard-deleted on a land-type submit or a «لا» tap (against ق-5)**

- **Where:** [`backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Persistence/PartyTaskSubmissionRepository.cs:126`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Persistence/PartyTaskSubmissionRepository.cs#L126), [`backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/BuildingInventoryService.cs:127`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/BuildingInventoryService.cs#L127), [`apps/mfe-case-study/src/components/field-inspection/BuildingInventorySection.tsx:155`](../../apps/mfe-case-study/src/components/field-inspection/BuildingInventorySection.tsx#L155)
- **Problem:** Submitting a land type forces 'no structures', deletes every line and strips the building payload keys. Tapping «لا» deletes all lines immediately, and full-list saves drop lines added concurrently.
- **Impact:** Cost-approach inputs and their provenance disappear with no audit or undo, again on every resubmission.
- **Fix:** Hide the lines instead of deleting them, and confirm before «لا». Audit and notify the authors. Remove lines by id, or add a version token.

#### A-024

**🟠 HIGH — A reopened completed transaction can never be edited or completed again**

- **Where:** [`backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/CaseStudyFormService.cs:147`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/CaseStudyFormService.cs#L147), [`backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/WorkflowTaskLifecycleCommands.cs:278`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/WorkflowTaskLifecycleCommands.cs#L278)
- **Problem:** Reopen sets the task to Open but leaves the case-study form 'submitted', so every save is refused. Completion only runs on the first submit, outside the form's transaction.
- **Impact:** Reopened transactions stay open forever. An error during the first submit leaves the same stuck state.
- **Fix:** Reset the form (and the party forms) to draft on reopen, with audit. Commit submission and completion together, or make completion idempotent.

#### A-065

**🟡 MEDIUM — Party submit accepts Blocked tasks and marks them Completed**

- **Where:** [`backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/PartyTaskSubmissionService.cs:310`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/PartyTaskSubmissionService.cs#L310)
- **Problem:** SubmitAsync never checks the task status, and the shell patch writes any status.
- **Impact:** Offline replays complete inspections on frozen (failed) transactions and tell the appraiser to start valuing.
- **Fix:** Refuse submits on Blocked or Cancelled tasks or with an active failure, and use a guarded domain transition.

#### A-066

**🟡 MEDIUM — AdvanceAfterEnfath can drag a case-study parent back, and confirming again spawns duplicate tasks**

- **Where:** [`backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/WorkflowTaskLifecycleCommands.cs:125`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/WorkflowTaskLifecycleCommands.cs#L125)
- **Problem:** There is no phase or property-match check, and ConfirmDistribution does not check for existing children.
- **Impact:** Duplicate inspection, appraisal and survey tasks, notifications and later fees.
- **Fix:** Require the Enfath or Bourse phase and a matching or empty property, and make confirm idempotent.

#### A-067

**🟡 MEDIUM — Cancelling or stopping a PO leaves its tasks live**

- **Where:** [`backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/WorkOrderService.cs:395`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/WorkOrderService.cs#L395)
- **Problem:** Submit, accept, distribution and fee accrual never read LifecycleStatus.
- **Impact:** Parties keep submitting and survey fees accrue on cancelled orders.
- **Fix:** Reject writes on Cancelled or Stopped POs, and cancel or block their open tasks through domain transitions.

#### A-068

**🟡 MEDIUM — Adding a fourth phone number wipes all of a property's contacts**

- **Where:** [`backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Persistence/WorkOrderPropertyRepository.cs:37`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Persistence/WorkOrderPropertyRepository.cs#L37)
- **Problem:** Contacts are deleted and committed before the insert. Phone is varchar(32) and its length is never validated.
- **Impact:** The insert fails with a 500 and the property is left with no contacts.
- **Fix:** Validate or widen the column, and run the delete and insert in one transaction.

#### A-069

**🟡 MEDIUM — Row versions are never sent to clients, so stale saves overwrite silently**

- **Where:** [`backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Data/CaseStudyModel.cs:72`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Data/CaseStudyModel.cs#L72), [`backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/WorkOrderPropertyCommands.cs:89`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/WorkOrderPropertyCommands.cs#L89)
- **Problem:** xmin is only compared against a fresh read, and no DTO carries a version or If-Match.
- **Impact:** Concurrent edits, and offline replays that arrive hours later, discard another user's changes without warning.
- **Fix:** Return a version and require it on property and submission writes, or PATCH per card.

#### A-070

**🟡 MEDIUM — Grouped-property suggestions scan a random 500 properties**

- **Where:** [`backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Persistence/PropertyGroupRepository.cs:37`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Persistence/PropertyGroupRepository.cs#L37)
- **Problem:** Candidates are ordered by random v4 GUID and capped at 500.
- **Impact:** Once there are more than 500 properties, matching deeds in other POs are mostly missed.
- **Fix:** Pre-filter in SQL on the deed, plan and location signals.

#### A-137

**⚪ LOW — Redistribution skips non-open children but still records the new assignee on the parent**

- **Where:** [`backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/WorkflowTaskDistributionCommands.cs:246`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/WorkflowTaskDistributionCommands.cs#L246)
- **Problem:** Blocked or completed children are skipped, yet DistributionJson is rewritten anyway.
- **Impact:** The UI names the new inspector while the old one still holds the task.
- **Fix:** Reassign Blocked children too, or report which parties could not be reassigned.

#### A-138

**⚪ LOW — Concurrent group links create duplicate memberships and crash suggestions**

- **Where:** [`backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/PropertyGroupService.cs:59`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/PropertyGroupService.cs#L59)
- **Problem:** There is no unique index, and ToDictionary throws on the duplicate.
- **Impact:** Suggestions return 500 for every property.
- **Fix:** Add a unique filtered index and use GroupBy instead of ToDictionary.

#### A-139

**⚪ LOW — Deleting a PO orphans Financial fee ledgers**

- **Where:** [`backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Persistence/WorkOrderRepository.cs:77`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Persistence/WorkOrderRepository.cs#L77)
- **Problem:** The cascade never clears Financial ledgers, and the timeline delete commits on its own.
- **Impact:** Ledgers for deleted POs can still be billed and paid.
- **Fix:** Publish a PO-deleted event, and use one transaction.

#### A-140

**⚪ LOW — Removing a property ignores the result of task deletion**

- **Where:** [`apps/mfe-case-study/src/lib/app-data/tasks-commands.ts:86`](../../apps/mfe-case-study/src/lib/app-data/tasks-commands.ts#L86)
- **Problem:** The ApiErr result is discarded and success is reported.
- **Impact:** Party tasks stay open on a removed property.
- **Fix:** Surface the failure, or close the tasks server-side.

### Failures, keys and operations

Eviction holds overwrite or strand failures. Resolving one failure unblocks the property while another is still active. Key-envelope deletes destroy custody and fee records. Court-visit fees go to the wrong person.

#### A-025

**🟠 HIGH — Registering an eviction overwrites an existing failure, and lifting it resolves unrelated failures**

- **Where:** [`backend/contexts/failures/RealEstateEval.Failures.Application/Services/FailureService.Holds.cs:31`](../../backend/contexts/failures/RealEstateEval.Failures.Application/Services/FailureService.Holds.cs#L31), [`backend/contexts/failures/RealEstateEval.Failures.Infrastructure/Persistence/FailureRepository.cs:165`](../../backend/contexts/failures/RealEstateEval.Failures.Infrastructure/Persistence/FailureRepository.cs#L165)
- **Problem:** The hold reuses the latest unresolved failure (even an Approved or internal one) and replaces its type, title and note. The lift resolves any 'access-denied' row.
- **Impact:** Failures raised by people lose their data and are closed without review.
- **Fix:** Always create a separate system hold row, and resolve only rows the system created.

#### A-071

**🟡 MEDIUM — Resolving one failure unblocks the property while another is still active**

- **Where:** [`backend/contexts/failures/RealEstateEval.Failures.Application/Services/FailureService.cs:347`](../../backend/contexts/failures/RealEstateEval.Failures.Application/Services/FailureService.cs#L347)
- **Problem:** Resolve and return set the deed to «فعال» and reopen tasks without checking for other failures.
- **Impact:** Work resumes on a property that still has an unreviewed or approved failure.
- **Fix:** Recompute the deed status and blocking from the failures that remain.

#### A-072

**🟡 MEDIUM — Key-envelope delete removes the custody history and collected fees, and too many roles can do it**

- **Where:** [`backend/contexts/operations/RealEstateEval.Operations.Application/Services/KeyEnvelopesService.cs:94`](../../backend/contexts/operations/RealEstateEval.Operations.Application/Services/KeyEnvelopesService.cs#L94), [`backend/services/operations/RealEstateEval.Operations.Api/Controllers/KeyEnvelopesController.cs:100`](../../backend/services/operations/RealEstateEval.Operations.Api/Controllers/KeyEnvelopesController.cs#L100), [`backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Services/KeyReceiptFeeChargeService.cs:38`](../../backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Services/KeyReceiptFeeChargeService.cs#L38)
- **Problem:** Delete checks no status, handoff or fee state. It hard-deletes the timeline and even collected charges, and reviewers, specialists and the GM can call it.
- **Impact:** The audit trail and collected revenue disappear, and Enfaz key-revenue lines point at nothing.
- **Fix:** Refuse deletion after a handoff, entitlement or collection, void instead of deleting, and use a dedicated capability.

#### A-073

**🟡 MEDIUM — Court-visit fee is priced for one person and credited to another**

- **Where:** [`backend/contexts/operations/RealEstateEval.Operations.Application/Services/OperationsTaskCommands.cs:224`](../../backend/contexts/operations/RealEstateEval.Operations.Application/Services/OperationsTaskCommands.cs#L224)
- **Problem:** The fee is resolved before ApplyExecutionCredit changes who gets the credit.
- **Impact:** Employees are billed cooperator fees and cooperators go unpaid.
- **Fix:** Apply the credit first, then price for the credited person.

#### A-074

**🟡 MEDIUM — Court-visit charge backfill stalls after 100 employee visits**

- **Where:** [`backend/contexts/operations/RealEstateEval.Operations.Infrastructure/Services/OperationsTaskVisitFeeHelper.cs:164`](../../backend/contexts/operations/RealEstateEval.Operations.Infrastructure/Services/OperationsTaskVisitFeeHelper.cs#L164)
- **Problem:** It always takes the oldest 100 uncharged visits, which are employee visits that never get a charge.
- **Impact:** Genuinely orphaned cooperator visits are never charged.
- **Fix:** Exclude visits that can never be charged in SQL, or page through all orphans.

#### A-075

**🟡 MEDIUM — Lifting an eviction can leave the hold on for good**

- **Where:** [`backend/contexts/operations/RealEstateEval.Operations.Application/Services/KeyEnvelopesService.CourtAccess.cs:288`](../../backend/contexts/operations/RealEstateEval.Operations.Application/Services/KeyEnvelopesService.CourtAccess.cs#L288)
- **Problem:** The row is saved before the failures-service call, and the side effect depends on the previous state, so a retry does nothing.
- **Impact:** Tasks stay blocked while the screen shows no eviction.
- **Fix:** Whenever the desired state is not eviction, call the idempotent resolve, or use the outbox.

#### A-076

**🟡 MEDIUM — Suspending a transaction takes two client calls, and a partial failure cannot be retried**

- **Where:** [`apps/mfe-case-study/src/lib/app-data/suspend-property-transaction.ts:23`](../../apps/mfe-case-study/src/lib/app-data/suspend-property-transaction.ts#L23)
- **Problem:** The failure is suspended first. If blocking the tasks then fails, the retry is refused with «معلّقة مسبقاً».
- **Impact:** Parties keep working on a transaction the office has suspended.
- **Fix:** Block the tasks server-side as part of the suspend command, or let a retry run only the task step.

#### A-077

**🟡 MEDIUM — Register-envelope modal locks up when an attachment is refused**

- **Where:** [`apps/mfe-keys/src/components/useRegisterKeyEnvelopeWorkflow.ts:178`](../../apps/mfe-keys/src/components/useRegisterKeyEnvelopeWorkflow.ts#L178)
- **Problem:** The upload rejects with no try/finally, so `uploading` stays true.
- **Impact:** Every button stays disabled and the typed data is lost.
- **Fix:** Return errors instead of throwing, and reset the flag in a finally block.

#### A-078

**🟡 MEDIUM — Envelopes registered offline have no deed assignments**

- **Where:** [`apps/mfe-keys/src/components/useRegisterKeyEnvelopeWorkflow.ts:109`](../../apps/mfe-keys/src/components/useRegisterKeyEnvelopeWorkflow.ts#L109), [`backend/contexts/operations/RealEstateEval.Operations.Application/Services/KeyEnvelopesService.cs:158`](../../backend/contexts/operations/RealEstateEval.Operations.Application/Services/KeyEnvelopesService.cs#L158)
- **Problem:** The linked-property lookup needs the network, and the server adds assignments only from the request.
- **Impact:** Key matching in the field becomes impossible for those deeds.
- **Fix:** When a request has no assignments, resolve them on the server by request number.

#### A-141

**⚪ LOW — Key gate says keys are with the inspector after they were returned**

- **Where:** [`backend/contexts/operations/RealEstateEval.Operations.Infrastructure/Services/PropertyKeyGateResolver.cs:121`](../../backend/contexts/operations/RealEstateEval.Operations.Infrastructure/Services/PropertyKeyGateResolver.cs#L121)
- **Problem:** It uses any historical handoff, and handoff kinds are not validated against the current state.
- **Impact:** The inspector drives to the site without keys.
- **Fix:** Derive from the latest custody state and validate transitions.

#### A-142

**⚪ LOW — Anyone with key-data access can confirm another person's handoff**

- **Where:** [`backend/contexts/operations/RealEstateEval.Operations.Application/Services/KeyEnvelopesService.Handoffs.cs:124`](../../backend/contexts/operations/RealEstateEval.Operations.Application/Services/KeyEnvelopesService.Handoffs.cs#L124)
- **Problem:** The actor is never compared with ToUserId.
- **Impact:** The custody chain is no longer backed by the receiver's confirmation.
- **Fix:** Require the receiver, or a recorded manager override.

#### A-143

**⚪ LOW — Any party user can raise an internal failure on any property**

- **Where:** [`backend/contexts/failures/RealEstateEval.Failures.Application/Services/FailureService.cs:173`](../../backend/contexts/failures/RealEstateEval.Failures.Application/Services/FailureService.cs#L173)
- **Problem:** There is no assignment check, no PO match, and the role comes from the request body.
- **Impact:** Unrelated properties can be blocked.
- **Fix:** Require an assignment, match the PO, and take the role from auth.

#### A-144

**⚪ LOW — Failure resolve, approve and return commit first, then make uncompensated HTTP writes**

- **Where:** [`backend/contexts/failures/RealEstateEval.Failures.Application/Services/FailureService.cs:345`](../../backend/contexts/failures/RealEstateEval.Failures.Application/Services/FailureService.cs#L345)
- **Problem:** A failed follow-up call cannot be retried, because the retry is refused as a state change.
- **Impact:** Deeds and tasks stay blocked.
- **Fix:** Drive side effects through the outbox, or re-run them when already in the target state.

### Finance and billing

Cancelled statements strand fees. Invoice re-issue wipes collections. Invoices are issued from stale lines and their totals don't add up. Discount scoping is bypassed, and totals come from lists capped at 500 rows.

#### A-026

**🟠 HIGH — Discount flags and incentive suspensions skip department scoping and allow self-approval**

- **Where:** [`backend/services/financial/RealEstateEval.Financial.Api/Controllers/FinancialController.cs:321`](../../backend/services/financial/RealEstateEval.Financial.Api/Controllers/FinancialController.cs#L321), [`backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Services/DiscountFlagService.cs:182`](../../backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Services/DiscountFlagService.cs#L182)
- **Problem:** Any manage-operations holder, including specialists and reviewers, is given all-department rights. The approver is never compared with the flagger or the target assignee.
- **Impact:** A reviewer can reject flags on their own fee or lift their own suspension, and supervisors can discount another department's lines.
- **Fix:** Build the actor context the way InspectorFeesController does. Allow only section supervisors and above, and forbid self-approval and self-targeting.

#### A-027

**🟠 HIGH — Cancelling a party billing statement strands its fees permanently**

- **Where:** [`backend/contexts/financial/RealEstateEval.Financial.Application/Services/PartyBillingStatementService.cs:338`](../../backend/contexts/financial/RealEstateEval.Financial.Application/Services/PartyBillingStatementService.cs#L338), [`backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Persistence/PartyBillingStatementRepository.cs:23`](../../backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Persistence/PartyBillingStatementRepository.cs#L23)
- **Problem:** Cancel returns the ledgers to at-finance but keeps the statement lines, and those still count as claimed.
- **Impact:** Those fees and court-visit charges can never be billed or paid through the system again.
- **Fix:** Delete (and snapshot) the lines on cancel, or exclude cancelled statements from the claimed keys. Add a cancel-then-rebill test.

#### A-028

**🟠 HIGH — Enfaz invoice is issued from the last-saved lines while the screen shows unsaved totals**

- **Where:** [`apps/mfe-financial/src/components/FinanceEnfazBillingActions.tsx:63`](../../apps/mfe-financial/src/components/FinanceEnfazBillingActions.tsx#L63), [`apps/mfe-financial/src/components/useFinanceEnfazPoBillingWorkflow.ts:154`](../../apps/mfe-financial/src/components/useFinanceEnfazPoBillingWorkflow.ts#L154)
- **Problem:** Issue is enabled from the server state while the totals on screen come from the local draft, and issue never saves first.
- **Impact:** The official invoice carries the old figures, the edits are discarded, and the issued invoice cannot be edited afterwards.
- **Fix:** Track a dirty flag and block issue until saved, or save and refetch before issuing.

#### A-079

**🟡 MEDIUM — Re-issuing an Enfaz invoice wipes recorded collections**

- **Where:** [`backend/contexts/financial/RealEstateEval.Financial.Application/Services/PoEnfazBillingService.cs:186`](../../backend/contexts/financial/RealEstateEval.Financial.Application/Services/PoEnfazBillingService.cs#L186), [`backend/contexts/financial/RealEstateEval.Financial.Application/Rules/PoEnfazInvoiceRules.cs:40`](../../backend/contexts/financial/RealEstateEval.Financial.Application/Rules/PoEnfazInvoiceRules.cs#L40)
- **Problem:** Nothing stops a second issue. It assigns a new number, resets CollectedAmountSar to 0 and reuses stale stored totals. Lines also stay editable after issue.
- **Impact:** Collections vanish from aging and revenue with no audit, and the tax invoice number changes without a credit note.
- **Fix:** Refuse to re-issue an issued or collected invoice (or require an explicit, audited flow), and refuse line edits after issue.

#### A-080

**🟡 MEDIUM — Payee and valuation totals are summed from lists capped at 500 rows**

- **Where:** [`apps/mfe-financial/src/components/FinanceCostPartiesList.tsx:105`](../../apps/mfe-financial/src/components/FinanceCostPartiesList.tsx#L105), [`apps/mfe-valuation/src/views/ValuationRequestsView.tsx:140`](../../apps/mfe-valuation/src/views/ValuationRequestsView.tsx#L140)
- **Problem:** The server truncates to 500 rows without saying so, and failed loads read as empty. Properties outside the capped slice are labelled «عقار محذوف».
- **Impact:** Balances and KPIs are understated once volume grows.
- **Fix:** Add server-side aggregate and count endpoints, throw on load failure, and resolve labels by id.

#### A-081

**🟡 MEDIUM — The printed tax invoice does not add up**

- **Where:** [`backend/contexts/financial/RealEstateEval.Financial.Application/Rules/PoEnfazBillingDtoBuilder.cs:29`](../../backend/contexts/financial/RealEstateEval.Financial.Application/Rules/PoEnfazBillingDtoBuilder.cs#L29), [`backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Services/EnfazInvoicePdfGenerator.cs:172`](../../backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Services/EnfazInvoicePdfGenerator.cs#L172)
- **Problem:** The subtotal excludes key fees but the total includes them, and the VAT inside key fees is never declared.
- **Impact:** On a government tax invoice, subtotal + VAT ≠ total and VAT is understated.
- **Fix:** Add a key-fee row or net key fees into the subtotal, declare the embedded VAT, and store the key fee on the invoice.

#### A-082

**🟡 MEDIUM — Court-visit reviewer KPIs double-count fees on issued payment orders**

- **Where:** [`apps/mfe-case-study/src/components/fees/party-individual-fees-state.ts:300`](../../apps/mfe-case-study/src/components/fees/party-individual-fees-state.ts#L300)
- **Problem:** Charges on an issued statement are counted in both the open sum and the statement sum.
- **Impact:** Reviewer dues are overstated until the order closes.
- **Fix:** Exclude charges that already appear on open statement lines.

#### A-145

**⚪ LOW — Survey acceptance wraps a remote fee accrual in a local transaction**

- **Where:** [`backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/PartyTaskSubmissionService.Accept.cs:45`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Services/PartyTaskSubmissionService.Accept.cs#L45)
- **Problem:** Financial commits the fee even when the local acceptance rolls back.
- **Impact:** Offices can be paid for surveys that were never accepted.
- **Fix:** Accept first, then accrue after commit or through the outbox.

#### A-146

**⚪ LOW — Closing or cancelling a statement changes ledgers that were never on it**

- **Where:** [`backend/contexts/financial/RealEstateEval.Financial.Application/Services/PartyBillingStatementService.cs:220`](../../backend/contexts/financial/RealEstateEval.Financial.Application/Services/PartyBillingStatementService.cs#L220)
- **Problem:** Close and cancel act on every ledger of the task instead of filtering by statement id.
- **Impact:** Unbilled ledgers are marked paid, and suspended ones are pushed to finance.
- **Fix:** Filter by PartyBillingStatementId.

#### A-147

**⚪ LOW — PoEnfazInvoice has no concurrency token**

- **Where:** [`backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Data/FinancialModel.cs:86`](../../backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Data/FinancialModel.cs#L86)
- **Problem:** Concurrent collections are last-write-wins.
- **Impact:** One receipt disappears from the invoice.
- **Fix:** Add UseOptimisticConcurrency and map conflicts to 409.

#### A-148

**⚪ LOW — Batch fee transition returns rows from before the save and drops some lines**

- **Where:** [`backend/contexts/financial/RealEstateEval.Financial.Application/Services/InspectorFeeService.cs:361`](../../backend/contexts/financial/RealEstateEval.Financial.Application/Services/InspectorFeeService.cs#L361)
- **Problem:** Rows are read before SaveChanges, and a null row suppresses the save.
- **Impact:** Stale statuses are reported, and a lone line's approval can be discarded.
- **Fix:** Save once, then read the rows and report nulls explicitly.

#### A-149

**⚪ LOW — Supervisor discount has no upper bound**

- **Where:** [`backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Persistence/FinancialReportRepository.cs:58`](../../backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Persistence/FinancialReportRepository.cs#L58)
- **Problem:** The discount can exceed the fee, and the report subtracts the raw amount.
- **Impact:** Negative costs and overstated margin.
- **Fix:** Validate 0 ≤ discount ≤ fee, and clamp in the report.

#### A-150

**⚪ LOW — Lifting an incentive suspension also lifts the supervisor's line suspensions**

- **Where:** [`backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Services/IncentiveSuspensionService.cs:232`](../../backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Services/IncentiveSuspensionService.cs#L232)
- **Problem:** Nothing records which mechanism suspended each line.
- **Impact:** Withheld lines become billable.
- **Fix:** Record the suspension source on each line.

#### A-151

**⚪ LOW — Billing invoice form carries over between statements, and the picker accepts files the server rejects**

- **Where:** [`apps/mfe-case-study/src/components/fees/PartyOfficeBillingStatementsPanel.tsx:92`](../../apps/mfe-case-study/src/components/fees/PartyOfficeBillingStatementsPanel.tsx#L92), [`apps/mfe-case-study/src/components/fees/VendorInvoicePdfField.tsx:16`](../../apps/mfe-case-study/src/components/fees/VendorInvoicePdfField.tsx#L16)
- **Problem:** There is one shared draft and the upload form is shown to non-owners. The picker allows HEIC, drops rejected files silently and has no size check.
- **Impact:** Invoices end up attached to the wrong statement, orphan uploads remain, and errors are confusing.
- **Fix:** Key the draft by statement, show it only to the payee, and validate type and size up front.

### Valuation and report output

Arabic is unreadable in server PDFs. Wrong land value under the whole-property basis. The reconciliation screen and server disagree. Adoptions are silently undone. ق-6 issuance is unreachable, and report tables and words don't reconcile.

#### A-029

**🟠 HIGH — Server-generated report and invoice PDFs print Arabic as boxes in production**

- **Where:** [`backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ValuationReportPdfGenerator.cs:40`](../../backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ValuationReportPdfGenerator.cs#L40), [`backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Services/EnfazInvoicePdfGenerator.cs:59`](../../backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Services/EnfazInvoicePdfGenerator.cs#L59), `Valuation.Api/Dockerfile:18`
- **Problem:** QuestPDF asks for Tahoma, Arial, Noto or DejaVu, and none is installed in the Linux images. Only the Latin Lato font is bundled.
- **Impact:** The issued valuation report and the tax invoice to Enfath are unreadable. Development on Windows hides the problem.
- **Fix:** Ship and register an Arabic font (or install fonts-noto-core), enable CheckIfAllTextGlyphsAreAvailable, and add a container render test.

#### A-030

**🟠 HIGH — Cost approach multiplies a whole-property land value by land area**

- **Where:** [`backend/contexts/valuation/RealEstateEval.Valuation.Application/Services/ValuationCostApproachService.cs:168`](../../backend/contexts/valuation/RealEstateEval.Valuation.Application/Services/ValuationCostApproachService.cs#L168)
- **Problem:** Under the whole_property basis, WeightedPricePerSqm is a total deal value, but the cost service still multiplies it by the land area.
- **Impact:** Land value is inflated by orders of magnitude (for example 405,000,000 SAR), and any cost weight corrupts the final opinion.
- **Fix:** Under whole_property, use the value directly or derive a per-m² rate. Add a unit test.

#### A-031

**🟠 HIGH — Reconciliation screen and server disagree on weights and final value**

- **Where:** [`apps/mfe-evaluator/src/components/evaluator/valuation-work/FinalOpinionSection.tsx:205`](../../apps/mfe-evaluator/src/components/evaluator/valuation-work/FinalOpinionSection.tsx#L205), [`apps/mfe-evaluator/src/components/evaluator/valuation-work/lib/final-opinion-state.ts:36`](../../apps/mfe-evaluator/src/components/evaluator/valuation-work/lib/final-opinion-state.ts#L36), [`backend/contexts/valuation/RealEstateEval.Valuation.Application/Services/ValuationReconciliationService.cs:350`](../../backend/contexts/valuation/RealEstateEval.Valuation.Application/Services/ValuationReconciliationService.cs#L350)
- **Problem:** The UI sums every method and ignores isIncluded, and an auto-filled method stays excluded. With a single method, a weight saved as 0 stays 0 on the server while the UI shows the market value.
- **Impact:** The saved final opinion is far below what the appraiser saw, and issuance is blocked.
- **Fix:** Mirror the server rules exactly and set isIncluded on auto-fill. On the server, force weight 100 and included for a sole method.

#### A-032

**🟠 HIGH — Adopted comparables are silently un-adopted on every load**

- **Where:** [`apps/mfe-evaluator/src/components/evaluator/valuation-work/useValuationWorkData.ts:158`](../../apps/mfe-evaluator/src/components/evaluator/valuation-work/useValuationWorkData.ts#L158), [`apps/mfe-evaluator/src/components/evaluator/valuation-work/lib/bank-ranking.ts:224`](../../apps/mfe-evaluator/src/components/evaluator/valuation-work/lib/bank-ranking.ts#L224)
- **Problem:** The inspector pin is fetched with propertyId instead of the inspection task id, so the subject falls back to a district or city centroid (Riyadh for unknown cities). Comparables that then look 'far' are auto-un-adopted.
- **Impact:** Market value and the final opinion change on reopen without the appraiser doing anything.
- **Fix:** Pass the inspection task id. Never auto-un-adopt; at most flag distant comparables in the UI.

#### A-033

**🟠 HIGH — Two-stage ق-6 issuance is unreachable and issuance gates run only in the browser**

- **Where:** [`apps/mfe-evaluator/src/components/evaluator/valuation-work/useReportIssuanceWorkflow.ts:21`](../../apps/mfe-evaluator/src/components/evaluator/valuation-work/useReportIssuanceWorkflow.ts#L21), [`backend/services/valuation/RealEstateEval.Valuation.Api/Controllers/ValuationReportDocumentController.cs:34`](../../backend/services/valuation/RealEstateEval.Valuation.Api/Controllers/ValuationReportDocumentController.cs#L34), [`apps/mfe-evaluator/src/components/evaluator/EvaluatorWindow.tsx:345`](../../apps/mfe-evaluator/src/components/evaluator/EvaluatorWindow.tsx#L345)
- **Problem:** The deposit and certificate UI was unwired in b024904e. The real submit stores the ungated preview PDF, and the client skips the gate check when the gate call errors.
- **Impact:** No frozen deposit copy or certificate page is ever produced, and reports can be issued with an expired licence or missing attachments.
- **Fix:** Restore the issuance card, or record the decision in the log. Use one server-gated issue endpoint and fail closed on gate errors.

#### A-083

**🟡 MEDIUM — Server report prints the bank's price and area instead of this valuation's overrides**

- **Where:** [`backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ValuationReportDocumentService.cs:157`](../../backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ValuationReportDocumentService.cs#L157), [`backend/contexts/valuation/RealEstateEval.Valuation.Application/Services/ValuationReportFieldInjectionService.cs:283`](../../backend/contexts/valuation/RealEstateEval.Valuation.Application/Services/ValuationReportFieldInjectionService.cs#L283)
- **Problem:** The report uses the raw bank DTO rather than the effective (overridden) values.
- **Impact:** The printed evidence contradicts the concluded value.
- **Fix:** Use EffectivePrice, EffectiveArea and EffectivePricePerSqm, and label values by basis.

#### A-084

**🟡 MEDIUM — The 'reconciliation not saved' gate can never fire**

- **Where:** [`backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ValuationIssuanceGateService.cs:95`](../../backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ValuationIssuanceGateService.cs#L95)
- **Problem:** A final value computed live satisfies the gate, and MethodsRationale is never required.
- **Impact:** Reports issue with no method rationale, and a liquidation basis with a 0% discount is never confirmed by the valuer.
- **Fix:** Base the gate on a persisted row, require the rationale (11ل) and an explicit liquidation discount.

#### A-085

**🟡 MEDIUM — Report preview and print can use a stale 60-second bundle**

- **Where:** [`apps/mfe-evaluator/src/components/evaluator/EvaluatorValuationReportOutputTab.tsx:112`](../../apps/mfe-evaluator/src/components/evaluator/EvaluatorValuationReportOutputTab.tsx#L112)
- **Problem:** Cost, reconciliation and matrix saves don't invalidate the report query.
- **Impact:** The printed report shows the old final value and old tables.
- **Fix:** Invalidate the query after every valuation write, or refetch inside print().

#### A-086

**🟡 MEDIUM — Valuation screens stay editable after the appraiser submits**

- **Where:** [`apps/mfe-evaluator/src/components/evaluator/valuation-work/ValuationWorkShell.tsx:499`](../../apps/mfe-evaluator/src/components/evaluator/valuation-work/ValuationWorkShell.tsx#L499)
- **Problem:** Only the review screen is locked, the server accepts writes until Done or frozen, and the price sync is then blocked.
- **Impact:** The printed value drifts from the submitted value the specialist reviewed.
- **Fix:** Pass the lock to every section, and have the server reject writes after submission.

#### A-087

**🟡 MEDIUM — Actual and economic age justifications are never saved**

- **Where:** [`apps/mfe-evaluator/src/components/evaluator/valuation-work/lib/cost-approach-state.ts:151`](../../apps/mfe-evaluator/src/components/evaluator/valuation-work/lib/cost-approach-state.ts#L151)
- **Problem:** The inputs exist, but the DTO has no fields for them and they are reset on load.
- **Impact:** The basis for depreciation disappears from the report.
- **Fix:** Add the fields end to end, or remove the inputs.

#### A-088

**🟡 MEDIUM — Retrospective valuation date is replaced by the submission date**

- **Where:** [`apps/mfe-evaluator/src/lib/evaluator/finalize-appraiser-submission.ts:57`](../../apps/mfe-evaluator/src/lib/evaluator/finalize-appraiser-submission.ts#L57), [`apps/mfe-evaluator/src/components/evaluator/evaluator-report-output-helpers.ts:195`](../../apps/mfe-evaluator/src/components/evaluator/evaluator-report-output-helpers.ts#L195)
- **Problem:** Finalize stamps appraisalDate with today's date, and the draft date is checked before retrospective mode.
- **Impact:** The printed report and the Enfath upload say today, while the frozen PDF has the retrospective date.
- **Fix:** In retrospective mode, set appraisalDate to the retrospective date and check the mode first, including server injection.

#### A-089

**🟡 MEDIUM — Report tables don't reconcile: adjustments grid omits factors and the cost table shows raw quantity and rate**

- **Where:** [`apps/mfe-evaluator/src/lib/evaluator/valuation-report-sheet-facts.ts:617`](../../apps/mfe-evaluator/src/lib/evaluator/valuation-report-sheet-facts.ts#L617), [`apps/mfe-evaluator/src/lib/evaluator/valuation-report-sheet-facts.ts:309`](../../apps/mfe-evaluator/src/lib/evaluator/valuation-report-sheet-facts.ts#L309)
- **Problem:** Transaction type, attraction, access and custom factors have no row. Direct-cost rows print raw quantity × rate beside the effective total, and the server upload flatten does the same.
- **Impact:** A reader of the legal report cannot rebuild its figures.
- **Fix:** Add the missing rows or an 'other adjustments' row, print the effective quantity and rate, and fix the server flatten.

#### A-090

**🟡 MEDIUM — Infath upload assistant shows wrong or stale values and misses existing files**

- **Where:** [`apps/mfe-case-study/src/lib/app-data/infath-upload-model.ts:71`](../../apps/mfe-case-study/src/lib/app-data/infath-upload-model.ts#L71), [`apps/mfe-case-study/src/lib/app-data/infath-upload-model.ts:231`](../../apps/mfe-case-study/src/lib/app-data/infath-upload-model.ts#L231), [`apps/mfe-case-study/src/lib/app-data/infath-upload-model.ts:354`](../../apps/mfe-case-study/src/lib/app-data/infath-upload-model.ts#L354), [`apps/mfe-case-study/src/components/po-intake/PropertyDetailUploadAssistantRows.tsx:85`](../../apps/mfe-case-study/src/components/po-intake/PropertyDetailUploadAssistantRows.tsx#L85)
- **Problem:** It treats reopened appraisals as final and computes the total as land+building instead of the final value. It copies the whole worker row as the name and styles missing required fields like optional blanks. It shows the deed area as the measured area, and always marks the deposit certificate and case-study form «غير متوفر».
- **Impact:** Staff enter values into Enfath that contradict the signed report, or upload incomplete packages.
- **Fix:** Exclude reopened appraisals and use evaluatorPrice. Use structured worker fields, style missing ('ms') fields as errors, and resolve documents by attachmentId as the documents tab does.

#### A-152

**⚪ LOW — Final-copy issuance skips the submitted event and the prior-valuation bank feed**

- **Where:** [`backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ValuationReportIssuanceService.cs:213`](../../backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ValuationReportIssuanceService.cs#L213)
- **Problem:** The request is marked Done without publishing ValuationReportSubmitted.
- **Impact:** If ق-6 is re-enabled, the appraisal task never closes.
- **Fix:** Share one transition with SubmitReportAsync.

#### A-153

**⚪ LOW — Creating a valuation request with a missing propId throws a NullReferenceException**

- **Where:** [`backend/services/valuation/RealEstateEval.Valuation.Api/Controllers/ValuationRequestsController.cs:93`](../../backend/services/valuation/RealEstateEval.Valuation.Api/Controllers/ValuationRequestsController.cs#L93)
- **Problem:** property_id_required is unmapped, and the dispatch route returns 204.
- **Impact:** A 500, or false success for Case Study.
- **Fix:** Map it to 400 in both controllers.

#### A-154

**⚪ LOW — Prior-valuation bank feed failures are swallowed**

- **Where:** [`backend/services/valuation/RealEstateEval.Valuation.Api/Controllers/ValuationRequestsController.cs:119`](../../backend/services/valuation/RealEstateEval.Valuation.Api/Controllers/ValuationRequestsController.cs#L119)
- **Problem:** The catch neither logs nor retries.
- **Impact:** Valuations silently never reach the comparable bank.
- **Fix:** Log, and feed from an outbox consumer.

#### A-155

**⚪ LOW — A stale liquidation discount blocks every later reconciliation save**

- **Where:** [`apps/mfe-evaluator/src/components/evaluator/valuation-work/lib/final-opinion-state.ts:248`](../../apps/mfe-evaluator/src/components/evaluator/valuation-work/lib/final-opinion-state.ts#L248)
- **Problem:** A hidden field keeps sending the discount after the basis changes.
- **Impact:** Every save returns 400 with no way to fix it.
- **Fix:** Send 0 when the basis is not liquidation.

#### A-156

**⚪ LOW — Repeated-floors quantity keeps a stale area on the server**

- **Where:** [`backend/contexts/valuation/RealEstateEval.Valuation.Application/Services/ValuationCostApproachService.cs:202`](../../backend/contexts/valuation/RealEstateEval.Valuation.Application/Services/ValuationCostApproachService.cs#L202)
- **Problem:** With count 0 or no first floor, the server keeps the old derived area.
- **Impact:** The direct cost is overstated.
- **Fix:** Always derive the quantity on the server.

### Saving, concurrency and error handling (UI)

Autosaves overwrite with stale snapshots, failed saves report success, and load errors show as empty lists or zeros.

#### A-034

**🟠 HIGH — Property edit reopens an old in-memory autosave instead of server data and writes it back**

- **Where:** [`apps/mfe-case-study/src/components/po-intake/PoPropertyEdit.tsx:209`](../../apps/mfe-case-study/src/components/po-intake/PoPropertyEdit.tsx#L209), [`apps/mfe-case-study/src/lib/app-data/property-field-autosave.ts:166`](../../apps/mfe-case-study/src/lib/app-data/property-field-autosave.ts#L166)
- **Problem:** Autosave drafts are never dropped after a successful save and win over the fetched property on reopen. The next keystroke PUTs the whole stale object.
- **Impact:** Accepted inspector boundaries and other users' corrections and contacts are silently reverted.
- **Fix:** Drop drafts once saved, or keep them only while newer than the server's updatedAt, and send a row version with draft PUTs.

#### A-091

**🟡 MEDIUM — Quick edits in the adjustments matrix overwrite each other**

- **Where:** [`apps/mfe-evaluator/src/components/evaluator/valuation-work/useAdjustmentsMatrixCommands.ts:69`](../../apps/mfe-evaluator/src/components/evaluator/valuation-work/useAdjustmentsMatrixCommands.ts#L69)
- **Problem:** Each queued PUT carries a full-row snapshot from render time, and the server replaces every line.
- **Impact:** Earlier cell edits revert and the market value is wrong.
- **Fix:** Build the lines inside the queued task from the latest state and apply each PUT response, or use per-cell patches with a version.

#### A-092

**🟡 MEDIUM — Evaluator draft autosave drops pending patches and reverts local state**

- **Where:** [`apps/mfe-evaluator/src/components/evaluator/EvaluatorWindow.tsx:236`](../../apps/mfe-evaluator/src/components/evaluator/EvaluatorWindow.tsx#L236)
- **Problem:** Only the last patch survives the 400 ms timer, each PUT merges onto the last server copy, and submit re-sends only 13 fields.
- **Impact:** Report choices and notes are lost without warning.
- **Fix:** Accumulate and serialize patches over the local draft, and submit the full draft.

#### A-093

**🟡 MEDIUM — Photo uploads save a pre-upload copy of the form**

- **Where:** [`apps/mfe-case-study/src/components/field-inspection/InspectorObservationsSection.tsx:154`](../../apps/mfe-case-study/src/components/field-inspection/InspectorObservationsSection.tsx#L154), [`apps/mfe-case-study/src/components/field-inspection/InspectorFeaturesSection.tsx:246`](../../apps/mfe-case-study/src/components/field-inspection/InspectorFeaturesSection.tsx#L246)
- **Problem:** After the upload await, the patch is built from the draft as it was at render time.
- **Impact:** Text typed while a photo uploads is reverted and then saved.
- **Fix:** Apply the result to the latest draft with an updater function.

#### A-094

**🟡 MEDIUM — Case-study note saves the whole form on every keystroke**

- **Where:** [`apps/mfe-case-study/src/components/case-study/useCaseStudyFormCommands.ts:211`](../../apps/mfe-case-study/src/components/case-study/useCaseStudyFormCommands.ts#L211)
- **Problem:** Saves are neither debounced nor serialized, and the server re-applies older bodies after a conflict.
- **Impact:** The stored note can end up truncated.
- **Fix:** Debounce and keep only the latest save, and have the server reject older writes.

#### A-095

**🟡 MEDIUM — Location-and-area card reports a successful save but can wipe area and deed status**

- **Where:** [`apps/mfe-case-study/src/components/po-intake/PoPropertyEdit.tsx:338`](../../apps/mfe-case-study/src/components/po-intake/PoPropertyEdit.tsx#L338), [`apps/mfe-case-study/src/lib/app-data/po-intake-commands.ts:520`](../../apps/mfe-case-study/src/lib/app-data/po-intake-commands.ts#L520), [`backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Rules/WorkOrderPropertyWriteRules.cs:280`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Application/Rules/WorkOrderPropertyWriteRules.cs#L280)
- **Problem:** The explicit save ignores a failed flush and sends the Enfath DTO, which has no area or deedStatus, and the server writes both as null.
- **Impact:** The toast says saved, but after a reload the land area is gone and the report prints it empty.
- **Fix:** Stop ApplyPropertyEnfath writing those fields (or include them), send bourse fields as a draft, and check the flush result.

#### A-096

**🟡 MEDIUM — PO-intake draft loader returns its first cached result and autosaves it over newer data**

- **Where:** [`apps/mfe-case-study/src/lib/app-data/po-intake-reads.ts:205`](../../apps/mfe-case-study/src/lib/app-data/po-intake-reads.ts#L205)
- **Problem:** The hydrate promise caches the first value forever, and the form autosaves right after hydrating.
- **Impact:** Returning to /po in the same tab replaces the saved draft with an empty one.
- **Fix:** Return the current memoryDraft, and autosave only after a real edit.

#### A-097

**🟡 MEDIUM — Load failures show as empty lists and zero KPIs**

- **Where:** [`apps/mfe-dashboard/src/views/DashboardView.tsx:53`](../../apps/mfe-dashboard/src/views/DashboardView.tsx#L53), [`apps/mfe-case-study/src/lib/app-data/operations-tasks-reads.ts:65`](../../apps/mfe-case-study/src/lib/app-data/operations-tasks-reads.ts#L65), [`packages/app-shared/src/app-data/party-billing-statements-api.ts:63`](../../packages/app-shared/src/app-data/party-billing-statements-api.ts#L63)
- **Problem:** Loaders return [] or cached rows on 5xx or 403, and the views ignore isError.
- **Impact:** Managers see «كلها ضمن المهلة» and zero dues, offices see no statements, and inspectors see stale, reassigned tasks.
- **Fix:** Use the cache only for network failures or offline, throw otherwise, and render an error with retry (— rather than 0).

#### A-098

**🟡 MEDIUM — Idempotency key is discarded on a returned failure**

- **Where:** [`packages/app-shared/src/hooks/use-idempotent-action.ts:51`](../../packages/app-shared/src/hooks/use-idempotent-action.ts#L51)
- **Problem:** The key is cleared even when the action returns a failure value.
- **Impact:** Retrying an ambiguous invoice collection counts it twice.
- **Fix:** Keep the key unless the action succeeded, and refetch before the amount can be re-entered.

#### A-099

**🟡 MEDIUM — Specialist report extras autosave is fire-and-forget and overwrites with the device's copy**

- **Where:** [`packages/app-shared/src/storage/specialist-report-extras-sync.ts:94`](../../packages/app-shared/src/storage/specialist-report-extras-sync.ts#L94)
- **Problem:** The result is ignored, the .catch never fires, and each PUT sends the full cached bag.
- **Impact:** Failed saves go unnoticed, and another user's newer changes are overwritten.
- **Fix:** Await the save and show errors, send only changed keys or a version, and serialize the saves.

#### A-100

**🟡 MEDIUM — Survey file save and clear treat a failure object as success**

- **Where:** [`apps/mfe-engineering-office/src/lib/engineering-survey-attachments.ts:232`](../../apps/mfe-engineering-office/src/lib/engineering-survey-attachments.ts#L232)
- **Problem:** A MutationResult object is always truthy, and the file is deleted before the payload is saved.
- **Impact:** The survey can be submitted pointing at a deleted file.
- **Fix:** Check saved.ok, and update the payload before deleting the file.

#### A-157

**⚪ LOW — Inspection submit spinner and property edit skeleton hang forever on errors**

- **Where:** [`apps/mfe-case-study/src/components/field-inspection/useFieldInspectionWorkflow.ts:300`](../../apps/mfe-case-study/src/components/field-inspection/useFieldInspectionWorkflow.ts#L300), [`apps/mfe-case-study/src/components/po-intake/PoPropertyEdit.tsx:204`](../../apps/mfe-case-study/src/components/po-intake/PoPropertyEdit.tsx#L204)
- **Problem:** There is no try/finally and no catch.
- **Impact:** The user has to reload, and sees no error.
- **Fix:** Add try/finally with an error message and a retry state.

#### A-158

**⚪ LOW — Paged queues filter assignment type only within the current page**

- **Where:** [`apps/mfe-case-study/src/views/useActiveTransactionQueueData.ts:333`](../../apps/mfe-case-study/src/views/useActiveTransactionQueueData.ts#L333)
- **Problem:** typeFilter is not sent to the server and does not reset the page.
- **Impact:** Matching rows on other pages are hidden.
- **Fix:** Send assignmentType in the server query.

#### A-159

**⚪ LOW — Dashboard metrics are misleading (false -100% trend; cancelled POs counted)**

- **Where:** [`apps/mfe-dashboard/src/components/dashboard/DashTrendCard.tsx:92`](../../apps/mfe-dashboard/src/components/dashboard/DashTrendCard.tsx#L92), [`apps/mfe-dashboard/src/lib/dashboard-metrics.ts:196`](../../apps/mfe-dashboard/src/lib/dashboard-metrics.ts#L196)
- **Problem:** The trend compares padded future slots, and cancelled POs count as remaining.
- **Impact:** A red -100% arrow, and completion is understated.
- **Fix:** Compare the current period with the previous one, and exclude cancelled POs.

#### A-160

**⚪ LOW — Slot delete returns 422 with a bare dictionary**

- **Where:** [`backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/WorkflowTasksController.cs:184`](../../backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/WorkflowTasksController.cs#L184)
- **Problem:** The client cannot parse the reason from that body.
- **Impact:** The user sees «يرجى مراجعة الحقول المطلوبة» instead of the real reason.
- **Fix:** Use FieldErrorsProblem.

### Dates, numbers and Arabic text

UTC used where Riyadh time is meant. Report numbers are not annual sequences. Commas and Arabic digits are misparsed. Amounts in words are wrong.

#### A-101

**🟡 MEDIUM — Final value in words prints «ريال سعودي» twice**

- **Where:** [`apps/mfe-evaluator/src/lib/evaluator/valuation-report-fill-model.ts:1235`](../../apps/mfe-evaluator/src/lib/evaluator/valuation-report-fill-model.ts#L1235)
- **Problem:** The words function already adds the currency, and the caller adds it again.
- **Impact:** The currency is duplicated on every report.
- **Fix:** Drop the outer currency and add a test.

#### A-102

**🟡 MEDIUM — Arabic amount words are wrong for thousands or millions counts over 10**

- **Where:** [`backend/contexts/valuation/RealEstateEval.Valuation.Domain/ArabicAmountWords.cs:86`](../../backend/contexts/valuation/RealEstateEval.Valuation.Domain/ArabicAmountWords.cs#L86), [`apps/mfe-evaluator/src/lib/evaluator/arabic-amount-words.ts:83`](../../apps/mfe-evaluator/src/lib/evaluator/arabic-amount-words.ts#L83)
- **Problem:** The grammatical form is chosen from the whole count instead of count % 100, and «مائتان» is used before a noun.
- **Impact:** For example, 103,000 prints «مائة وثلاثة ألف» in the report tafqit.
- **Fix:** Branch on count % 100 as the reference does, and add tests in both C# and TS.

#### A-103

**🟡 MEDIUM — Server 'today' and document dates use UTC instead of Riyadh time**

- **Where:** [`backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Services/EnfazInvoicePdfGenerator.cs:38`](../../backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Services/EnfazInvoicePdfGenerator.cs#L38), [`backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ValuationReportDocumentService.cs:106`](../../backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ValuationReportDocumentService.cs#L106), [`backend/contexts/operations/RealEstateEval.Operations.Application/Services/OperationsTaskCommands.cs:414`](../../backend/contexts/operations/RealEstateEval.Operations.Application/Services/OperationsTaskCommands.cs#L414)
- **Problem:** Invoices, reports, the licence gate and T-numbers use UTC dates and years.
- **Impact:** Documents issued between 00:00 and 03:00 Riyadh are dated the day before, permanently for frozen copies. The expiry gate lags, and New Year tasks take the old year.
- **Fix:** Use one Riyadh-date helper everywhere.

#### A-104

**🟡 MEDIUM — The TQ report number is not an annual sequence**

- **Where:** [`backend/contexts/valuation/RealEstateEval.Valuation.Domain/ValuationReportSections.cs:157`](../../backend/contexts/valuation/RealEstateEval.Valuation.Domain/ValuationReportSections.cs#L157)
- **Problem:** The ordinal is the global VR id (starting at 445, never reset), and the year comes from UTC.
- **Impact:** The first report of the year is not 00001, and the numbers grow across years.
- **Fix:** Allocate a yearly TQ number through ReferenceSequenceAllocator and store it.

#### A-105

**🟡 MEDIUM — CS and LT documents get a new number on every print**

- **Where:** [`apps/mfe-case-study/src/lib/app-data/operations-task-display.ts:337`](../../apps/mfe-case-study/src/lib/app-data/operations-task-display.ts#L337), [`backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Persistence/NumberedDocumentService.cs:33`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Persistence/NumberedDocumentService.cs#L33)
- **Problem:** Allocation always inserts a new ledger row, and the number lives only in session state.
- **Impact:** The same report or letter carries different numbers on different copies.
- **Fix:** Make allocation idempotent for each document.

#### A-106

**🟡 MEDIUM — Commas and Arabic digits are misparsed in numeric inputs**

- **Where:** `comparable-entry.ts:326`, [`apps/mfe-valuation/src/views/AddComparableForm.tsx:339`](../../apps/mfe-valuation/src/views/AddComparableForm.tsx#L339), [`apps/shell/src/app/login/login-ui.tsx:20`](../../apps/shell/src/app/login/login-ui.tsx#L20), [`apps/mfe-evaluator/src/components/evaluator/valuation-work/lib/bank-ranking.ts:58`](../../apps/mfe-evaluator/src/components/evaluator/valuation-work/lib/bank-ranking.ts#L58)
- **Problem:** A thousands comma is read as a decimal point (850,000 becomes 850). \D strips Arabic-Indic digits, and NaN becomes 0. ٫ is dropped. Coordinates are geocoded on every keystroke.
- **Impact:** Comparables are saved to the shared bank 1000× too small or at 0. Users with Arabic numerals cannot type a login mobile or OTP. Area overrides are saved 100× too large.
- **Fix:** Use one shared numeric normalizer, reject price ≤ 0 on the server, and geocode on blur.

#### A-161

**⚪ LOW — Client-side rounding and tolerances differ from the server**

- **Where:** [`apps/mfe-evaluator/src/components/evaluator/valuation-work/lib/final-opinion-state.ts:71`](../../apps/mfe-evaluator/src/components/evaluator/valuation-work/lib/final-opinion-state.ts#L71), [`apps/mfe-evaluator/src/components/evaluator/valuation-work/lib/adjustments-matrix-state.ts:142`](../../apps/mfe-evaluator/src/components/evaluator/valuation-work/lib/adjustments-matrix-state.ts#L142), [`apps/mfe-financial/src/lib/finance-enfaz-po-billing-state.ts:131`](../../apps/mfe-financial/src/lib/finance-enfaz-po-billing-state.ts#L131)
- **Problem:** The client uses floats and Math.round where the server uses decimal away-from-zero and a 0.05 weight tolerance.
- **Impact:** On-screen final value, weight checks and VAT differ from the saved or issued figures.
- **Fix:** Compute in integer halalas with the server's rounding, and show server values after save.

#### A-162

**⚪ LOW — Report-number fallback uses an in-memory counter that is then saved**

- **Where:** [`apps/mfe-evaluator/src/lib/evaluator/finalize-appraiser-submission.ts:50`](../../apps/mfe-evaluator/src/lib/evaluator/finalize-appraiser-submission.ts#L50)
- **Problem:** On a 5xx, the report gets TQ-YYYY-00001, and that number is persisted.
- **Impact:** Official report numbers are duplicated.
- **Fix:** Fail the submit instead of inventing a number.

#### A-163

**⚪ LOW — PO due date is parsed as UTC midnight**

- **Where:** [`apps/mfe-case-study/src/views/po-list-view-state.ts:52`](../../apps/mfe-case-study/src/views/po-list-view-state.ts#L52)
- **Problem:** The urgency flag turns off at 03:00 Riyadh on the due date itself.
- **Impact:** Due POs are not highlighted on their due day.
- **Fix:** Parse as a local date and treat today as urgent.

### Settings and admin

Settings saves write defaults or stale sections over real data. Changing the certified valuer corrupts the roster. Signature uploads are unvalidated.

#### A-035

**🟠 HIGH — Changing the certified valuer outside the roster corrupts the roster**

- **Where:** [`apps/mfe-settings/src/views/OrganizationDataView.tsx:360`](../../apps/mfe-settings/src/views/OrganizationDataView.tsx#L360), [`apps/mfe-settings/src/views/valuers-roster-state.ts:104`](../../apps/mfe-settings/src/views/valuers-roster-state.ts#L104), [`apps/mfe-settings/src/views/ValuationListsPanels.tsx:309`](../../apps/mfe-settings/src/views/ValuationListsPanels.tsx#L309)
- **Problem:** بيانات المنشأة changes certifiedValuerId without moving the role, and the roster then saves the new identity onto the old row. The participants panel allows two certified valuers, or none.
- **Impact:** The old valuer's data is lost, duplicates appear, and reports print the wrong signature or cannot be issued.
- **Fix:** Move the certified role only in the roster, as one atomic change. Validate on the server that exactly one active row is certified.

#### A-107

**🟡 MEDIUM — Settings screens that fail to load can still save defaults over real data**

- **Where:** [`apps/mfe-settings/src/views/ProfessionalValuationReportView.tsx:116`](../../apps/mfe-settings/src/views/ProfessionalValuationReportView.tsx#L116), [`apps/mfe-settings/src/views/useBrandIdentityWorkflow.ts:64`](../../apps/mfe-settings/src/views/useBrandIdentityWorkflow.ts#L64)
- **Problem:** The draft starts from built-in defaults, and save stays enabled after a failed load.
- **Impact:** Report texts, brand assets or evaluator data are replaced, and a new text-package version is created.
- **Fix:** Block all saves until the server data has loaded, and offer a retry.

#### A-108

**🟡 MEDIUM — SLA/communications save sends stale copies of every settings section**

- **Where:** [`apps/mfe-settings/src/views/organization-settings-state.ts:130`](../../apps/mfe-settings/src/views/organization-settings-state.ts#L130)
- **Problem:** The save sends the whole load-time settings object with no version.
- **Impact:** Other admins' changes are undone, and a text version is minted with the old texts.
- **Fix:** Send only the sections that were edited, and add a version check.

#### A-109

**🟡 MEDIUM — Valuer signature uploads are not validated**

- **Where:** [`apps/mfe-settings/src/lib/org-settings-ui.ts:3`](../../apps/mfe-settings/src/lib/org-settings-ui.ts#L3), [`backend/contexts/platform/RealEstateEval.Platform.Application/Services/OrganizationSettingsService.cs:355`](../../backend/contexts/platform/RealEstateEval.Platform.Application/Services/OrganizationSettingsService.cs#L355)
- **Problem:** Any file of any size is stored inline in the settings JSON.
- **Impact:** Every user downloads a multi-MB payload at sign-in.
- **Fix:** Apply the brand-image checks on both client and server.

#### A-164

**⚪ LOW — Legacy PUT /api/courts rebuilds the whole catalog**

- **Where:** [`backend/contexts/platform/RealEstateEval.Platform.Infrastructure/Services/CourtsCatalogService.cs:110`](../../backend/contexts/platform/RealEstateEval.Platform.Infrastructure/Services/CourtsCatalogService.cs#L110)
- **Problem:** It rewrites Region and regenerates circuit ids.
- **Impact:** Region filters break, and every property's CircuitId dangles.
- **Fix:** Remove the endpoint.

#### A-165

**⚪ LOW — Court admin validators allow values longer than the database columns**

- **Where:** [`backend/contexts/platform/RealEstateEval.Platform.Application/Validation/PlatformRequestValidators.cs:46`](../../backend/contexts/platform/RealEstateEval.Platform.Application/Validation/PlatformRequestValidators.cs#L46)
- **Problem:** Validator limits are 256/128 while the columns are 150/80.
- **Impact:** The admin gets a 500 instead of a field error.
- **Fix:** Align the limits with the columns.

#### A-166

**⚪ LOW — 'Test communication' reports SMS and email as sent**

- **Where:** [`backend/contexts/platform/RealEstateEval.Platform.Infrastructure/Services/OtpDeliveryService.cs:81`](../../backend/contexts/platform/RealEstateEval.Platform.Infrastructure/Services/OtpDeliveryService.cs#L81)
- **Problem:** The method only logs and returns Ok.
- **Impact:** Admins wrongly believe OTP delivery works.
- **Fix:** Return Ok=false with «مزوّد SMS غير مُفعَّل بعد».

#### A-167

**⚪ LOW — Settings autosave races lose edits (info-roles matrix, valuation lists)**

- **Where:** [`apps/mfe-settings/src/views/CaseStudyInfoRolesView.tsx:149`](../../apps/mfe-settings/src/views/CaseStudyInfoRolesView.tsx#L149), [`apps/mfe-settings/src/views/useValuationListsWorkflow.ts:53`](../../apps/mfe-settings/src/views/useValuationListsWorkflow.ts#L53)
- **Problem:** Save responses overwrite newer edits, and pending timers are dropped or later restore deleted rows.
- **Impact:** Notes and renames are lost, and deleted rows come back.
- **Fix:** Track revisions, flush on unmount, and clear timers before an immediate save.

#### A-168

**⚪ LOW — An admin can remove their own admin role**

- **Where:** [`apps/mfe-settings/src/components/EditStaffUserModal.tsx:248`](../../apps/mfe-settings/src/components/EditStaffUserModal.tsx#L248)
- **Problem:** Role change is allowed on your own row, with no last-admin guard.
- **Impact:** Instant lock-out, possibly with no remaining admin.
- **Fix:** Block role changes for yourself and for the last CDO or Admin.

### Performance and scale

Full-table sweeps and loads that grow with history, and slow Hijri date conversion on phones.

#### A-110

**🟡 MEDIUM — Workflow slot sync loads every work order, property and task on each call**

- **Where:** [`backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Persistence/WorkflowTaskSlotRepository.cs:10`](../../backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Persistence/WorkflowTaskSlotRepository.cs#L10)
- **Problem:** It does an unfiltered, tracked load, triggered on navigation and on every per-PO sync.
- **Impact:** Requests take seconds, the connection pool fills and xmin retries pile up as history grows.
- **Fix:** Add a PO-scoped sync, filter to POs whose slots don't match, and project only the needed columns.

#### A-111

**🟡 MEDIUM — Property-keys projection sweeps every table each minute and reverts manual edits**

- **Where:** [`backend/contexts/operations/RealEstateEval.Operations.Infrastructure/Services/PropertyKeysService.cs:132`](../../backend/contexts/operations/RealEstateEval.Operations.Infrastructure/Services/PropertyKeysService.cs#L132), [`backend/shared/RealEstateEval.Shared.RemoteClients/HttpCaseStudyLookup.cs:119`](../../backend/shared/RealEstateEval.Shared.RemoteClients/HttpCaseStudyLookup.cs#L119)
- **Problem:** Every 60 s it loads every envelope and gov-review submission and sends all request numbers in one GET. It also overwrites PATCH edits.
- **Impact:** Constant full scans, 414 errors after about 600 requests, and manual key edits silently revert.
- **Fix:** Make the sweep incremental with POST lookups, and either respect manual overrides or retire PATCH.

#### A-112

**🟡 MEDIUM — Ledger maintenance sweep reprocesses all history every 2 minutes**

- **Where:** [`backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Services/InspectorFeeLedgerWriter.cs:226`](../../backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Services/InspectorFeeLedgerWriter.cs#L226)
- **Problem:** It checks whether a ledger exists only after making per-task HTTP calls.
- **Impact:** About 6,000 HTTP calls per sweep at 3,000 inspections, growing forever.
- **Fix:** Skip tasks that already have ledgers first, use a watermark, and cache and batch the lookups.

#### A-113

**🟡 MEDIUM — Hijri↔Gregorian conversion is slow on phones**

- **Where:** [`apps/mfe-case-study/src/lib/app-data/dual-calendar-date.ts:65`](../../apps/mfe-case-study/src/lib/app-data/dual-calendar-date.ts#L65)
- **Problem:** Each conversion scans up to 1,095 days and creates a new Intl formatter per day, several times per tap.
- **Impact:** The date picker visibly lags on field phones.
- **Fix:** Use a module-level formatter and an arithmetic estimate, and memoize the grid.

#### A-114

**🟡 MEDIUM — Prefetched documents are re-downloaded on every run and never pruned**

- **Where:** [`apps/shell/src/components/FieldOfflinePrefetch.tsx:58`](../../apps/shell/src/components/FieldOfflinePrefetch.tsx#L58)
- **Problem:** There is no already-cached check and no pruning, and runs overlap.
- **Impact:** Wasted cellular data and deeds from old tasks stay on the device.
- **Fix:** Skip attachment ids already cached, prune rows for inactive tasks, and guard against overlapping runs.

#### A-169

**⚪ LOW — Client screens download the whole workflow-task table**

- **Where:** [`apps/mfe-case-study/src/lib/app-data/po-intake-commands.ts:260`](../../apps/mfe-case-study/src/lib/app-data/po-intake-commands.ts#L260), [`apps/mfe-survey/src/lib/survey-request-stats.ts:51`](../../apps/mfe-survey/src/lib/survey-request-stats.ts#L51)
- **Problem:** The screens fetch every page in parallel with no poNumber or kind filter, and failures show zeros.
- **Impact:** Saves and the survey page slow down as data grows.
- **Fix:** Pass poNumber or kind filters, and use count endpoints.

## Coverage notes

What each auditor read, and what it did not get to, as reported by the auditors themselves.

<details><summary>case-study-core</summary>

Files read in full, all under backend/contexts/case-study:
- Domain: WorkflowTask.cs, PartyTaskSubmission.cs.
- Application/Services: PartyTaskSubmissionService.cs and its Authorization, Accept, OfflineSync, Validation, Siblings, Mapping and Notifications partials; WorkflowTaskLifecycleCommands.cs and its Deletion and Revert partials; WorkflowTaskDistributionCommands.cs; WorkflowTaskSlotSynchronizer.cs; CaseStudyFormService.cs; CaseStudyFormBatchReadService.cs; WorkOrderService.cs and WorkOrderService.Notifications.cs; WorkOrderPropertyCommands.cs; TransactionStateService.cs; CaseStudyValuationDispatchService.cs; BuildingInventoryService.cs; InspectionLimitsService.cs; PropertyGroupService.cs; ClientService.cs; PoIntakeDraftService.cs; FieldGapNotificationService.cs.
- Application/Rules: PartyTaskSubmissionRules, WorkflowTaskLifecycleRules, WorkflowTaskDistributionRules, WorkflowTaskPhaseRules, InspectedPropertyTypeRules, InspectionSourceDataRules, CaseStudyFormReadRules.
- Abstractions: IWorkflowTaskService, IWorkflowTaskSlotRepository.

Files read in part:
- WorkOrderValidator (header section only), WorkOrderPropertyWriteRules (FindEditableProperty and delete/URL helpers), TransactionStateRules.AllowsEnfazHandover.

Read to confirm behaviour, outside the audit area:
- Shared rules: backend/RealEstateEval.Application/Rules/PoRoleMatrixRules.cs, PartyTaskSubmissionPayloadRules.cs, DocumentaryWorkflowRules.cs; JsonDefaults.cs; WorkflowTaskEnums.cs.
- API controllers: PartyTaskSubmissions, WorkflowTasks, CaseStudyForms, WorkOrders, BuildingInventory, InspectionLimits.
- Infrastructure: WorkflowTaskCascadeCleanup, PartyTaskSubmissionRepository (SetInspectedPropertyType), CaseStudyCommands (failure block/resolve), WorkOrderRepository.DeleteWorkOrderCascadeAsync, PropertyGroupRepository and model index, ValuationReportWorkflowHandler.
- Financial: InspectorFeeLedgerStore.DeleteForWorkflowTasksAsync, InspectorFeeService (Accrue, EnsureLedgers), InspectorFeeLedger.
- Identity: PlatformPermissionCatalog role→capability map.
- Platform: NotificationService dedupe.
- Frontend call sites: tasks-commands.ts, BuildingInventorySection.tsx, InspectorBuildingAreasCard.tsx, useCaseStudyFormCommands.ts, RedistributePartiesModal.tsx.
- Specs: decisions log §ق-5/ق-7/ق-9/ق-10/11أ0; security_offline_spec §4.

Not read or only skimmed:
- CaseStudyFormService.Notifications.cs; WorkflowTaskDistributionCommands.Notifications.cs; WorkOrderMapper.cs; CaseStudyFormMapping.cs.
- SpecialistReportExtrasRules; PartyFieldProvenance; CaseStudyAnswerProvenance; FieldInspectionWorkspaceProjector; InspectorBoundarySyncRules; DeedNumberRules; SurveyRequirementRules; BusinessDueDateCalculator; WorkOrderListQueryRules; WorkflowTaskListQueryRules; WorkflowTaskVisibilityRules; the rest of WorkOrderValidator and WorkOrderPropertyWriteRules.
- Domain rule files: DashboardOpsMetricsRules, PropertyOwnershipRules, PropertySeedFieldRules, InspectionLimits.cs, PropertyGroup.cs; most of TransactionStateRules.
- Contracts/Validation DTOs; NumberedDocument service.

Considered and deliberately not reported:
- The generic PATCH parses unknown status/phase leniently (unknown → Open/Enfath) despite a comment saying they are dropped (low; clients send valid values).
- Misleading indentation in AcceptAsync lines 111-114, which re-sends sibling notifications on a repeat accept.
- The survey fee HTTP accrual running inside a local transaction; the accrual is idempotent, so no harm found.
- The case-study form submit not waiting for party completion: the code treats the form as the step that sends work to the appraiser, which conflicts with ق-9's wording but is intentional, so it is ambiguous.

</details>

<details><summary>case-study-infra</summary>

I read these files in full: every controller under backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers (WorkOrders, WorkflowTasks, PartyTaskSubmissions, FieldInspectionWorkspaces, CaseStudyForms, CaseStudyDispatch, Clients, NumberedDocuments, PropertyGroups, SuspendedTransactions, System, TransactionState, InspectionLimits, BuildingInventory, PoIntakeDraft, WorkflowAssignees, and InspectorFees in full). I read ServiceModule.cs, the csproj, appsettings.json and Integration/ValuationIntegrationEventConsumer.cs.

In backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure I read: Data/CaseStudyDbContext.cs and CaseStudyModel.cs; CaseStudyDependencyInjection.cs; and every file in Persistence except the tail of PropertyTimelineService.cs (lines 330-518, the bootstrap helpers). That covers WorkOrderVisibilityFilter, WorkOrderLoader, WorkOrderRepository, WorkOrderPropertyRepository, WorkOrderQueryService, WorkflowTaskQueryService, CaseStudyLookup, CaseStudyCommands and CaseStudyFailureCommands, PartyTaskSubmissionRepository, WorkflowTaskLifecycleRepository, WorkflowTaskCascadeCleanup, WorkflowTaskSlot and Distribution repositories, WorkflowTaskShellPatcher, WorkflowAssigneeLookup, CaseStudyForm and Batch repositories, PoIntakeDraft, Client, PropertyGroup, NumberedDocumentService, FieldInspectionWorkspaceService, DashboardOpsMetrics, CaseStudyValuationDispatchRepository, CaseStudyPropertyPoNumberLookup, EfConcurrency, InspectionLimits, BuildingInventory, TransactionState and ValuationReportWorkflowTaskLookup. I also read Services/* except PropertyListRowBuilder.cs and IsoTimestamps.cs, and Integration/ValuationReportWorkflowHandler.cs.

To confirm findings I followed calls into Application services: TransactionStateService, InspectionLimitsService, BuildingInventoryService, WorkOrderPropertyCommands (update, location and bourse), WorkflowTaskLifecycleCommands.Deletion, WorkflowTaskSlotSynchronizer, PartyTaskSubmissionService.Accept, and WorkflowTaskVisibilityRules. I also checked the shared pieces those depend on (ActorClaims/ActorIdentity, the JWT issuance and StaffRoleDefaults, PlatformPermissionCatalog, the capability policies, DbContextTransaction, ReferenceSequenceAllocator, RequireUpstreamDispatch, gateway routes, prod compose port exposure) and the frontend callers of the delete, sync and contact paths.

Not covered: PartyBillingStatementsController and EnfazBillingController only had their routes, authorization and read paths checked, not their write bodies. I did not open PropertyListRowBuilder.cs, the end of PropertyTimelineService.cs, or Migrations (excluded by the rules; the model snapshot was used only to confirm the Phone column width). Most Application-layer services (PartyTaskSubmissionService save/submit/reopen, CaseStudyFormService, WorkflowTaskDistributionCommands, WorkOrderService.Create) were not reviewed beyond the call sites above.

Things I checked that are fine: the dispatch controller is reachable only on the internal network, because nginx and the gateway strip X-REE-Upstream and only nginx publishes ports. Case-study publishes no outbox events; the valuation consumer uses inbox dedupe plus one requeue.

</details>

<details><summary>financial</summary>

Static read only. Nothing was built, run or changed.

**Read in full:**
- Controllers in backend/services/financial: FinancialController, InspectorFeeDispatchController, FinancialChargesDispatchController, PartyBillingDispatchController, PoEnfazDispatchController, plus ServiceModule.
- Domain: InspectorFeeLedger, InspectorFeeBillingStatus, PartyBillingStatement, PoEnfazInvoice, PoEnfazRevenueLine.
- Services and rules: InspectorFeeService, InspectorFeeAccrualRules, InspectorFeeBillingRules, InspectorFeeTransitionAuthorization, InspectorFeeRules, InspectorFeeTransitionApplier, InspectorFeeLedgerWriter, InspectorFeeLedgerResolver, InspectorFeeLedgerStore, InspectorFeeSummaryQuery, InspectorFeeRowMapper, InspectorFeeLedgerMaintenanceHostedService, BillingNegotiationDeadlineHostedService, PartyBillingMonthVendorHostedService.
- Party billing: PartyBillingStatementService (main file, plus the Create and VendorInvoice parts), PartyBillingStatementRules, PartyBillingDraftRules, PartyBillingRowMapper, PartyBillingStatementRepository.
- Enfaz: PoEnfazBillingService (main file), PoEnfazInvoiceRules, PoEnfazBillingDtoBuilder, PoEnfazRevenueRules.
- Charges: CourtVisitFeeChargeService, KeyReceiptFeeChargeService, RemoteCourtVisitFeeBackfill.
- Pricing: PartyFeePricingService (main file, plus the Resolution and Assignments parts), PartyFeePricingRepository, EngineeringSurveyFeeRules, CourtVisitFeeRules, the first 120 lines of PartyFeePricingRules.
- Also: DiscountFlagService, IncentiveSuspensionService (create/lift), FinancialReportService, FinancialReportRepository, FinancialDbContext, FinancialModel, FinancialDependencyInjection, FinancialRequestValidators.

**Cross-checked outside the context:**
- Shared client and auth: HttpCaseStudyLookup, UpstreamJson (in UpstreamServicesOptions.cs), RequireUpstreamDispatchAttribute, the gateway routes and Kestrel config, the financial service in docker-compose.prod.yml.
- Case Study host: InspectorFeesController ActorContext, the PartyBillingStatementsController and EnfazBillingController authz, WorkflowTaskDistributionCommands.RedistributePartiesAsync.
- Other: PlatformPermissionCatalog role capabilities, ReferenceSequenceAllocator, FinanceEnfazBillingActions.tsx (to check the UI gating of re-issue), and the gap-analysis ج٢/ج٤ spec lines.

**Not read, or only skimmed:**
- Pricing internals: PartyFeePricingService.Seeding, PartyFeePricingLifecycleRules, the remainder of PartyFeePricingRules (table shape/revision builders).
- Enfaz internals: PoEnfazBillingService Tracking/Followups/Lists, PoEnfazFinanceFlagRules, PoEnfazFollowupRules, PoEnfazWorkStatusRules, PoEnfazBillingRepository, EnfazInvoicePdfGenerator/Renderer, OfficialLetterAssets.
- Other rules and services: InspectorFeeWorkStatusRules, all the *ListQueryRules and MaterialisedListPage, PartyBillingStatementService Lists/Notifications (skimmed), BillingNegotiationDeadlines domain, the Contracts/DTO files, the migrations.

**Caveats:**
- The 414 finding uses Kestrel's default 8,192-byte MaxRequestLineSize and 39 bytes per escaped GUID. I did not reproduce it.
- I could not check how many ledgers production currently holds, so I don't know how close it is to the roughly 208-id threshold.

</details>

<details><summary>valuation</summary>

What I read in full:
- **Valuation API controllers:** all of backend/services/valuation controllers (endpoint and policy map); ValuationReportPdfController and ValuationRequestsController line by line.
- **PDF links and rendering:** ValuationReportPdfService, ReportLinkSigner, ReportLinkToken, ValuationReportPdf domain and rules, GotenbergHtmlPdfRenderer, ValuationReportPdfGenerator (QuestPDF).
- **Issuance:** ValuationReportIssuanceService, ValuationReportIssuance domain, the freeze gate, ValuationIssuanceGateService, ValuationIssuanceGateRules.
- **Report building:** ValuationReportDocumentService, ValuationReportFieldInjectionService, ValuationReconciliationService with ReconciliationRules, ValuationRequestService, ValuationRequest domain.
- **Comparables and cost:** ValuationComparableListBuilder, ValuationComparableSelectionService (ListAsync and the market-approach partial), the first ~200 lines of ValuationCostApproachService, ComparablePropertyService (update/deactivate/map), parts of ComparablePropertyRepository, PriorValuationBankFeeder.
- **Settings and model:** the ValuationApproachSettingsService get/save head, the ValuationModel mappings for issuances and PDFs, a skim of EvaluatorRecallsService.
- **Reporting service:** the controller, upstream client, ServiceModule and resilience options.

What I cross-checked outside the audit area to confirm impact:
- infra/docker-compose.prod.yml (Gotenberg deny-list, reporting and Redis env).
- The valuation Dockerfile and the QuestPDF package contents and XML docs.
- ApiResponseCache, the capability policies in ServiceCollectionExtensions, InspectorFeesController and WorkflowTasksController scoping, AttachmentLookup and HttpAttachmentLookup.
- The Case Study ValuationReportWorkflowHandler.
- Frontend callers: api-client, EvaluatorWindow, finalize-appraiser-submission, issue-valuation-report, useReportIssuanceWorkflow (confirmed unreferenced), mfe-valuation submit.
- The decisions-log lines for ق-6 (248) and 11ل.

Not covered or only skimmed:
- MarketApproachRules and ValuationMethodologyAlertRules formulas beyond the weighted-rate and alert-16 paths.
- ValuationMarketAndCostApproach depreciation and indirect-cost math, and the rest of ValuationCostApproachService (ToDto, lines 200-474).
- ValuationReportFieldBuilder beyond grep hits, ValuationReportNarrativeRules, ArabicAmountWords, ComparableBankSeed.
- PropertyComparableLinkService, the ComparablePropertyRepository filters, the ValuationComparableSelectionService ReplaceAsync/adopt paths and ValuationComparableSelectionRequestRules.
- The EF migrations and the gateway YARP auth config for the anonymous /api/valuation-reports route.

Verification limits and assumptions:
- Nothing was executed.
- The Arabic-font finding follows from the image contents (no fonts installed, only Lato bundled) and QuestPDF's documented placeholder behaviour. Confirm it by generating /report-document/pdf against the production container.
- Gotenberg SSRF residue (ws:// and wss:// are not in the deny list; file:///tmp is allowed) was judged low and not reported.

</details>

<details><summary>platform</summary>

What I read in full:
- Gateway: backend/gateway (Program.cs, GatewayClientAddressForwarding.cs, GatewayReadiness.cs, appsettings*.json, Dockerfile).
- Gateway pipeline in backend/shared/RealEstateEval.Shared.Web: ObservabilityExtensions (the gateway and service pipelines), ClientAddressResolver, RateLimitingExtensions, SecurityHeadersMiddleware, CORS options and registration, policy registration in ServiceCollectionExtensions, ActorClaims, RequireUpstreamDispatchAttribute.
- Platform service: every controller in backend/services/platform (Notifications, PushSubscriptions, FieldSyncStatus, AuditLog, AuditLogAppend, OrganizationSettings, Courts/AdminCourts, Regions, CaseStudyInfoRoles, FieldDictionary, DifferenceFactorCatalog, AttachmentPrintDictionary, ValuationLists), all three RabbitMQ consumers, ServiceModule, appsettings, Dockerfile.
- Platform context: NotificationService, NotificationRealtimeHub, NotificationRealtimePushHandler, NotificationIntegrationEventHandler, WebPushDeliveryHandler, WebPushOptions, PushSubscriptionService, FieldSyncStatusService, AuditLogQueryService, PlatformAuditLogAppend, OrganizationSettingsService, OrganizationSettingsGapService, OtpDeliveryService, CourtsCatalogService, CaseStudyInfoRolesConfigService, FieldDictionaryService, DifferenceFactorCatalogService, part of AttachmentPrintDictionaryService, RegionsService.Review, the merge rules in LocationCatalogRules, CourtCatalogRules, PlatformRequestValidators, PlatformModel, PlatformDbContext, PlatformDependencyInjection.

Shared plumbing I read to confirm findings: IntegrationEventInbox, RabbitMqTopology, RabbitMqMessagePublisher, MessagingRetentionHostedService, the UserNotification/PushSubscription mappings in MessagingModel, UpstreamServiceBearer, UpstreamJson auth forwarding, HttpAuditLogAppend, HttpWorkflowAssigneeLookup, NotificationRecipientResolver.

Deployment config: infra/nginx.conf and the committed infra/docker-compose.prod.yml.

Frontend callers, to confirm impact: packages/api-client notifications/auth/courts/field-sync-status, ServerNotificationBridge, how sw.js routes /api requests, useOfflineSyncCoordinator.

What I did not get to, or only skimmed:
- CourtsService and RegionsService main files beyond the create/update/selectable paths.
- LocationCatalogRepository, CourtsRepository, OrganizationBrandingRules, StaffValuerRosterSyncRules, OrganizationSettingsService.StaffValuer, ValuationListsSeed, LocationCatalogSeedSource.
- Platform EF migrations (deliberately ignored).
- CorrelationId and command-idempotency middleware.
- The outbox dispatcher internals beyond the publish call.

Checks I dismissed:
- X-Real-IP spoofing: nginx always overwrites it and the gateway is not published.
- X-REE-Upstream forgery: stripped by both nginx and YARP.
- Double SSE publish (in-process plus Rabbit fan-out): the client dedupes by id.
- The dev VAPID key in appsettings.Development.json: loaded only in Development.

Nothing was built, run or modified.

</details>

<details><summary>identity</summary>

What I read in full:
- **Identity context and service:** backend/services/identity (AuthController, UsersController, PermissionsController, IdentityLookupController, DistributionAssigneesController, ServiceModule, appsettings) and backend/contexts/identity (AuthSessionService, JwtTokenService, LoginUserResolver, PermissionService, PlatformPermissionCatalog, PrototypeRoleResolver, IdentityDirectory, UserLabelLookup, StaffIdentityStore, StaffRegistrationRepository, RegistrationMapper, IdentityDbContext, IdentityModel, RefreshToken, IdentityDependencyInjection, UserRegistrationService with its Lifecycle and Queries parts, StaffUserRules, StaffProfileRules, StaffRoleDefaults, StaffRoleCatalog, IdentityRequestValidators, AuthDtos).
- **Shared plumbing:** ServiceCollectionExtensions (JWT validation, key rotation, capability policies), RateLimitingExtensions, ClientAddressResolver, RealEstateEvalApiHostExtensions, HttpAuditLogAppend, DbContextTransaction, NpgsqlConfiguration and DatabaseOptions.
- **Gateway and deploy:** gateway Program, appsettings and GatewayClientAddressForwarding; infra/docker-compose.prod.yml and nginx.conf; the migrate and seed step of deploy.yml; DbMigrate Program seeding.
- **Seeder:** the DataSeeder user-seeding parts (EnsureHrStaffAsync, EnsureLegacyAdminAsync, EnsureSeedPasswordAsync).
- **Spec:** security_offline_spec.md in full. The decisions log has no auth or OTP entries.
- **Tests:** IdentityApiDevGateTests; parts of AuthSessionServiceTests and StaffUserUpdateTests.
- **Frontend, for corroboration only:** the shell login page (OTP step), packages/api-client auth.ts and users.ts, and the storage part of auth-client session.ts.

Checked and found no issue:
- JWT validation: issuer, audience, lifetime and signing key are validated; the production key has a 64-character minimum and a placeholder check; previous-key rotation is wired.
- Refresh tokens: only hashes are stored; the family expiry is absolute.
- Disabled accounts: the refresh returns the account-disabled wipe code, and disable revokes tokens.
- Authorization: only CDO/Admin hold manage-users, so there is no role escalation path for non-admins.
- No [Authorize(Roles=...)] reliance anywhere, and no MapIdentityApi or cookie endpoints.
- Rate-limit client key: nginx sets X-Real-IP and the gateway overwrites it downstream.
- /api/identity/* lookups are not routed by the gateway, so they are internal only.

Deliberately not reported:
- The 15-minute access-token window after a disable (by design).
- The 500-row unpaginated user-list cap (a low risk).
- Dead activation and ResetPassword code.

Not covered:
- The offline PWA client token lease and 3-hour lock logic (apps/shell sw.js, packages/offline-client).
- The shell middleware ree-auth cookie gate.
- The other services' use of capability claims.
- Identity migrations beyond their names.
- The full DataSeeder, beyond its user and role seeding.

No builds or tests were run, as instructed.

</details>

<details><summary>ops-failures-attachments</summary>

What I read in full:
- backend/services/attachments: the controller, ServiceModule, appsettings and Dockerfile.
- backend/contexts/attachments: AttachmentService (+DocumentTypes), AttachmentLookup, AttachmentUploadRules, FileSignatureInspector, PropertyDocumentUploadRules, PhotoLocationRules, DTOs, validators, LocalFileBlobStorage, BlobStorageOptions, AttachmentsModel and DI.
- backend/services/operations: KeyEnvelopesController, KeyEnvelopeDispatchController, PropertyKeysController, OperationsTasksController and OperationsTaskDispatchController.
- backend/contexts/operations: every KeyEnvelopesService partial (main, Handoffs, CourtAccess, Fees, LinkedProperties), KeyEnvelope and OperationsTask domain, KeyEnvelope lifecycle/registration rules, OperationsTaskCommands (+Comments, +Reminders), OperationsTaskLifecycleRules, CommandRules, CourtVisitRules, ListQueryRules, ReminderCalculator, OperationsTaskService, OperationsTaskQueryService, OperationsTaskVisitFeeHelper, both repositories, PropertyKeyGateResolver, KeyEnvelopeEntitlementLookup, PropertyKeysService, both hosted services, KeyEnvelopePeopleResolver (first half) and OperationsModel.
- backend/services/failures: FailuresController and FailureDispatchController.
- backend/contexts/failures: FailureService (+Holds, +Notifications), FailureRules, FailureRecordRules, PropertyFailure, PropertyFailureStatus, FailureRepository, FailureLookup and the DTOs.

Supporting code I read to confirm impact:
- AttachmentAccessRules and its tests, PlatformPermissionCatalog, PermissionService, ClaimsPermissionService, the JwtTokenService/AuthSessionService capability claims, and the policy definitions in ServiceCollectionExtensions.
- RequireUpstreamDispatch, plus the header stripping in the gateway and nginx (which is correct).
- The case-study CaseStudyCommands obstruction and hold handlers, CaseStudyLookup, HttpCaseStudyLookup, KeyReceiptFeeChargeService and PropertyAccessHoldService.
- Frontend call sites: inspector-photo-upload.ts, jeddah-default-coords, the engineering-office failure raise, and the offline write interceptor and sync for key envelopes.
- The spec sections security_offline_spec §5 and §6.

Not covered:
- In the audit area: SurveyOfficesService, OperationsTaskNotifier (482 lines, notification fan-out), OperationsTaskSerialization, KeyEnvelopeMapper, the operations and failures request validators, FailureTypesCatalogService, FailureListQueryRules, AttachmentPrintRules, AttachmentMetaMapper, and the migrations.
- Shared middleware outside my area, beyond a glance. For example, CommandIdempotencyMiddleware caches by actor+path+key but does not serialize concurrent in-flight duplicates; that is worth a look by whoever owns backend/shared.

Lower-priority issues I saw but did not report:
- PATCH with a CourtVisitResult and no status can overwrite the result on a completed or cancelled court-visit task: OperationsTaskCommands.cs:262-269, and OperationsTask.RecordCourtVisitResult has no terminal guard.
- The name-only fallback in PatchAsync lets a non-manager whose display name equals AssigneeName act as the assignee: OperationsTaskCommands.cs:166-172.
- AttachmentService.DeleteAsync removes the blob before SaveChanges, so a DB failure leaves a row whose file is gone.
- ListForPropertyAsync's ScopeKey prefix match cannot use the (Scope, ScopeKey) index and loads all matching rows before its Take(200).
- PropertyKeysService.PatchAsync status 'done' silently confirms a pending handoff as 'compat-patch' with no timeline entry.

Nothing was modified; I ran only static reads and greps.

</details>

<details><summary>backend-shared</summary>

What I read in full: backend/shared/RealEstateEval.Shared.Web (CommandIdempotencyMiddleware, MemoryCommandIdempotencyStore, GlobalExceptionHandlerMiddleware, SecurityHeadersMiddleware, TransientConflict, ObservabilityExtensions/pipeline order, ServiceCollectionExtensions (JWT, CORS, capability policies), RealEstateEvalApiHostExtensions, ServiceProgram, RateLimitingExtensions, ClientAddressResolver, CorrelationIdDelegatingHandler, RequireUpstreamDispatchAttribute, ActorClaims, CapabilityAuthorizationHandler). backend/shared/RealEstateEval.Shared.RemoteClients (RemoteClientRegistration, UpstreamServiceBearer, UpstreamServicesOptions/UpstreamJson, HttpCaseStudyLookup, HttpIdentityDirectory, HttpAuditLogAppend, HttpAttachmentLookup, HttpValuationRequestService, part of HttpPoEnfazBillingService and HttpInspectorFeeService). backend/RealEstateEval.Infrastructure (DependencyInjection, Integration/* (outbox dispatcher, publisher, RabbitMQ publisher/topology/options, inbox, retention, EF idempotency store, PlatformNotificationRequestService), Data (DbContextTransaction, ChangeTrackerCheckpoint, MessagingDbContext, IOutboxContext, ReferenceSequenceAllocator, UpdatedAtStampingInterceptor, BoundedContextConnections, PostgresDatabaseProvisioner, NpgsqlConfiguration, DatabaseOptions), Caching/ApiResponseCache, Services (AuditLogWriter, ClaimsPermissionService, PropertyAccessHoldService), and the readiness parts of Web/ServiceHealthEndpoints). backend/tools/DbMigrate/Program.cs; tools/DevSeed (DataSeeder: seed entry, account and password enforcement, backfills, demo removal; DevSystemMaintenanceService). backend/scripts (delete-all-pos.sql, reseed tool). RealEstateEval.Application/Rules/AttachmentAccessRules.

Read to confirm context, outside my area: infra/docker-compose.prod.yml (migrate/identity/rabbitmq sections plus the uncommitted diff), infra/nginx.conf routing, the deploy.yml compose steps, the gateway header stripping, the identity AuthController, the case-study redistribution, patch and accept code, the financial InspectorFeeSummaryQuery and accrual, the reporting controller and upstream client, the platform notification consumer, ComparableBankSeed, and the offline-client and useIdempotentAction key handling.

Not covered or only skimmed: the other remote clients (HttpFailureService, HttpOperationsTaskService, HttpPartyBillingStatementService, HttpPartyFeePricingService, HttpCaseStudyCommands, charge services); RealEstateEval.Application Rules FieldInspectionSubmissionValidator, PartyTaskSubmissionPayloadRules, PoRoleMatrixRules, DocumentaryWorkflowRules; Shared.Contracts DTO/enum files; OutboxMetrics*; MessagingModel; CanonicalV1AliasConvention/ApiV1Alias/OpenApiExtensions; the rest of DataSeeder (prototype module data, HR/proc provider body details); dev-api/dev-infra/release-verify scripts. Nothing was built, run or modified; this is static reading only.

Notes: the first finding also involves the identity service config (EnableDevLogin), because the seeded accounts are only exploitable through it; other auditors may report the login side separately. Findings 7, 9 and 10 point at code in services/ or contexts/, but each comes from a shared-kernel mechanism (ApiResponseCache usage, inbox design, the transaction helper with remote clients).

</details>

<details><summary>mfe-case-study-components</summary>

What I read in full or in the relevant parts:
- **field-inspection:** useFieldInspectionWorkflow, field-inspection-work-state, inspector-wizard-state, FieldInspectionWorkBody, FieldInspectionMobileShell, InspectorWorkspaceWizard, InspectorObservationsSection, InspectorFieldObservationsCard, InspectorFeaturesSection, InspectorFeatureWizardFields (upload and setFeature), InspectorComponentsSection (upload part), InspectorDefinedPhotosSection, InspectorPropertyPhotosSection (upload/remove/tag), InspectorPhotoFilePicker, InspectorCaseStudyChips, InspectorBuildingAreasCard (tail), BuildingInventorySection, InspectionLimitsSection, FieldComparableCaptureSection (save/reload), InspectorFeesBillingTable (save/transition/batch), InspectorDescriptionDocsCards (tail).
- **po-intake:** PropertyDetailInspectionTab, property-detail-inspection-submit, PoPropertyEdit (including the uncommitted diff), usePoIntakeForm, usePoPropertyDetailTabsWorkflow, PoPropertyDetailTopbarActions (gating part), CopyFromPriorTransactionModal (search/copy), SpecialistValuationReportFinishingEditor.
- **case-study:** useCaseStudyFormData, useCaseStudyFormCommands, CaseStudyMatrixTable (note/answer cells), PartyCaseStudyFormTab, CaseStudyAppraisalPanel (inspection block), CaseStudyReportFrame.
- **fees:** useEngFeesWorkflow.
- **Supporting code I read to confirm behaviour:**
  - Frontend lib: inspector-workspace-commands/model/reads, property-field-autosave, po-intake-commands (updatePropertyInPo, copy), case-study-form-commands/reads.
  - Offline and service worker: offline-write (save fallback, working copy), install-offline-write-interceptor, prefetch-read, shell sw.js (API bypass), use-idempotent-action.
  - Backend: CaseStudyFormsController/Service (retry on xmin, party save authorisation), WorkOrdersController.UpdateProperty, WorkOrderPropertyCommands and WritePropertyRules (soft-draft path), PoRoleMatrixRules.CanWritePartyTask.
  - Specs: security_offline_spec §3–4 and decisions log #24.

What I did not get to or only skimmed:
- **Fees:** PartyFeesWorkspace, PartyFeeWorkflowTable (only grepped the role checks), PartyOfficeBillingStatementsPanel, EngOfficeFeesBillingTable, SupervisorEngSurveyFeeAcceptPanel, party-individual-fees-state/usePartyIndividualFeesWorkflow.
- **po-intake:** PoPropertyPartyDataCards, PoPropertySpecialistExtrasCard, PropertyDetailBasicTab/LinkedTab/GovernmentReviewsTab/PropertyKeys/CaseStudyReport/InspectionPhotos, the PropertyFileUploadField and PropertyDocumentUploadDialog upload paths, the RegionCitySelects and CourtCircuitSelects effects, PoHeaderEdit.
- **Other components:** distribution/*, comparables/ComparablePropertyEntryFields, property-map/*, CreateOperationsTaskModal and create-operations-task-state, active-transactions/*, InspectorKeyStatusTab, InspectorLocationCard, InspectorSiteLocationAckButton, SpecialistServiceProofPhotoFields.

Suspicions I did not report because I could not tie them to a line with enough certainty:
- inspector-workspace-reads `setCache(server copy)` on every change event while editing, plus the client-vs-server clock comparison for the local working copy. This could drop keystrokes typed during a refetch if the device clock is behind the server.
- The specialist mirroring effect auto-sets `specialistReviewApproved` for mirrored inspector answers. I did not check that against the decisions log.
- The PropertyDetailInspectionTab load effect keys on the `inspectionTask`/`property` object identity, so a record refetch would reload the form. I found no concrete trigger for this during editing.

</details>

<details><summary>mfe-case-study-lib</summary>

Static read only; no builds, tests, installs or state-changing git commands were run.

Read in full:
- apps/mfe-case-study/src/query/: case-study-queries.ts, operations-tasks-queries.ts, field-inspection-workspaces-queries.ts, suspended-transactions-queries.ts, governed-property-documents-query.ts, property-detail-documents-query.ts, property-primary-photo-query.ts, property-detail-party-submissions-queries.ts
- apps/mfe-case-study/src/lib/: field-inspection-workspaces-api.ts, party-task-work-refresh.ts, party-active-task-work-host.ts, storage/index.ts
- apps/mfe-case-study/src/lib/app-data/: inspector-workspace-reads.ts, inspector-workspace-commands.ts, inspector-workspace-model.ts, finalize-field-inspection-submission.ts, case-study-form-commands.ts, case-study-form-reads.ts, tasks-reads.ts, tasks-commands.ts, po-intake-reads.ts, po-intake-commands.ts, property-field-autosave.ts, operations-tasks-reads.ts, operations-tasks-commands.ts, operations-tasks-model.ts, suspended-transactions-model.ts, suspended-transactions-reads.ts, suspend-property-transaction.ts, workflow-task-list-query.ts, governed-property-documents-commands.ts, governed-property-documents-reads.ts, inspector-photo-upload.ts, viewer-task-access.ts, po-intake-due-dates.ts, delivery-countdown.ts, field-inspection-work-queue.ts, apply-inspector-answers-to-specialist.ts, bourse-obstruction.ts, valuation-print-attachment-keys.ts, valuation-report-specialist-search-scope.ts
- apps/mfe-case-study/src/views/: usePoListWorkflow.ts, useActiveTransactionQueueData.ts, useMyTaskWorkCommands.ts, useQueuePartyProgress.ts, PartyActiveTaskWorkPage.tsx, MyTasksView.tsx

Read in part: po-intake-model.ts, tasks-model.ts, my-task-row.ts, active-queue-list-filters.ts, property-detail-party-submissions.ts, favorite-properties.ts, evaluator-bridge.ts (skim), po-list-view-state.ts, active-transaction-queue-state.ts, useMyTaskWorkWorkflow.ts, useOperationsTasksCommands.ts, useOperationsTasksData.ts, operations-tasks-view-state.ts, PartyActiveTaskView.tsx, BourseInquiryView.tsx, ActiveTransactionQueueView.tsx, active-transaction-queue-filters-toolbar.tsx, use-active-transaction-page-situation.ts.

Code outside the audit area checked to confirm findings:
- Backend: PartyTaskSubmissionService.SaveDraftAsync, PartyTaskSubmission.SaveDraft, CommandIdempotencyMiddleware, WorkOrderPropertyCommands (Update/DeleteProperty), WorkflowTaskLifecycleCommands.AdvanceAfterBourseAsync, WorkflowTaskSlotSynchronizer, ListPendingBourseAsync, FailureService.SuspendAsync, OperationsTask transition rules.
- Frontend packages: offline-write.ts, party-submission-api.ts, prefetch-read.ts, use-idempotent-action.ts, the api-client list and pagination helpers.
- Shell: useOfflineSyncCoordinator.ts and app-data-queries.ts.
- Spec: security_offline_spec.md §3 and pagination-contract.md §2.

Checked and dropped:
- The shared idempotency key between submit and accept is safe because the middleware keys by path.
- The double advance-after-bourse is idempotent on the server.
- Case-study form batch reads are already chunked.
- An unlinked property, or a bourse advance skipped because loadWorkflowTasks returned [], is repaired by the backend slot sync.
- OPERATIONS_TASKS_CHANGED_EVENT has no listener; only KPI counters go stale, for about 30 s.
- The PO-list billing bucket is capped at 500 rows, which the pagination contract documents.

Not reached:
- lib/app-data: assignment-doc-attachments.ts (930 lines), property-detail-documents.ts, property-detail-party-submission-builders.ts and -loaders.ts, infath-upload-model.ts, case-study-report-*, official-letter-layout.ts, site-location-ack-*, internal-delegation-letter*, map-locations-logic.ts, map-live-records.ts, dual-calendar-date.ts, active-transaction-page-situation.ts, inspector-deed-prefill.ts, deed-nature-match-proposal.ts
- views: usePropertyMapWorkflow.ts, the OperationsTasks* view components, SuspendedTransactionsView, FieldSyncSupervisorView, CaseStudyWorkspaceView, PoPropertiesPage
- extensions/*, which I only listed.

</details>

<details><summary>mfe-evaluator</summary>

What I read in full: apps/mfe-evaluator/src/components/evaluator/valuation-work/: FinalOpinionSection, useFinalOpinionWorkflow, lib/final-opinion-state, MethodologyAlertsPanel, useAdjustmentsMatrixCommands, useComparableMarketSaver, useComparablesCommands, useMarketApproachCommands, lib/market-commands-state, lib/market-save-mappers, lib/adjustments-matrix-state, lib/matrix-actions, useCostApproachWorkflow, lib/cost-approach-state, lib/cost-line-math, useValuationWorkData, useValuationWorkReadModels, useValuationSectionSaves, lib/bank-ranking, the relevant parts of lib/valuation-data-state, useReportIssuanceWorkflow, ApproachSettingsSection (save path), and parts of ValuationWorkShell, AdjustmentsMatrix and AdjustmentsMatrixCells. apps/mfe-evaluator/src/components/evaluator/: EvaluatorWindow (autosave/submit/render), parts of EvaluatorValuationReportOutputTab, EvaluatorFinalReviewTab (state) and EvaluatorValuationReportTab. apps/mfe-evaluator/src/lib/evaluator/: finalize-appraiser-submission, evaluator-submission-commands, evaluator-submission-model, issue-valuation-report, valuation-report-number, arabic-amount-words, valuation-report-comparables-map, valuation-report-approved-render, parts of valuation-report-fill-model and valuation-report-live-fill-dom (finishing/§12), evaluator-checklist-case-study-sync, evaluator-report-output-helpers (bundle loader). apps/mfe-valuation: AddComparableForm, comparable-properties-state, ValuationRequestsView (actions), valuation-api, valuation-queries. I checked the backend counterparts to confirm the client/server mismatches: ValuationReconciliationService and ReconciliationRules, MarketApproachRules, CostApproachRules, SaveMarketAsync/SetAdoptedAsync, the issuance gate rules, the SubmitReport controller and the party-task-submissions controller. Shared: property-geo.ts and party-submission-api.ts.

Known failing checks: (1) tests/architecture/component-size.test.ts, 'admits no new component over the cap', fails. EvaluatorWindow.tsx is 703 lines and ValuationWorkShell.tsx is 704, against cap 700, and the frozen list in docs/architecture/frontend-size-baseline.json is empty. This is a size ratchet only, with no runtime effect; moving about 5 lines out of each file (for example the persistDraft/scheduleAutosave block into a use*Workflow hook) fixes it. (2) valuation-report-comparables-map.test.ts: I could not tell statically which assertion fails, because running it was outside the read-only rules. The source and the test last changed together in abfb866d, and the map-slot logic appears internally consistent. Both failures reached production because .github/workflows/frontend.yml runs on pull_request and workflow_dispatch only; the deploy path (direct push or merge to main, deploy.yml) runs backend tests only, so frontend unit and architecture tests never gate a deploy.

Not reviewed in depth: CostApproachLinesTable and CostApproachParts rendering, ComparablesBankTable and ComparablesBankMoneyCells, FinalOpinionParts, EvaluatorChecklistTab, EvaluatorAdvisoryPanel, the bulk of valuation-report-live-fill-dom, valuation-report-tab-sections, valuation-report-sheet-facts, valuation-report-v3-preview, valuation-report-print-attachments/print-flow/print-assets, valuation-report-missing-fields, ReportMissingFieldPrompt, ComparablePropertiesView, TagEditorRow, and the test files. Smaller items not reported: the downloadIssuancePdf object URL is revoked synchronously (moot, since that hook is dead); the amounts-in-words grammar ('مائتان ألف'); client rounding uses JS Math.round while the server uses decimal AwayFromZero (±1 SAR at .5 boundaries); the AddComparableForm reverse-geocode race while coordinates are being typed.

</details>

<details><summary>shell-offline</summary>

I read these files in full: apps/shell/public/sw.js, apps/shell/src/proxy.ts, apps/shell/next.config.ts, app/layout.tsx, app/(app)/layout.tsx, app/page.tsx, app/manifest.ts, app/login/login-ui.tsx. From app/login/page.tsx I read only the session-resume and OTP-redirect blocks. Components read: AuthSessionWatcher, PrototypeAppGate, PageAccessGate, OfflineSyncCoordinator, offline-sync-state, ServiceWorkerRegister, FieldOfflinePrefetch, OfflineWriteInterceptorHost, PlatformRuntimeBootstrap, OfflineBanner, DomainEventBridge, ServerNotificationBridge, PwaInstallPrompt, plus AppShell.tsx lines 186-292. Hooks and lib read: useOfflineSyncCoordinator, useAppShellLogout, offline-sync-replay, offline-page-cache, push-logout, web-push-client. I read all of packages/offline-client/src (sync, store, repository, lease, crypto, page-cache, types, index) and packages/auth-client/src (session, index). I also read the app-shared glue these depend on: offline/offline-write, install-offline-write-interceptor, offline-access-cache, offline-routes, part of prefetch-read, auth/ensure-fresh-session, offline-session, use-auth-session, api-config. To confirm failure paths I cross-checked mfe-case-study inspector-workspace-commands/reads/model and inspector-photo-upload, the api-client save/submit/upload/comment/refresh functions, and the backend FieldInspectionPayloadAttachments, FieldInspectionSubmissionValidator, FieldInspectionAttachmentVerifier and AuthSessionService (the refresh has a 60 s reuse grace, so concurrent force-refreshes are not a problem).

Real but left out to stay within 12 findings: (a) the CSP allows `script-src 'unsafe-inline' 'unsafe-eval'` and `connect-src https: http: ws: wss:` while access and refresh tokens sit in localStorage, so the CSP gives no XSS or exfiltration protection (next.config.ts:119,123). (b) FieldOfflinePrefetch re-lists and re-downloads every basic document for every task on each reconnect or task-list change, with no check for already-cached blobs (FieldOfflinePrefetch.tsx:58-66, deps 229-237); heavy on cellular with a flapping connection. (c) The SW navigation `fetch(request)` has no timeout (sw.js:147), so in lie-fi an offline launch can hang before falling back to the cached page. (d) Prefetched document blobs are never expired except on purge. (e) The lock overlay's `locked` state is never reset once set in a tab.

Not reviewed: NotificationCenter, NotificationToastBridge, IntakeFieldGapQuickFillDialog, PullToRefresh, the views/* screens (AuditLog, FeePricing, nav parts), the query hooks, party-tasks and po page clients, public/ejadah/*.js, the shell unit tests, api-client write-repository, and the mfe-keys offline enqueue paths (keys-envelope-api.ts). I made no file changes and ran no builds or tests.

</details>

<details><summary>app-shared</summary>

Read in full or in the relevant parts:
- api-client: api-base, idempotency-key, parse-json, field-errors, write-repository, permissions, index, party-task-submissions, prototype-modules (all 1161 lines), auth, pagination.
- api-client: work-orders (DTO/ApiErr types, list helpers, all write functions 680-1000), workflow-tasks (all writes), notifications (writes + SSE reader), courts (adminRequest), enfaz-billing (normalizers + all writes), case-study-forms (batch + party save), valuation-comparable-selections (status handling map + issuance posts), push, comparable-properties (deactivate/reactivate).
- app-shared: every file in offline/ (interceptor, offline-write, prefetch-read, offline-routes, offline-list, offline-access-cache); auth/ (api-config, ensure-fresh-session, offline-session).
- app-shared app-data: party-submission-api, work-orders-api-config, modules-api-config, task-attachments-api, attachment-blob-cache, page-access, permissions-pages, runtime-access, party-task-recall-commands, enfaz-billing-api (wrappers), party-billing-statements-api (wrappers), valuation-report-specialist-esg/finishing (save paths).
- app-shared other: query/ (app-data-keys, optimistic-list, permissions-queries), contexts/AppAccessContext, components/Can, hooks/use-idempotent-action + use-command-mutation, storage/ (browser-domain-store, specialist-report-extras-sync), notifications/notification-store, media/open-html-document.
- types: all 4 source files.

To confirm the failure paths I also read, outside my area: offline-client sync.ts and repository.ts; the shell's offline-sync-replay, offline-sync-state and useOfflineSyncCoordinator; the mfe-keys and mfe-evaluator callers; the finance collect workflow. On the backend: PartyTaskSubmissionsController and SubmitAsync, CommandIdempotencyMiddleware, SpecialistReportExtrasRules, AttachmentUploadRules, PoEnfazInvoiceRules.ValidateCollection, nginx.conf. Behaviour of spreading a Headers object was checked with a one-line `node -e`; nothing was modified.

Checked and not reported:
- Concurrent force-refresh: the server has a grace window for concurrent refreshes.
- Duplicate submit replays: the server treats re-submitting a submitted package as a no-op.
- PermissionsDto and UserStatus/ContractType match the backend; sourceFingerprint travels in the payload as the backend expects.
- HTML letter generators escape their inputs.

Not read:
- app-shared: inspector-workspace-data.ts (1633-line domain model), property-fields-catalog, po-intake-*, comparable-entry, screen-catalog, registration/ and fees/ components, ActiveQueueMobileCards, notifications hooks/provider, most `__tests__`.
- api-client: users, organization-settings, financial, inspector-fees, party-billing-statements, operations-tasks, failures, regions, reporting, clients, numbered-documents, building-inventory, inspection-limits, property-groups/comparable-links, valuation-report-pdf, and the remaining DTO shapes of valuation-comparable-selections.

Across many api-client write functions, 400/403/409 responses collapse to kind 'server' with no message (for example workflow-tasks advance/patch, enfaz issue/collect). The server's reason is then hidden behind a generic error. Only the offline and idempotency consequences of this made the list above.

</details>

<details><summary>ui-settings-dashboard</summary>

What I read in full: ui-kit (AppModal, Modal, SideSheet, Button, Toast, action-toast-listener, action-progress-message, GoogleMapPin, google-maps-loader, ListPager, RowMoreMenu, Tabs, BulkActionBar, ErrorBoundary, InfathFormFields, pasted-date, Table head section). Settings (users workflow/state/table/view, EditStaffUserModal, AddStaffUserModal head, ConfirmActionModal, DevSystemResetPanel plus its backend SystemController, system-maintenance-api, users-api, settings-queries, the case-study-info-roles view/model/commands/reads/data, OrganizationSettingsView/Forms/state/workflow, OrganizationDataView (most of it), ValuersRosterView, useValuersRosterWorkflow, valuers-roster-state, useValuationListsWorkflow, AttachmentPrintDictionaryView, ValuationListsPanels (cert and participants panels), ProfessionalValuationReportView, useBrandIdentityWorkflow, BrandIdentityView, BrandIdentityA4Preview, brand-test-page, brand-image-picker, org-settings-ui, ClientsView, CourtsView workflow section, LocationsPendingView head, PushNotificationSettings, ProfileInspectorDuesPanel, UserProfileContent head). Dashboard (all components, dashboard-metrics, queries, reporting api). Survey (all files). I cross-checked the backend where a settings flow depends on it: OrganizationSettingsService Save/Merge/NormalizeValuers/validation, OrganizationBrandingRules, CaseStudyInfoRolesController/Service, CourtsService list, UserRegistrationService.UpdateStaffAsync, StaffRoleCatalog and PlatformPermissionCatalog.

Not read or only grepped: ui-kit Skeleton, StatCard, KpiBand, MobileKpiStatCards, FilterChips, OperationalToolbar, PageLayout, SubpagePanel, TransactionRow, Card/Badge/badges, CSS/tokens, icons. Settings DifferenceFactorCatalogView, FieldDictionaryTab, ScreenCatalog*, ProfessionalReportIdentityPage/TextsPage and the report-fields/tables helpers, BrandIdentityLetterhead*/useBrandLetterheadZoom, BrandIdentityAssetCards (grepped only), ValuersRosterTable, UserProfileModal/ProfileView, courts-catalog, the markdown export. Dashboard dash-svg/DashIcons.

Checked and dropped: the only srcDoc (the brand test page) escapes its inputs, and no dangerouslySetInnerHTML exists in these four packages. Map info-window labels escape '<', so they are safe. The global action toast can in theory show a success toast after a failed save, but it only fires when the button goes busy and idle again within 50 ms of pointerdown, so I judged it effectively inert rather than a real lie. The dev reset panel shows in production for the CDO, but the API returns 404 outside Development. Minor items not reported: the area-factor input can't take values below 1 because `Number('0')||5` snaps to 5; «تحديد كمقروء» on the dashboard marks every notification read, not just the 8 shown; BulkActionBar's Escape also clears the selection when a child modal is closed with Escape.

</details>

<details><summary>mfe-ops-fin</summary>

What I read in the four MFEs:
- **mfe-keys:** all lib, components, views and query files (keys-envelope-api, register/detail/dialog state and workflows, detail modal, deliver/receive/court-access dialogs, fees panel, keys view workflow and state).
- **mfe-engineering-office:** the attachments, submission commands/reads/model, finalize, validation, draft-write-queue, useEngineeringSurveyData, useEngineeringSurveyCommands, and the advisory panel accept/return section.
- **mfe-failures:** failures-api, failures-repository, useFailuresViewWorkflow, failures-view-state, FailureRaisePanel.
- **mfe-financial:** Enfaz billing (state, workflow, actions, summary, PO billing), party-billing statements (state, workflow, costs view, cost-parties list and aggregation), financial-api, billing-list-page-queries, and part of the statement detail.

Shared and backend code I followed where these flows depend on it:
- **Shared packages:** offline-write.ts, party-submission-api.ts, task-attachments-api.ts, install-offline-write-interceptor.ts, offline-client sync.ts and lease.ts.
- **Shell:** offline-sync-replay.ts, offline-sync-state.ts, useOfflineSyncCoordinator.ts.
- **Backend:** KeyEnvelopesService/Controller/DTOs/Fees, KeyReceiptFeeChargeService, PropertyKeyGateResolver, the PoEnfazBillingService issue/collect path, PoEnfazInvoiceRules, PartyBillingStatementService.Lists, AttachmentUploadRules, the capability policies and the permission catalog.
- **Spec:** security_offline_spec.md §3.

Not read, or only skimmed:
- **mfe-financial:** FinanceEngOfficePortal, FinanceInspectorPortal, FinanceMyTasks, FinanceDisbursementCloseModal, FinanceVendorInvoiceMatchModal, FinanceExcludedCosts, the party fee pricing editor/workflow, the revenue tables and stages, the Enfaz followups panel.
- **mfe-failures:** failure-types views/commands, FailureReportForm, the list-page hook.
- **mfe-engineering-office:** the map, checklist sync and inspector-pin files in detail.
- **mfe-keys:** the attachment preview component.
- **Backend:** vendor-invoice matching rules.

Nothing was built, run or modified. The findings come from reading the code only, with no runtime reproduction.

</details>

<details><summary>infra-ci</summary>

Read in full: infra/docker-compose.prod.yml (working copy, plus the uncommitted diff and the committed version on origin/main), infra/nginx.conf, infra/setup-hetzner-server.sh, infra/HTTPS.md, infra/production.env.example, infra/postgres/init-prod.sql, infra/postgres/drop-leftover-shared.sh, infra/postgres/copy-case-study-data.sh, .github/workflows/deploy.yml (working copy + origin/main), .github/workflows/frontend.yml, all 12 Dockerfiles (read identity, gateway, attachments, valuation, case-study, reporting, DbMigrate and the shell in full; the other service Dockerfiles follow the same template), .dockerignore, scripts/ops/*.sh and *.sql, vitest.config.ts, playwright.config.ts, apps/shell/next.config.ts, backend/tools/DbMigrate/Program.cs, and the relevant parts of DevSeed/DataSeeder.cs, ComparableBankSeed.cs, AuthController.cs, StaffRegistrationRepository.cs, the login page, gateway Program.cs / appsettings.Production.json / GatewayClientAddressForwarding.cs, ClientAddressResolver.cs, RabbitMqTopology/Publisher/OutboxDispatcher, ValuationReportWorkflowHandler.cs, and the sections of docs/DEPLOYMENT_HETZNER.md and security_offline_spec.md §1 cited above.

Checked and found OK: every image runs non-root (USER $APP_UID / nextjs) with digest-pinned bases and health checks; the attachments volume is chowned; nginx strips X-REE-Upstream and so does the gateway; X-Real-IP is always set by nginx, so rate-limit keys cannot be spoofed; HSTS and TLS 1.2+ are in place; the Gotenberg deny list is sound; no secrets are baked into images; `.env` is parsed without sourcing.

Also useful, not reported as findings:
(a) The 4 critical and other open Dependabot alerts are stale: package-lock.json on origin/main already has next 16.3.3, sharp 0.35.4, vitest 4.1.11, js-yaml 4.3.2 and browserslist 4.29.0, all at or above the patched versions.
(b) Runtime `API_UPSTREAM_URL` (compose line 491) is dead config, because Next bakes rewrites at build time to http://127.0.0.1:5160 (see routes-manifest). This is harmless only because nginx sends /api/ straight to the gateway.
(c) deploy.yml still requires GRAFANA_ADMIN_* although Grafana was removed, and scripts/ops/verify-prod-logging.sh targets the removed Elasticsearch.
(d) The uncommitted image-cleanup block in deploy.yml looks correct.
(e) The postgres init SQL is never copied to the host by the scp step (./postgres/init-prod.sql). It is irrelevant on the existing volume, and DbMigrate creates the databases anyway.

Not covered: infra/docker-compose.yml (dev) in depth (it publishes Postgres/RabbitMQ/Redis with dev passwords on all interfaces, which matters if the dev box is on the office LAN), the monitoring configs (prometheus, grafana, otel, fluent-bit; unused in prod), scripts/*.mjs tooling, e2e/ probes, and the other copy-*-data.sh scripts (one-time split tools; they pipe pg_dump into psql without pipefail, but the split is complete). Live host state (the actual TLS paths and hooks, whether Hetzner provider backups are enabled) could not be verified from the repo.

</details>

<details><summary>x-authz</summary>

What I read in full: gateway Program.cs, appsettings.json (routes), GatewayClientAddressForwarding.cs, infra/nginx.conf, and the relevant parts of infra/docker-compose.prod.yml (identity, migrate, gotenberg, reporting, redis). In backend/shared/RealEstateEval.Shared.Web: ServiceCollectionExtensions.cs (JWT, every capability policy), ObservabilityExtensions.cs (pipelines), RequireUpstreamDispatchAttribute.cs, CapabilityAuthorizationHandler.cs, ServiceProgram.cs, RealEstateEvalApiHostExtensions.cs. Also PlatformCapabilities.cs, PlatformPermissionCatalog.cs, PermissionService.cs, PoRoleMatrixRules.cs, AttachmentAccessRules.cs (+ its test), and apps/shell next.config.ts and login/page.tsx.

Controllers read in full: AuthController, PermissionsController, IdentityLookupController, AttachmentsController, WorkOrdersController, CaseStudyFormsController, PartyTaskSubmissionsController, BuildingInventoryController, InspectionLimitsController, WorkflowTasksController, FieldInspectionWorkspacesController, InspectorFeesController, PartyBillingStatementsController (1-180 plus the actor context), TransactionStateController, OperationsTasksController, KeyEnvelopesController, PropertyKeysController, SurveyOfficesController, FinancialController, FailuresController, NotificationsController, PushSubscriptionsController, FieldSyncStatusController, OrganizationSettingsController, ReportingController, ComparablePropertiesController, PropertyComparableLinksController, ValuationRequestsController, ValuationReportIssuanceController, ValuationReportPdfController.

Services traced behind them: AttachmentService, AttachmentLookup, InspectionLimitsService, BuildingInventoryService, WorkOrderPropertyCommands (map URL / extras), WorkOrderVisibilityFilter, WorkOrderQueryService (visibility), PropertyTimelineService, DiscountFlagService, IncentiveSuspensionService, KeyEnvelopesService.DeleteAsync, KeyReceiptFeeChargeService, ComparablePropertyService, ValuationReportPdfService, GotenbergHtmlPdfRenderer, ReportingUpstreamClient, ApiResponseCache, OrganizationSettingsService (secret masking), StaffRegistrationRepository.ListDevLoginUsersAsync, AuthSessionService.IssueForUsernameAsync, DataSeeder demo accounts.

Enumerated through attribute scan only, not read in depth: the dispatch controllers (CaseStudy/Failure/FinancialCharges/InspectorFee/PartyBilling/PoEnfaz/KeyEnvelope/OperationsTask/ValuationRequest dispatch, AuditLogAppend). All carry [Authorize] + [RequireUpstreamDispatch], and the gateway and nginx strip X-REE-Upstream. Also scan-only: EnfazBilling, Clients, NumberedDocuments, PropertyGroups, PoIntakeDraft, SuspendedTransactions, System, Users, DistributionAssignees, Regions, Courts/AdminCourts, the platform catalog controllers (FieldDictionary, AttachmentPrintDictionary, DifferenceFactorCatalog, ValuationLists, CaseStudyInfoRoles, AuditLog), FailureTypesCatalog, EvaluatorRecalls, and the valuation sub-controllers (approach settings, comparable selections, cost approach, reconciliation, field injection, report document). These looked correctly policy-gated, but I did not trace their service-level ownership logic.

Checked and found no issue: notification, push and field-sync endpoints are self-scoped; party form and submission reads and writes enforce CanRead/CanWritePartyTask; the property timeline filters by PO + property; org-settings GET masks SMTP/SMS secrets; the Gotenberg deny list blocks http(s)/file; backend service ports are not published in the prod compose.

Not covered: frontend authorization logic beyond the login call; per-service ServiceModule wiring (e.g. whether any host overrides authentication); the valuation pool model, where no appraiser assignment exists, so appraiser-vs-appraiser IDOR was treated as by design.

</details>

<details><summary>x-contracts</summary>

I read every api-client module's endpoint list: all fetch paths and verbs across packages/api-client/src/*.ts. I compared them against the full route/verb inventory of all 67 controllers under backend/services/**/Controllers, the gateway YARP route table (backend/gateway/RealEstateEval.Gateway/appsettings.json) and the CanonicalV1AliasConvention/ApiV1Alias logic that serves the /api/financial/v1 and /api/reporting/v1 paths. I found no missing endpoint and no verb mismatch.

Files read in detail, client side paired with backend controllers and DTOs:
- work-orders.ts (WorkOrdersController, WorkOrderDtos.cs, WorkOrderPropertyCommands.cs, WorkOrderPropertyWriteRules.cs, WorkOrderMapper round-trip)
- workflow-tasks.ts (WorkflowTasksController, WorkflowTaskDtos)
- party-task-submissions.ts
- prototype-modules.ts (attachments, key-envelopes, evaluator-recalls, valuation-requests)
- valuation-comparable-selections.ts (all valuation controllers and their policies)
- valuation-report-pdf.ts
- failures.ts, inspector-fees.ts, party-billing-statements.ts (with DTOs and validators), enfaz-billing.ts
- notifications.ts (SSE), organization-settings.ts (including secret masking)
- users.ts, auth.ts, courts.ts, regions.ts, clients.ts, comparable-properties.ts (query DTOs), property-comparable-links.ts, property-groups.ts, numbered-documents.ts, po-intake-draft.ts, field-sync-status.ts, field-inspection-workspaces.ts, inspection-limits.ts, operations-tasks.ts (request DTOs), financial.ts, reporting.ts, audit.ts, pagination.ts, write-repository.ts, field-errors.ts, idempotency-key.ts

Also checked:
- JSON options (camelCase plus JsonStringEnumConverter) and the capability policy/role catalog (PlatformPermissionCatalog)
- ApiProblemExtensions error shapes and inter-service RemoteClients paths against the dispatch controllers; all match
- The offline write interceptor, and the offline replay and outbox retry semantics relevant to finding 1
- Frontend callers for the flagged paths: PoPropertyEdit, po-intake-commands/model, keys-envelope-api, recall commands/UI, tasks-commands

Not covered:
- Deep schema of the schemaless party-submission payload JSON (field-inspection form contents)
- Every mfe-local fetch helper outside api-client beyond a grep of /api/ literals
- CaseStudyForm save semantics for omitted optional fields
- Authorization/IDOR analysis beyond contract/policy mismatches (e.g. comparable-bank edits by party roles and InspectionLimits save scope are left to the security audit)
- The reporting dashboard's global cache key versus per-actor visibility, noticed but not verified

I also considered and dropped two issues:
- SSE behind nginx without proxy_buffering off: there is a 12s polling fallback.
- A mojibake fallback string in saveValuationReconciliation: effectively unreachable.

</details>

<details><summary>x-deps-secrets</summary>

DEPENDABOT (`gh api .../dependabot/alerts`): 11 open and 2 auto-dismissed. All 11 open alerts are already fixed in package-lock.json on origin/main. main has had next 16.3.3 since at least 2026-09-20. The alerts were last updated 09-11 to 09-13, so GitHub's dependency graph has not re-scanned (the SBOM endpoint returns 404). They should close on their own or after a manual dependency-graph refresh; no code change is needed. Per alert:
- next, 4 critical (#9-#12; GHSA-2xp9-vwfh-vxw4 AVIF image-optimizer RCE, GHSA-p293-qw3h-jr36 Windows-host RCE), fixed in 16.3.3, locked at 16.3.3. Before the fix, the AVIF bug was reachable: /_next/image is unauthenticated (proxy.ts matcher excludes it). The Windows RCE only affected dev machines, since prod runs Linux.
- sharp, high (#8), fixed 0.35.4, locked 0.35.4. Optional dependency used by the Next image optimizer.
- baseline-browser-mapping, medium (#6), fixed 2.11.0, locked 2.11.24. Build-time only.
- browserslist, high (#3), dev only, locked 4.29.0.
- js-yaml, high (#13), dev only, locked 4.3.2.
- vitest and @vitest/mocker, medium (#4, #5, #7), dev only, locked 4.1.11.

NPM AUDIT (`npm audit --omit=dev --json` at repo root): 0 vulnerabilities across 76 prod dependencies. The GitHub advisory DB also shows no advisories for next@16.3.3, sharp@0.35.4 or react@19.2.4.

NUGET: every PackageReference version was checked against the GitHub advisory DB (`/advisories?ecosystem=nuget&affects=`), including JwtBearer/Identity/EF 10.0.8, Npgsql EF 10.0.1, Yarp 2.3.0, RabbitMQ.Client 7.2.1, QuestPDF 2025.7.3, Lib.Net.Http.WebPush 3.3.1, SSH.NET, Swashbuckle 7.2.0 and System.IdentityModel.Tokens.Jwt 8.14/8.22. None had advisories.

BACKEND BASE IMAGES: they pin aspnet:10.0.10 and miss runtime 10.0.11 and 10.0.12, but the new CVEs cover components the backend doesn't use: WPF, DiaSymReader, SDK watch, QUIC, IIS/request-decompression, HttpListener and System.Net.WebSockets. Grep found no UseRequestDecompression, SignalR, WebSockets or HttpListener, so this is not reported. It is still worth bumping in the same pass as the Node image.

OTHER INFRA IMAGES: postgres:17.5 is behind 17.6, 17.7 and 17.8 security releases, but it is reachable only by the app services (not reported separately). nginx 1.27.4, rabbitmq 3.13.7 (community EOL) and gotenberg 8.36.0 were not researched in depth.

SECRETS SWEEP over git ls-files (4367 files), excluding node_modules and the lockfile:
- Checked for GitHub, AWS, Slack, OpenAI and GitLab token patterns, PEM private keys, JWTs, and AIza Google keys (including all of git history). None found.
- All appsettings*.json files were read. They contain only dev placeholders (CHANGE_ME_DEV_ONLY JWT key, rejected in Production by ServiceCollectionExtensions.cs:262 and by the deploy script; Postgres "Admin"; RabbitMQ "dev"; the RabbitMQ dev/dev defaults in base appsettings are overridden in prod through x-rabbit-env). The one real secret is the VAPID pair (reported).
- infra/production.env.example has empty values. .gitignore covers `.env*`, `*.pem` and `data/blobs/`.
- The Google Maps key is not committed. It is injected as a CI build arg and inlined into public JS chunks, which is inherent to a browser key. I could not check whether its Google Cloud HTTP-referrer or API restrictions are set.
- git history has a deleted docs/DEMO_ROLE_CREDENTIALS.txt with old demo passwords (EjadaGM2025! and others). They are not exploitable now: no password-login endpoint exists and the seeder resets those accounts to user1234.
- Minor public data exposure I did not report: e2e/.seed-real-land-pack.mjs contains real deed numbers; docs/DEPLOYMENT_HETZNER.md:134 names server IP 2.28.49.30, which may be the production host; DataSeeder contains a personal Gmail address.
- infra/docker-compose.yml (dev) publishes Postgres, RabbitMQ and Redis on 0.0.0.0 with default credentials. Dev-only, not reported.

FILES READ: all appsettings*.json; infra/docker-compose.prod.yml (working copy plus diff vs HEAD; line numbers cited are the working copy, and main is about 13-14 lines earlier for EnableDevLogin/SeedDemoData); infra/production.env.example; infra/nginx.conf; .github/workflows/deploy.yml and frontend.yml; apps/shell/Dockerfile; all backend Dockerfile FROM lines; AuthController.cs; AuthSessionService.cs (issue/refresh/IsActive); LoginUserResolver.cs; StaffRegistrationRepository.ListDevLoginUsersAsync; DbMigrate Program.cs (seed path); the DataSeeder user, admin and profile upsert paths; case-study ServiceModule seed guard; apps/shell/src/proxy.ts; login/page.tsx authenticate(); gateway client-header forwarding; OfficialLetterAssets.cs; security_offline_spec.md §1.

NOT COVERED: I did not probe the live production site. The uncommitted deploy.yml image-cleanup change was reviewed and has no bug. I did not audit the rollback-after-migration behaviour in deploy.yml (a deploy-area concern). The PWA/offline code and business-logic authorization were out of this slice.

</details>

<details><summary>x-consistency</summary>

Read in full: backend/RealEstateEval.Infrastructure/Integration/* (OutboxDispatcherHostedService, RabbitMqMessagePublisher, RabbitMqTopology, RabbitMqOptions, IntegrationEventInbox, IntegrationEventEnvelopeReader, OutboxIntegrationEventPublisher, PlatformNotificationRequestService, MessagingRetentionHostedService, EfCommandIdempotencyStore); the relevant parts of RealEstateEval.Infrastructure/DependencyInjection.cs and Data/Contexts/Messaging/MessagingModel.cs; all consumers (services/case-study/.../ValuationIntegrationEventConsumer.cs, services/platform/.../NotificationIntegrationEventConsumer.cs, NotificationRealtimeIntegrationConsumer.cs, PushDispatchIntegrationConsumer.cs); the handlers (Platform NotificationIntegrationEventHandler, NotificationRealtimePushHandler, NotificationService; CaseStudy ValuationReportWorkflowHandler and ValuationReportWorkflowTaskLookup); all 10 ServiceModule.cs files; shared/RealEstateEval.Shared.Contracts/IntegrationEvents.cs; Valuation publishers (ValuationOutboxPublisher, ValuationRequestService, EvaluatorRecallsService, the relevant part of ValuationReportIssuanceService, ValuationRequest domain); shared/RealEstateEval.Shared.RemoteClients (UpstreamServicesOptions/UpstreamJson, UpstreamServiceBearer, HttpCaseStudyLookup, HttpIdentityDirectory, HttpWorkflowAssigneeLookup, HttpAuditLogAppend, RemoteClientRegistration); Shared.Web capability policies and handler, CommandIdempotencyMiddleware, pipeline order, gateway header stripping, nginx /api block; infra/docker-compose.prod.yml; deploy.yml compose commands. Cross-context dual writes: FailureService mutation paths, PartyTaskSubmissionService Submit/Reopen/Accept, WorkflowTaskLifecycleCommands.PatchAsync, CaseStudyValuationDispatchService, WorkOrderService.DeleteAsync and the cascade repository. Background sweeps: PropertyKeysProjectionHostedService and PropertyKeysService, InspectorFeeLedgerMaintenanceHostedService and InspectorFeeLedgerWriter (backfill/sync), InspectorFeeSummaryQuery, OperationsTaskReminderHostedService and the reminder commands/notifier, BillingNegotiationDeadlineHostedService.SweepAsync. Frontend checks only: evaluator queue visibility, reopen issuance hook, the po-intake delete orchestration, offline-client idempotency usage.

Not covered or only skimmed: PartyBillingMonthVendorHostedService internals; the financial InspectorFeeService accrual path beyond idempotency; attachments service (no messaging, so its in-memory idempotency store is lost on restart, not investigated further); orphaned cross-context data after a PO hard-delete (financial ledgers, valuation requests, operations envelopes and tasks are not cleaned; noted but not written up because the billing impact was not traced); the identity context; the reporting service; DbMigrate. RabbitMQ.Client 7.2.1 behaviour (default AutomaticRecovery, transient default properties, confirms off by default, AlreadyClosedException on a closed channel) and Kestrel's 8 KB MaxRequestLineSize default are from library knowledge, not a runtime check. Per the hard rules, nothing was built, run or modified.

</details>

<details><summary>x-tests</summary>

What I read in full: .github/workflows/deploy.yml and frontend.yml; vitest.config.ts; playwright.config.ts; root package.json; packages/offline-client/src (sync.ts, repository.ts, lease.ts, the relevant parts of store.ts, both test files); packages/app-shared/src/offline (offline-write.ts, install-offline-write-interceptor.ts); packages/app-shared/src/auth (ensure-fresh-session.ts, offline-session.ts, disabled-account-wipe test); packages/api-client/src/auth.ts; apps/shell (public/sw.js, next.config.ts, ServiceWorkerRegister.tsx, offline-page-cache.ts, useOfflineSyncCoordinator.ts, AuthSessionWatcher.tsx, useAppShellLogout.ts, offline-sync-replay.ts, the auth part of login/page.tsx); apps/mfe-case-study inspector-workspace-commands.ts (save and submit paths); apps/mfe-keys keys-envelope-api.ts (create path).

Backend: AuthController, AuthSessionService, ApiProblemExtensions, CommandIdempotencyMiddleware and its pipeline order, PartyTaskSubmissionService (SaveDraft and Submit), the PartyTaskSubmission domain transitions, FieldInspectionAttachmentVerifier and the payload collector, ValuationIssuanceGateService, ValuationReconciliationService, DbMigrate/Program.cs (migrate section), the MigrationStreamTests and EfModelBoundaryTests headers, DatabaseMigrationTests, IdentityApiDevGateTests, the gateway appsettings, and the committed and uncommitted versions of infra/docker-compose.prod.yml.

Checks I ran: `gh run list` for both workflows (frontend.yml has never run; the last container full-suite run was 2026-09-14) and the failed-run log for 34837065351. Vitest on single files or small directories: tests/architecture (component-size FAILS on HEAD; hook-size and storage-purity pass), offline-client, app-shared offline and auth, and a set of finance, offline-sync-state, offline-page-cache, keys-offline and field-inspection files (all pass). I also ran one scratch repro test from the scratchpad (outside the repo, no repo files touched) that confirmed the outbox stale-snapshot data loss.

What I did not do: run any dotnet build or test, next build or typecheck, or the full vitest suite. I did not audit the individual Playwright journeys, financial and billing money arithmetic beyond test-reference counts, reporting and attachments services, or the ~180 Application.Tests files for weak assertions. Several heavy services have no direct test references: ValuationReconciliationService, ValuationCostApproachService, ValuationIssuanceGateService, UserRegistrationService and FieldSyncStatusService. They are covered only indirectly through rules tests, and I found no concrete bug in the two I read. I also did not check the idempotency middleware's lack of an in-flight lock beyond noting that the client-side Web Lock covers cross-tab replay.

</details>

<details><summary>gap-valuation-money-math</summary>

I read these files in full.

Server valuation:
- `MarketApproachRules.cs`
- `ValuationMarketAndCostApproach.cs`
- `ValuationReconciliation.cs`
- `ArabicAmountWords.cs`
- `ValuationReportFieldAdjustmentFlattenRules.cs`
- `ValuationReportFieldCostLineFlattenRules.cs`
- `MarketAdjustmentFactorKeys.cs`
- `ValuationComparableSelectionService.MarketApproach.cs`
- `ValuationComparableListBuilder.cs`
- `ValuationComparableSelectionRequestRules.cs`
- `ValuationReconciliationService.cs`
- `ValuationCostApproachService.cs`
- `ValuationReportFieldInjectionService.cs`

I read these in part:
- `ValuationReportDocumentService.cs` (lines 1-310)
- `ValuationIssuanceGateService.cs` (lines 100-230)
- `ComparablePropertyRules.cs` (grep only)
- The repo/controller wiring

Client valuation, in full:
- `adjustments-matrix-state.ts`, `matrix-actions.ts`, `cost-line-math.ts`, `cost-approach-state.ts`, `final-opinion-state.ts`, `market-save-mappers.ts`, `factor-registry.ts`
- `useFinalOpinionWorkflow.ts`
- `arabic-amount-words.ts`

Client valuation, in part:
- `FinalOpinionSection.tsx`
- `MethodologyAlertsPanel.tsx`
- `CostApproachLinesTable.tsx`
- `valuation-report-fill-model.ts` (final value, words, recon cells)
- `valuation-report-sheet-facts.ts` (cost and adjustment sheet rows)
- `valuation-report-approved-render.ts` (sections 12-16)

Financial, in full:
- `PoEnfazInvoiceRules.cs`, `PoEnfazBillingDtoBuilder.cs`, `PoEnfazBillingService.cs`, `PoEnfazRevenueRules.cs`, `FinancialReportService.cs`, `EnfazInvoicePdfGenerator.cs`, `EnfazInvoicePdfRenderer.cs`, `PoEnfazInvoice.cs`
- `finance-enfaz-po-billing-state.ts`, `finance-revenue-state.ts`, `finance-revenue-stages.ts`, `finance-cost-parties.ts`, `useFinanceEnfazPoBillingWorkflow.ts`
- `FinanceEnfazBillingSummary.tsx` (part)
- The financial Api Dockerfile and a grep across all Dockerfiles and infra for fonts and TZ.

Checks run in the scratchpad only (no repo changes):
- Node checks for float-vs-decimal rounding counterexamples.
- The TS tafqit function run on sample amounts.

Checked with no finding:
- log2 area ratio: the ratio is always ≥ 1 because of max/min and the ≤0 guards, so there is no NaN and no negative log.
- DealAgeMonths: no client mirror exists; it is informational only.
- Sequential adjustments multiply, then difference factors are summed and applied once. The server and the display agree.
- SuggestWeights largest-remainder allocation sums to 100 and has no divide-by-zero.
- Division by zero in CostApproachRules, NetUnitRate and PhysicalObsolescence is guarded.
- The weighted unit rate is not normalized, but the issuance gate enforces the sum.

Not reviewed in depth:
- `ValuationReportPdfGenerator` (already confirmed).
- Party billing statement VAT on the server (PartyBillingStatementService/Rules), so I could not cross-check `applyCostTax` against the server. I also did not report that `balanceSar` treats a null payee type as untaxed while `statementDisplayTotal` treats it as a vendor.
- Methodology alert rules.
- The income approach (deferred in code).
- Whether any other QuestPDF documents in the financial context (authorization letter, site declaration) share the font problem. They likely do, since they use the same chrome.

</details>

<details><summary>gap-dates-hijri-digits</summary>

Read in full or in the relevant parts. Backend: BillingNegotiationDeadlines.cs, BusinessDueDateCalculator.cs, OperationsTaskReminderCalculator.cs, the Operations/Valuation Dockerfiles, CaseStudyValuationDispatchService.cs, WorkOrderQueryService.cs (counts), WorkOrderListQueryRules.cs, ValuationRequestService.cs, ValuationRequest.cs, ReferenceNumbering.cs, ReferenceSequenceAllocator.cs, ValuationReportSections.cs (number/validity/display rules), ValuationReportDocumentService.cs, ValuationIssuanceGateService.cs, ValuerCredentialRules.cs, ValuationReportIssuanceService.cs (issue path), ComparablePropertyService.cs (today sites + Validate), ComparablePropertyRules freshness, ValuationComparableSelectionService.cs 56/281, ValuationComparableListBuilder/MarketApproachRules.DealAgeMonths, ValuationReportFieldInjectionService.cs, ValuationReportFieldBuilder.cs, EnfazInvoicePdfGenerator.cs, FinancialReportService.cs, PartyBillingMonthVendorHostedService.cs + MonthStart/ListVendorsWithOpenStatementsAsync, BillingNegotiationDeadlineHostedService.cs, OperationsTaskRepository/Commands (NextIdsAsync), NumberedDocumentService.cs, the 4 numbering migrations, DeedNumberRules.cs, Texts.cs, SaudiMobiles.cs, StaffUserRules.cs, WorkOrderValidator.cs (contacts/deed), FieldInspectionWorkspaceProjector.TryParseCoord. Frontend: valuation-report-number.ts, finalize-appraiser-submission.ts, issue-valuation-report.ts, evaluator-report-output-helpers.ts, EvaluatorValuationReportOutputTab.tsx, valuation-report-fill-model.ts (dates/age), valuation-report-property-age.ts, dual-calendar-date.ts, DualCalendarPickerPanel.tsx, PropertyDetailInspectionDateField.tsx, comparable-entry.ts, ComparablePropertyEntryFields.tsx, AddComparableForm.tsx (mfe-valuation), ComparablesBankMoneyCells.tsx, bank-ranking.ts, market-commands-state.ts, shell-state.ts, usePartyBillingStatementsWorkflow.ts, po-list-view-state.ts, PoPropertiesPage.tsx, po-intake-due-dates.ts, my-task-row.ts, DashDueSoonOrders.tsx, login page + login-ui.tsx, PoContactEditor.tsx, property-validation.ts, arabic-digits.ts, inspector-workspace-data.ts (inspection stamp, national-ID normalizer), infath-upload-model.ts, operations-task-display.ts, PropertyDetailCaseStudyReport.tsx, party-fee-pricing-state.ts, FinancePartyFeePricingParts.tsx, format/date.ts, row-age.ts (unused). Checked and found OK: tzdata/ICU. Grep found no InvariantGlobalization or DOTNET_SYSTEM_GLOBALIZATION_* anywhere. The Dockerfiles use the Debian/Ubuntu mcr aspnet images, whose runtime-deps layer installs tzdata and libicu, so 'Asia/Riyadh' resolves; I could not run a container to confirm. Also OK: BillingNegotiationDeadlines (correct Riyadh offset, Fri/Sat weekend), BusinessDueDateCalculator (works on the entered local date/time), the ReferenceSequenceAllocator ON CONFLICT upsert (atomic per prefix and year; the year row resets naturally), and the numbering backfill migrations (Riyadh year). Not reported: the market-conditions adjustment uses 'today' instead of the retrospective date, but the prototype spec explicitly says months = (اليوم − date) (docs/_تقييم.../منطق-التسويات.md:66). Not reported, low or uncertain: the month-vendor job's UTC day-1..3 window (harmless 3h delay); ar-SA N2 separators in the Enfaz invoice PDF (dev and prod both use ICU, so not environment-dependent; not verified under .NET); FinancialReportService PeriodLabel (not displayed anywhere); the comparable 'recent/stored' freshness label boundary. Not reached in depth: PartyOfficeBillingStatementsPanel.tsx, FinanceEnfazFollowupsPanel.tsx, useEngFeesWorkflow.ts (default form dates use the same UTC toISOString pattern as finding 4, only the default value, user-editable); ValuationListsPanels.tsx:168 (membership-expired badge, same 3h UTC window); the Hijri formatting in site-location-ack-letter.ts; key-count and IBAN inputs (IBAN is validated server-side with ^SA\d{22}$, which rejects Arabic-Indic digits but corrupts nothing); PWA offline-client clock or lease handling (outside this area).

</details>

<details><summary>gap-stored-xss-token-theft</summary>

Read in full: packages/app-shared/src/lib/html-escape.ts, apps/mfe-evaluator/src/lib/evaluator/html-escape.ts, packages/auth-client/src/session.ts, valuation-report-approved-render.ts, valuation-report-v3-preview.ts, valuation-report-live-fill-dom.ts (lines 1-1120), valuation-report-preview.ts, valuation-report-print-assets.ts, part of valuation-report-comparables-map.ts (SVG and maps bootstrap), EvaluatorValuationReportOutputTab.tsx, CaseStudyReportFrame.tsx, case-study-report-render.ts, case-study-report-paginate.ts, internal-delegation-letter-html.ts, site-location-ack-letter-html.ts, official-letter-layout.ts, org-letterhead-slices.ts (relevant functions), property-photos-pdf.ts, part of property-detail-documents.ts, both open-html-document.ts files, OperationsTasksViewShared.tsx:115-132 (the icon map is static, so safe), PropertyMapCanvasGoogle.tsx and PropertyMapCanvas.tsx (titles escaped, icons static), BrandIdentityA4Preview.tsx and brand-test-page.ts (escaped, admin-only), shell layout.tsx (static inline script only), shell next.config.ts, ValuationReportPdfService.cs, GotenbergHtmlPdfRenderer.cs, ValuationReportPdfController.cs, OrganizationBrandingRules.cs, PlatformPermissionCatalog.cs, AttachmentUploadRules.cs, AttachmentService.GetContentAsync, DocumentPreviewHost.tsx, download-document-file.ts, open-data-url.ts, task-attachments-api.ts (preview), party-billing-statements-api.ts (open), export-csv.ts, AuditLogView.tsx, AuditLogAppendController.cs, and infra/docker-compose.prod.yml.

Verified safe as built: the v3 screen report and live fill write party text (owner, boundaries, notes, specialist wording, staff-edited descriptions, finishing text) through textContent or escHtml and serialize via outerHTML, so there is no party-to-sink XSS chain in the evaluator report. Admin report texts (IVS, glossary, terms and similar) are written with textContent, not raw HTML. Case-study report fields are all escaped. Attachments: the server sniffs file content and serves only JPEG, PNG, GIF, WebP or PDF, so an HTML or SVG upload cannot become a same-origin blob. The upstream-dispatch header is stripped at the gateway.

CSV: exportRowsToCsv has no formula neutralization and does not quote a lone \r, but its only caller is the audit-log export (manage-system-config), whose cells are system IDs and a details column that starts with '{'. There is no finance or party CSV/Excel export anywhere in the repo, so the premise that finance opens party text in Excel does not apply to current code. It will need to be fixed before any party-text export is added.

Gotenberg: I stopped short of analysing which schemes and network paths get past the deny list or what they could reach. That work was cut off, and the finding above covers only the authorization and integrity issue plus the general fix (disable JS, isolate the network, or remove the unused route).

Not reviewed: apps/shell/public/ejadah/support.js and doc-page.js internals (only image-slot.js was spot-checked, static markup), packages/offline-client storage of the offline lease credentials, the service worker (sw.js), notification rendering, the mfe-engineering-office, survey and keys MFEs, and the backend SecurityHeadersMiddleware body (I only confirmed via grep that the API CSP is default-src 'none', which does not protect the shell origin).

</details>

<details><summary>gap-offline-device-photo-atrest</summary>

I read the following in full: packages/app-shared/src/media/{process-evidence-photo.ts, photo-location.ts, file-encoding.ts}; apps/mfe-case-study/src/lib/app-data/{inspector-photo-upload.ts, inspector-photo-stamp.ts, inspector-photo-drop.ts, process-evidence-photo.ts, assignment-doc-attachments.ts}; InspectorPhotoFilePicker.tsx; packages/offline-client/src/{crypto.ts, store.ts, sync.ts, repository.ts, types.ts, page-cache.ts, lease.ts, index.ts}; packages/app-shared/src/auth/{offline-session.ts, ensure-fresh-session.ts}; offline/{offline-write.ts, offline-access-cache.ts, install-offline-write-interceptor.ts}; hooks/useAuth.ts; apps/shell/public/sw.js; FieldOfflinePrefetch.tsx; AuthSessionWatcher.tsx; useAppShellLogout.ts; lib/offline-sync-replay.ts; next.config.ts (CSP); infra/nginx.conf; docker-compose.prod.yml (ports); AttachmentUploadRules.cs; AttachmentService.cs:120-164; AuthSessionService.cs refresh logic; keys-envelope-api.ts:300-410; spec §3–§5.

Answers to the questions that did not become findings:
- A1. Yes, both chunks are warmed. In the local production build (BUILD_ID Mmqr1ENONNSN-QMukgYgI, 2026-09-26 12:45), loader chunk 2090z3h46sfnk.js lists "static/chunks/0j1_alec_b1ro.js" (heic2any, 1.35 MB) and "static/chunks/2e_76qqv6ix67.js" (exifr) as quoted strings. sw.js:205 follows those strings, and the loader is in the active-inspection client manifest, so both chunks are cached once /active-inspection/<id> is warmed. heic2any starts its worker from a blob: URL, which the CSP allows (worker-src 'self' blob:). If exifr ever fails to load, the failure is silent (the catch returns {}).
- A2. Android Chrome cannot decode HEIC natively; heic2any handles it in JS. The iOS side is covered in findings 1 and 4.
- A3. The server does not reject a photo over 1 MB: its image cap is 8 MB. The refusal is on the client (finding 5).
- A4. The JPEG path is fine because it only uses a 1600-px canvas. The HEIC path is the problem (finding 4).
- A5. Orientation is correct: current Chrome and Safari apply EXIF orientation when an <img> is drawn to a canvas, and the output has no EXIF, so nothing is rotated twice.
- A6. exifr reads DateTimeOriginal in the device's local time zone and toISOString converts it. This is correct whenever the device time zone matches the capture time zone. OffsetTimeOriginal is not picked. Not reported.
- A7. The stamp is applied after resizing and has no district line, as §5.3 requires. The deed, coordinates and time problems are findings 1, 6 and 11.
- A8. Property documents and key-envelope receipt/letter documents are uploaded without compression. Keys-proof images («إثبات استلام المفتاح») do go through the compression pipeline (assignment-doc-attachments.ts:254-287), which conflicts with §5.2. I did not list it because it is a desktop path. Raw HEIC documents from Android are rejected by the server (HEIC is not in the allow-list), and upload replay treats validation errors as retryable, so such an item stays «failed» forever. Rare in practice.
- B1. Production is https only: nginx redirects 80→443 with HSTS and is the only published port. The software-crypto path therefore cannot run in production, but see finding 7.
- B2. The outbox stores no URLs or headers, only typed payloads. The service-worker pages cache holds only client-rendered shell HTML with no business data ((app)/layout.tsx is "use client").
- B3. The GCM IV is 12 random bytes per encryption (crypto.ts:78), so it is effectively unique.
- B4/B5. Covered in findings 3, 7 and 10. Lease expiry locks the app but does not wipe data, which matches §3.3.

Not covered: server-side PhotoLocationRules internals, report and PDF rendering of stamped photos, the internals of the mfe-keys UI and InspectorDefinedPhotoTiles, and heic2any's asm.js memory-growth behaviour. I could not test on devices, so the iOS and Android points (GPS stripping on capture and library picks, HEIC hand-over when the accept list names .heic, the 16.7 MP canvas limit) rest on platform behaviour and not a device run. The trial should confirm them. Trial note: on iOS the home-screen app has separate storage from a Safari tab, so the prefetch has to happen inside the installed app.

</details>

<details><summary>gap-unread-ui-modules</summary>

I read these fully: infath-upload-model.ts, infath-upload-types.ts, infath-field-labels.ts, PropertyDetailUploadAssistant.tsx / Panels.tsx / Rows.tsx, usePropertyDetailUploadAssistantWorkflow.ts, property-detail-upload-assistant-state.ts, and SystemUploadView.tsx. To trace the Infath fields to their source I also read property-detail-documents.ts, property-detail-documents-query.ts, the party-submission builders (buildFromEvaluator, buildFromFieldInspection, buildFromEngineeringSurvey) and the evaluator's finalize, value and report-fill code.

I read all of apps/mfe-valuation except the two styling-only files (ComparablesOpsIcon.tsx, comparables-ops-tw.ts): ComparablePropertiesView, AddComparableForm, TagEditorRow, comparable-properties-state, ValuationRequestsView, valuation-api, valuation-request-property, and query/*. I also read packages/app-shared/src/app-data/comparable-entry.ts fully, plus ComparablePropertyEntryFields.tsx lines 90-330 and 470-530.

Fees, read fully: PartyOfficeBillingStatementsPanel, VendorInvoicePdfField, useEngFeesWorkflow, eng-fees-state, PartyFeesWorkspace, SupervisorEnfazTracking, SupervisorEngSurveyFeeAcceptPanel, CourtVisitFeesPanel, usePartyIndividualFeesWorkflow, KeyEnvelopeFeesPanelSlot. Read partly: party-individual-fees-state (lines 200-385) and EngFeesInvoiceModal (lines 120-285). Checked only by grep: EngFeesHtmlScreen, EngFeesLedgerSection, EngOfficeFeesBillingTable, PartyFeeWorkflowTable, PartyIndividualFeesHtmlScreen (plus its key-fees tab), EngFeesStatementsSection and EngFeesHtmlTabs.

Other screens: I read DistributionTaskWork, useMyTaskWorkCommands, usePoListWorkflow, useQueuePartyProgress, TaskCompletionSuccess and PartyRecallAdvisorySection fully; RedistributePartiesModal lines 1-230; useMyTaskWorkWorkflow lines 100-280; and only the top of ActiveTransactionsSituationBar. I did not read DistributionPartiesForm, ActiveTransactionPageLayout or EngineeringPartyNotesSection.

Backend was read only to confirm client-visible behaviour: party-billing controller authz, attachment upload rules, the comparable validator, the valuation-request service and caps, the court-visit fee close, key-envelope fee report scoping, and role capabilities.

Lower-priority items noticed but not reported, to stay within 12:
(a) ValuationRequestsView's appraiser actions («رفع التقرير» / «تعذّر», lines 411-432) are unreachable, because real-estate-appraiser lacks the valuation-requests page. That path also hides the problems below: the impediment reason is validated but never stored (ValuationRequestService.cs:156-177; RecordImpediment takes no reason), and valuation-api.ts:42 collapses the 400 issuance_blocked reasons into «حاول لاحقاً».
(b) The reviewer's «أتعاب استلام المفاتيح» tab and count (usePartyIndividualFeesWorkflow.ts:72-82, PartyIndividualFeesHtmlScreen.tsx:569-577) show the company-wide, unscoped key-envelope fee report, not the reviewer's own fees.
(c) DistributionTaskWork.tsx:183 and useMyTaskWorkCommands.ts:448 ignore a null result from patchTaskDistribution, so a failed draft save is silent.
(d) The Infath «تاریخ المعاينة» falls back to the court-visit task's updatedAt (courtVisitOpsFields), which is not an inspection date. This is listed as an open question in INFAZ_UPLOAD_UNRESOLVED_POINTS.
(e) Duplicate comparables: there is no pre-save dedupe, but spec Q-3/2 says suspicion only (the server flags identical coordinates), so this is not reported as a bug.

I found no new outbox or offline-queue use by non-field roles in these modules.

</details>

<details><summary>gap-migrations-drift-ops-scripts</summary>

What I read in full:
- backend/tools/DbMigrate/Program.cs and its Dockerfile.
- BoundedContextMigrations.cs, BoundedContextConnections.cs, PostgresDatabaseProvisioner.cs, AddBoundedContextPersistence.
- DevSeed DataSeeder.cs and DevSeedProvider.cs, and ComparableBankSeed.cs.
- The case-study ServiceModule migrate/seed path.
- .github/workflows/deploy.yml and infra/docker-compose.prod.yml (migrate, identity, case-study, attachments, volumes).
- Every file in infra/postgres, plus scripts/ops/rotate-jwt-signing-key.sh and verify-prod-db-ownership.sql.
- backend/scripts: delete-all-pos.sql, reseed-ahmed.mjs, reseed-all-users.mjs, reseed-ahmed-tool (Program.cs and csproj), and dev-api.mjs (migrate part).
- docs/ops/jwt-signing-key-rotation.md, MigrationStreamTests, EfModelBoundaryTests, and the container DatabaseMigrationTests and BoundedContextStreamMigrator.

Migrations read in full:
- Operations: all non-Designer migrations except 20260906053908_StatusIndexPruning, which I read for the Down only.
- Financial: EnsureFinancialTablesForStandalone, SyncFinancialAuditLog, FinancialForeignKeysAndChecks, UpdatedAtAndIdLengths (first half), and the D1 relocation.
- Attachments: DropInlineAttachmentContent, DropPropertyDocumentReview, DropAttachmentReportClassification, and PropertyDocumentGovernance (Up).
- Case Study: RetireOpenGovernmentReviewWorkflow, UpdatedAtLengthsAndJsonb, PromoteSpecialistReportExtrasColumns, CaseStudyForeignKeysAndChecks (data-fix part), AddInspectedPropertyType, and the three provenance migrations.
- Valuation: PropertyIdAsUuidJsonbAndChecks (part), the outbox DDL in EnsureValuation, and WidenComparableAdvertiserPhone.
- Failures: PropertyIdAsUuidAndStatusChecks. Identity: DropIdentityAuditMappingAndJsonbCoverage. Messaging: OutboxIndexPruning.

Snapshots were read for the operations, financial and valuation outbox parts, plus the CHECK lists across all snapshots.

Answers to the specific questions:
- **Stream order** (Attachments→Platform→Valuation→Identity→Failures→Operations→Financial→CaseStudy→Messaging): each stream is its own database, so the order only matters for partial failure (finding 3).
- **Transactions:** the Npgsql 10.0.1 provider carries `LOCK TABLE <history> IN ACCESS EXCLUSIVE MODE`. EF 10 applies all pending migrations of a stream in one locked transaction, so a failed stream rolls back entirely, but earlier streams stay committed. No migration uses CONCURRENTLY or suppressTransaction.
- **Concurrency:** the deploy job concurrency group and the EF history lock prevent two migrators colliding on a stream. DataSeeder has no lock, and it runs twice per deploy (`run` plus `up`) and again on rollback.
- **D1/D2 raw SQL:** correct and guarded by to_regclass, and the Downs are symmetric. It is safe in the per-database topology.
- **Drift at HEAD:** none found. I used git history of entity/model/shared-constant files after each context's snapshot commit and compared CHECK value lists against the constants. The uncommitted tree has no backend changes. I did not run HasPendingModelChanges because builds were not allowed.
- **Destructive migrations** (the uuid casts delete non-uuid rows, including cascades; the D1 orphan batch links are nulled): all already applied in production (deploys through 0b8736e7 succeeded), so no pending data loss. Whatever those DELETEs removed on 09-05/06 was not logged and cannot be recovered.
- **Disaster recovery:** each stream's Ensure baseline creates its own D1/D2, outbox and audit copies. I found no cross-database dependency, so a fresh per-database build looks feasible. It is untested, though (see finding 4), and a fresh build would be seeded with demo data (findings 1 and 2). init-prod.sql and DbMigrate's CREATE DATABASE are fine.
- **Scripts:** delete-all-pos.sql is stale. It spans seven databases in one transaction and aborts harmlessly under the per-database layout. The reseed tools default to Identity.Api appsettings.Development.json (localhost:5433), but REAL_ESTATE_EVAL_PG_CONNECTION_STRING_IDENTITY in the shell overrides it.
- **JWT rotation:** keeps the previous key for validation. Refresh tokens are opaque database rows, so rotation does not sign users out or break the 3-hour offline lease; only the emergency refresh-token revoke forces re-login, and unsynced data is kept. No defect found.

Also noted, not reported as findings:
- Financial writes audit rows to its own excluded-from-migrations audit.AuditLogs, which has no immutability trigger.
- The valuation database outbox is likewise excluded from migrations. Both are latent traps if the shared entity changes.

Not covered:
- The remaining ~25 additive valuation migrations, platform/identity/attachments/case-study Ensure baselines line by line, Designer files, and platform catalog data migrations.
- The attachment-blobs path-sanitisation. That path is moot now: the Content column is already dropped in production, and the container runs as non-root.

</details>

