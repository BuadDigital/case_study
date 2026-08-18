# Architecture split — status

Honest running status of [`docs/architecture-split-plan.md`](../architecture-split-plan.md).
Update this file with every slice; do not summarise a partial slice as a finished phase.

**2026-08-18 (resolved):** the Case Study Development host DI boot blocker is fixed — single public constructors, `AddDevelopmentSystemMaintenance` removed, `ValuationReportWorkflowHandler` on `CaseStudyDbContext`; `/ready` verified 200. Residual: Dev system reset returns 501 pending a per-owner design. Details: [`docs/remaining-work.md`](../remaining-work.md) § Pickup.

## Where the split is (2026-08-18)

| Phase | State | Evidence |
| --- | --- | --- |
| 0 — freeze and measure | Ownership gate **closed**. | [`table-ownership.json`](../architecture/table-ownership.json) |
| 1 — split EF contexts | **Done (A6).** Hosts no longer call `AddPersistence`. | [`backend/plan/A6_CLOSEOUT.md`](../../backend/plan/A6_CLOSEOUT.md) |
| 2 — split libraries | **Failures + Attachments + Valuation slices done 2026-08-18.** `backend/contexts/failures/RealEstateEval.Failures.{Domain,Application,Infrastructure}` with context-local DI and host-registered validators; DbContext+migrations stay global pending migration-catalog decomposition; namespaces unchanged until global projects retire. | `docs/remaining-work.md` A8 row |
| 3 — remove cross-schema access | **Done (A9, 2026-08-18).** Every cross-boundary reader/writer is on owner HTTP APIs; no host outside Case Study opens `CaseStudyDbContext`; D10 Identity reads closed. The only remaining foreign contexts are the messaging outboxes — D5 by design. Migrator owner + D6 consumer inventory recorded; p95/connection/outbox metrics capture is Phase 5 evidence. | `docs/remaining-work.md` A9 row |
| 4 — split databases | **Owner databases only.** No leftover shared Postgres. Residual readers still open owner contexts over a second connection. | `BoundedContextConnections`, `infra/postgres/init-*.sql` |
| 5 — remove shims | **Runtime shims removed 2026-08-18.** No runtime composition registers `ApplicationDbContext`: seeder ported to owner contexts, maintenance provider bounded-context-only, Messaging fallbacks collapsed, dead reset service deleted, `AddPersistence`/`AddLegacyApplicationPersistence` deleted. Remaining: retire the idle leftover database and archive the frozen legacy stream (blocked on the metrics gate + backup decision). | `docs/remaining-work.md` A10 row |

## What Phase 3 lookup residuals changed

- Shared `UpstreamServices` + authenticated JSON helper. Hosts forward the inbound `Authorization` header.
- **Attachments** — `IAttachmentLookup`. Case Study / Operations / Valuation no longer open `AttachmentsDbContext`.
- **Platform catalogs** — print dictionary and organization settings via Platform HTTP. Attachments, Valuation, and Case Study no longer open `PlatformDbContext`.
- **Valuation dispatch** — Case Study creates/opens valuation requests via `POST/GET /api/valuation-request-dispatch` (`[Authorize]` only). Case Study no longer opens `ValuationDbContext`.
- **Identity directory** — labels, compensation, assignee→user maps via `/api/identity/*`. Operations, Financial, Failures, Platform, and Case Study (all environments, since 2026-08-18) no longer open `IdentityDbContext`. Dev seed uses the throwaway `CreateIdentityMaintenanceProvider` only.
- **Workflow assignees** — Platform notification recipients call Case Study `GET /api/workflow-assignees`. Platform no longer opens `CaseStudyDbContext` or `IdentityDbContext`.
- **Platform audit append** — `IAuditLogAppend` / `POST /api/audit-log/append`. Identity, Case Study (property groups, inspection limits), and Valuation (reconciliation overrides) no longer open `PlatformDbContext` to write the ledger. Identity seed/reset still uses Platform EF on the throwaway maintenance provider.
- **Failures commands and gates** — `IFailureLookup` / `IFailureService` via `/api/failure-dispatch` (`[Authorize]` only for system holds and documentary side-effects) and `/api/failures` for the operator queue. Case Study and Operations no longer open `FailuresDbContext`.
- **Failure side effects on Case Study (2026-08-18)** — Failures no longer opens `CaseStudyDbContext`. Reads use `AddRemoteCaseStudy` (`ICaseStudyLookup`, incl. the new `GET /api/case-study-dispatch/po-numbers-by-assignee` visibility filter) and the workflow/deed/timeline patches moved server-side onto `ICaseStudyFailureCommands`: `POST /api/case-study-dispatch/properties/deed-status`, `case-study-tasks/{escalate-obstruction, resolve-obstruction (resets bourse when resuming there), block-for-approved-failure, block-for-hold, unblock-for-hold}`, and `property-timeline/record` (idempotent). Hold block/unblock returns `{TaskId, AssigneeId}` so the Failures host still sends the specialist notification through its own Messaging outbox. The legacy flow was already non-atomic across the two contexts (Failures commit first, CS side effects after), so nothing transactional was lost. No compose `depends_on` case-study (Case Study already `depends_on` failures); no hosted services on Failures, so every call forwards the inbound bearer.
- **Operations tasks, keys, and envelopes** — Case Study uses Operations HTTP (`IOperationsTaskService`, `IKeyEntitlementLookup`, `IPropertyKeyGateResolver`). Operator queue is `/api/operations-tasks` (existing policies). CS billing/gates use `/api/key-envelope-dispatch` (`[Authorize]` only). Case Study no longer opens `OperationsDbContext`.
- **Case Study dispatch** — Operations and Financial call `GET/POST /api/case-study-dispatch` (`[Authorize]` only) via `ICaseStudyLookup` / `ICaseStudyCommands` (`AddRemoteCaseStudy` plus Financial-only `HttpCaseStudyCommands`). Those hosts no longer open `CaseStudyDbContext` and do **not** `depends_on` case-study (Case Study already `depends_on` operations and financial). D4 document-reference allocation and survey-area backfill are Case Study commands.
- **Valuation property context (2026-08-18)** — Valuation's entire Case Study read surface (report fill, issuance gates, approach settings, reconciliation gate, comparables coords, prior-valuation feed, PO lookup) collapsed into one call: `GET /api/case-study-dispatch/valuation-property-context/{propertyId}` → `CaseStudyValuationPropertyContextDto` (property aggregate + inventory lines + latest inspection workspace + inspector payload + deed↔nature outcome + client names; `ToProperty()`/`ToWorkspace()` materialize domain objects for report fill). `RemotePropertyPoNumberLookup` overrides the EF PO lookup on the Valuation host. Valuation no longer opens `CaseStudyDbContext` and does **not** `depends_on` case-study (Case Study already `depends_on` valuation). All access was read-only — no command channel needed.
- **Financial dispatch** — Case Study and Operations call `/api/financial-dispatch` (`[Authorize]` only) via `AddRemoteFinancial`. Those hosts no longer open `FinancialDbContext`. Fee writes live on the Financial host, which calls Case Study HTTP for workflow/property lookups and D4 counters (no compose `depends_on` case-study).

Write residuals that still open a second owner connection (all Messaging, D5 by design):

- Case Study: Messaging.
- Operations: Messaging.
- Failures: Messaging.

(2026-08-18: the former Valuation and Failures Case Study residuals are gone — see the Phase 3 bullets above.)

## What Phase 4 Attachments changed

- Postgres init creates `realestate_eval_attachments` (dev) / `realestate_eval_prod_attachments` (prod), plus empty placeholder databases for later owners.
- `AddAttachmentsPersistence` prefers `REAL_ESTATE_EVAL_PG_CONNECTION_STRING_ATTACHMENTS` / `ConnectionStrings:Attachments`.
- `DbMigrate` applies the Attachments stream to that database and `CREATE DATABASE` if the volume already existed.
- `EnsureFileAttachmentsForStandalone` materializes `FileAttachments` with `IF NOT EXISTS` so a dedicated database (no legacy stream) still builds.
- Residual Case Study / Operations / Valuation **request paths** call the Attachments HTTP API (`IAttachmentLookup`). Those hosts no longer open `AttachmentsDbContext`. Development seed/reset (`DataSeeder` / `SystemMaintenanceService`) may still count attachments through the transitional god context.
- Identity and Platform now use dedicated databases (`realestate_eval_identity` / `realestate_eval_platform`). Identity audit rows are written through `PlatformDbContext` so the append-only ledger stays on Platform.
- Valuation now uses a dedicated database (`realestate_eval_valuation`). Case Study still writes valuation requests through `ValuationDbContext` on a second connection. Valuation hosts its own outbox dispatcher so those rows are not stranded on the new database.
- Failures now uses a dedicated database (`realestate_eval_failures`). Case Study and Operations call the Failures HTTP API for gates, timelines, and access holds; they no longer open `FailuresDbContext`. Failures schema migrations are applied by DbMigrate (not Case Study startup).
- Operations now uses a dedicated database (`realestate_eval_operations`), including D2 `case_study.OperationsTasks` / `OperationsTaskSequences` which `OperationsDbContext` maps. Copy those task tables with the operations schema.
- Financial now uses a dedicated database (`realestate_eval_financial`), including D1 inspector-fee tables still physically named in `case_study`. Fee/enfaz audit rows written through `FinancialDbContext` land on that database's `audit.AuditLogs` (the Platform ledger stays on Platform).
- Case Study now uses a dedicated database (`realestate_eval_case_study`) for Case Study–owned tables only. Residual readers (Failures, Valuation) still open `CaseStudyDbContext` on a second connection. Operations and Financial call Case Study HTTP.
- Messaging now uses a dedicated database (`realestate_eval_messaging`). Case Study drains that outbox; Platform / Failures / Operations write notification and inbox rows there. Valuation still drains `valuation.%` outbox rows from the valuation database. Copy messaging **after** Valuation so those rows are not double-published.
- One-time row copy: `infra/postgres/copy-*-data.sh` for each owner (if leftover still has rows). Copy Case Study **after** Operations and Financial so D1/D2 rows are already claimed by those owners; the Case Study script excludes those tables. Then drop leftover databases with `infra/postgres/drop-leftover-shared.sh`. There is no shared-database fallback.

## What extraction step 5 changed

- `MessagingDbContext` maps outbox / inbox / `UserNotifications` / push tables for the messaging
  migration stream (`messaging.__EFMigrationsHistory`) with an empty baseline.
- Platform: `AddMessagingPersistence` + `MessagingOutboxPublisher` (notif + outbox one UoW);
  `NotificationService` / `PushSubscriptionService` / web-push delivery use Messaging only;
  Platform `IIntegrationEventInbox` resolved onto Messaging.
- Valuation still maps its own outbox (D5). After the Phase 4 valuation cutover, Valuation
  drains that table from `ValuationDbContext` on the dedicated database; Case Study continues
  to drain the dedicated messaging outbox via `MessagingDbContext`.
- Catalog / architecture: Messaging extracted; owning-service guard covers notification + push
  services (no `ApplicationDbContext`).

## What extraction step 2 changed

- `IdentityDbContext` maps the eleven `identity` tables (ASP.NET Identity stores plus profiles
  and refresh tokens). Empty baseline migration + `identity.__EFMigrationsHistory`.
- `AddEntityFrameworkStores<IdentityDbContext>()` — Identity is the only writer of those tables
  through UserManager / AuthSession / UserRegistration / database `PermissionService`.
- Non-Identity APIs register `AddClaimsPermissionService()` and resolve actor permissions from
  JWT claims (`capability`, `role`, `prototypeRole`, `distributionAssigneeId`, `page`) instead
  of opening Identity stores.
- Access tokens now carry prototype role, distribution assignee id, and pages so claim-based
  permission resolution matches the previous database-backed shape for the signed-in caller.
- Case Study demo seeding builds a short-lived Identity seed scope (`AddIdentitySeedStores`) so
  request paths stay claims-only while Development can still seed users.
- Legacy `ApplicationDbContext` still inherits Identity's store context and applies
  `ApplyIdentityModel` so transitional cross-boundary Identity *reads* keep compiling until
  Phase 3 replaces them.

## What extraction step 1 changed

- Three write contexts — `AttachmentsDbContext`, `PlatformDbContext`, `ValuationDbContext`.
- Eight services resolve their owner's context; Valuation outbox is per-producer (D5).
- Deploy migrator applies legacy first, then context streams in
  `BoundedContextMigrations.ApplyOrder` (now including Identity).

## Runtime (dedicated databases)

Every extracted owner has its own Postgres database. Hosts and residual readers require
`REAL_ESTATE_EVAL_PG_CONNECTION_STRING_{SERVICE}` / `ConnectionStrings:{Service}` — there is no
leftover shared database and no fallback. Residual readers still open owner contexts over a
second dedicated connection until Phase 3 replaces those reads with owner APIs.

Drop leftover `realestate_eval_dev` / `realestate_eval_prod` after copy with
`infra/postgres/drop-leftover-shared.sh`. Existing Docker volumes keep those databases until
that script (or `down -v`) runs.

## What extraction step 3 changed

- `FailuresDbContext` / `OperationsDbContext` + empty baseline migration streams (`failures` /
  `operations` history schemas). Ops tasks still live physically in `case_study`; ownership is
  Operations. Idempotent follow-up: key-envelope revenue entitlement on Operations.
- Writers use own context (or dual App + owned for financial / case-study cross-writes).
- Hosts: Failures API owns `FailuresDbContext`. Case Study and Operations call Failures HTTP for gates and access holds.

## What extraction step 4 changed

- `FinancialDbContext` / `CaseStudyDbContext` + empty baselines (`financial` / `case_study`
  history schemas). D1 inspector-fee tables stay physically in `case_study` mapped by Financial;
  D2 ops tasks stay on Operations (not Case Study).
- Legacy cutover advanced to `20260802093148_SyncLocationCatalogModelOnLegacy` so post-cutover
  fee/pricing migrations already applied on the legacy stream stay valid after extraction.
- Hosts register `AddFinancialPersistence` / `AddCaseStudyPersistence` (Case Study + Failures +
  Valuation API + DbMigrate). Financial no longer registers Case Study persistence.
- **Residual:** most Financial/Case Study business writers still inject `ApplicationDbContext`
  (dual transitional path). Pure service rewire is a follow-up; ownership catalog write contexts
  already name the extracted DbContexts.

## Verification (2026-08-03, step 5)

| Check | Result |
| --- | --- |
| `RealEstateEval.Architecture.Tests` | **Passed** — 39/39. |
| `RealEstateEval.Application.Tests` | **Passed** — 536/536. |
| ADR 0006 against a restored production-like database | **Done (2026-08-18).** Idle leftover `realestate_eval_dev` on host Postgres 17.9 `:5432` (no `ServiceModule` uses `DefaultConnection` / leftover shared CS; compose apps use dedicated `realestate_eval_*` on Docker `:5433`). `CREATE DATABASE realestate_eval_a7_scratch WITH TEMPLATE realestate_eval_dev`, then `dotnet run --project backend/tools/DbMigrate -- update` with `REAL_ESTATE_EVAL_PG_CONNECTION_STRING` plus all nine dedicated env vars pointed at the scratch copy. Legacy applied 67 pending migrations including `20260729104156_AddOptimisticConcurrencyTokens`; then all nine context streams. `xmin` is DDL-neutral (0 user `xmin` columns; system `xmin` readable on preserved rows: 15 users / 1 work order / 25 workflow tasks). Source leftover left at 30 history rows, idle. Operations leftover gap fixed: `EnsureOperationsTablesForStandalone` now `ADD COLUMN IF NOT EXISTS "RevenueEntitlementAtUtc"` before indexing, because leftover `KeyEnvelopes` predates the column and the legacy dual-write was moved off that stream. |

## Gates before Phase 1 exit (A6) / Phase 2

| Gate | Owner | Why |
| --- | --- | --- |
| Drop or minimize legacy `AddPersistence` write registration (A6) | API owners | **Partial** — pure hosts include financial + operations + **failures**; residual dual-write: **case-study** only |
| Nominate a service owner per API and a deploy-migrator owner | engineering management | Formal sign-off |
| Validate ADR 0006's deploy path against a restored production-like database | migrator owner | **Met (2026-08-18)** — leftover `realestate_eval_dev` copy, not a Hetzner dump. See Verification. |
| Inventory production-only SQL/BI consumers (D6) | operations / data platform | Phase 3/4 |
| Capture production metrics baseline | operations | Comparison baseline |
| Measure pooled-connection counts with multiple contexts | operations | Connection-growth risk |
| Replace remaining Identity *reads* on ApplicationDbContext (fees, notifications, labels) | Phase 3 | Still cross-boundary LINQ |
