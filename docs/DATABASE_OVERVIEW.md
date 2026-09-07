# Database overview (PostgreSQL)

**Audience:** Project managers, stakeholders, and new developers
**Project:** Ejada Internal — Real Estate Evaluation & Case Study Platform
**Last updated:** 2026-09-06 (rewritten from code; supersedes the "12 tables in `public`" version)

Every statement below was taken from a file in the repository; the file is named inline so it can be re-checked when the code moves.

---

## Executive summary

The platform runs on **PostgreSQL 17** (`infra/docker-compose.yml`: `postgres:17.5-alpine`) with **nine dedicated databases on one server** — one per bounded context plus one for messaging. There is no shared database and no fallback to one: each context's `DbContext` resolves its own connection string and throws if it is missing (`backend/RealEstateEval.Infrastructure/Data/BoundedContextConnections.cs`, `Resolve`). Each database carries the schema(s) its owner may write, its own EF migration stream, and its own `__EFMigrationsHistory` table inside that schema (`backend/RealEstateEval.Infrastructure/Data/Contexts/BoundedContextMigrations.cs`). The legacy shared context (`ApplicationDbContext`) is gone; the architecture tests fail if anything mentions it again (`backend/RealEstateEval.Architecture.Tests/SchemaAccessBoundaryTests.cs`, `LegacyContextIsNotUsedAnywhere`). User accounts, work orders, properties, valuation, keys, failures, billing, notifications, and attachments all live in these databases — nothing is mock data any more.

| Database (dev name) | Schema(s) it holds | DbContext / owning service | Server / port |
|---|---|---|---|
| `realestate_eval_attachments` | `attachments` | `AttachmentsDbContext` — Attachments API | `ree-postgres`, host `127.0.0.1:5433` → container `5432` |
| `realestate_eval_platform` | `platform`, `audit` (migration owner of `audit.AuditLogs`) | `PlatformDbContext` — Platform API | same |
| `realestate_eval_valuation` | `valuation`, `messaging.OutboxMessages` (mapped, not migrated) | `ValuationDbContext` — Valuation API | same |
| `realestate_eval_identity` | `identity` | `IdentityDbContext` — Identity API | same |
| `realestate_eval_failures` | `failures` | `FailuresDbContext` — Failures API | same |
| `realestate_eval_operations` | `operations`, plus `case_study.OperationsTasks` (D2) | `OperationsDbContext` — Operations API | same |
| `realestate_eval_financial` | `financial`, plus `case_study.InspectorFee*` / `DisbursementBatches` (D1), `audit.AuditLogs` (created by its standalone baseline) | `FinancialDbContext` — Financial API | same |
| `realestate_eval_case_study` | `case_study` | `CaseStudyDbContext` — Case Study API | same |
| `realestate_eval_messaging` | `messaging` | `MessagingDbContext` — Platform write path; Case Study runs the outbox dispatcher | same |

Sources: database names `infra/postgres/init-dev.sql`; schema constants `backend/RealEstateEval.Infrastructure/Data/DatabaseSchemas.cs`; which model each context applies `backend/contexts/<ctx>/RealEstateEval.<Ctx>.Infrastructure/Data/<Ctx>DbContext.cs`; production names are `realestate_eval_prod_*` (`infra/docker-compose.prod.yml`, `migrate` service). The Reporting API registers no persistence at all (`SchemaAccessBoundaryTests.ReportingHasNoDirectDatabaseAccess`).

---

## Connection (local development)

| Setting | Value | Source |
|---|---|---|
| Container | `ree-postgres` | `infra/docker-compose.yml` |
| Host / port | `127.0.0.1:5433` (5433 avoids a local install on 5432) | `infra/docker-compose.yml` |
| User / password | `postgres` / `Admin` | `infra/docker-compose.yml` |
| Databases | the nine `realestate_eval_*` names above, created on first boot | `infra/postgres/init-dev.sql` |
| Start infra | `npm run dev:infra` (postgres + rabbitmq + redis, waits for readiness) | `package.json`, `backend/scripts/dev-infra.mjs` |

Each service reads **one env var per database**: `REAL_ESTATE_EVAL_PG_CONNECTION_STRING_{ATTACHMENTS,PLATFORM,VALUATION,IDENTITY,FAILURES,OPERATIONS,FINANCIAL,CASESTUDY,MESSAGING}` or the equivalent `ConnectionStrings:{Service}` key (`BoundedContextConnections.EnvVarFor`). Example value from the compose `migrate` service: `Host=postgres;Port=5432;Database=realestate_eval_case_study;Username=postgres;Password=Admin` (`infra/docker-compose.yml`). Pool size, timeouts and list-paging caps come from the `Database` section (`backend/RealEstateEval.Infrastructure/Data/DatabaseOptions.cs`; defaults `MaxPoolSize=20`, `CommandTimeoutSeconds=30`, `UnpaginatedListCap=500`). If a connection string names a database that does not exist yet, `PostgresDatabaseProvisioner.EnsureExistsAsync` creates it (`backend/RealEstateEval.Infrastructure/Data/PostgresDatabaseProvisioner.cs`).

In Development the Case Study host may apply migrations on startup (`Database:MigrateOnStartup`, defaulting to `IsDevelopment()`; `backend/services/case-study/RealEstateEval.CaseStudy.Api/ServiceModule.cs`). It is the only host allowed to call `MigrateAsync` (`backend/RealEstateEval.Architecture.Tests/MigrationStreamTests.cs`, `OnlyCaseStudyAppliesMigrationsFromAHost`) and it throws if that flag is on in Production.

---

## Schema at a glance (per context)

Table names come from the model builders under `backend/contexts/<ctx>/RealEstateEval.<Ctx>.Infrastructure/Data/<Ctx>Model.cs` (messaging: `backend/RealEstateEval.Infrastructure/Data/Contexts/Messaging/MessagingModel.cs`). Columns are omitted on purpose.

### `identity` — `IdentityModel.cs`
ASP.NET Identity tables renamed to `Users`, `Roles`, `UserRoles`, `UserClaims`, `RoleClaims`, `UserLogins`, `UserTokens`; `UserProfiles` (one per user, FK cascade to `Users`, xmin row version, `ReferenceNumber` `US-…`); `HrEmployeeProfiles` and `ProcServiceProviderProfiles` (one-to-one with `UserProfiles`); `RefreshTokens` (FK to `Users`); `IdentityReferenceSequences`. `Users.PhoneNumber` is unique where not null — login is phone-based. The old `CrmClientProfiles` table is not in the model.

### `case_study` — `CaseStudyModel.cs`
`WorkOrders`, `Clients`, `WorkOrderProperties` (xmin row version; jsonb owners/extras/uninspected-units), `BuildingInventoryLines`, `PropertyGroups` / `PropertyGroupMembers`, `PropertyContacts`, `WorkflowTasks` (FK to property, cascades with it), `PartyTaskSubmissions`, `FieldInspectionWorkspaces`, `CaseStudyForms` (jsonb answers + provenance), `InternalDelegationLetterSets`, `NumberedDocuments`, `DocumentReferenceCounters` (D4), `PoIntakeDrafts`, `PropertyTimelineEntries`, `CaseStudyReferenceSequences` (prefixes `TX`/`LT`/`CS`).

### `operations` — `OperationsModel.cs`
`SurveyOffices`, `PropertyKeyRecords`, `KeyEnvelopes` → `KeyEnvelopeAssignments` / `KeyEnvelopeHandoffs` / `KeyEnvelopeTimelineEntries` (cascade), `PropertyCourtAccesses`, `OperationsReferenceSequences` (prefix `KE` and the task counter). **Also on this database, named in `case_study`:** `OperationsTasks` (D2) with jsonb deeds/letters/comments/reminders, a `jsonb_path_ops` GIN index and the trigram index described below. The stream enables the `pg_trgm` extension.

### `financial` — `FinancialModel.cs`
`PartyBillingStatements` → `PartyBillingStatementLines`, `PoEnfazInvoices`, `PoEnfazRevenueLines`, `PoEnfazFollowups`, `PoEnfazFinanceFlags`, `KeyReceiptFeeCharges`, `CourtVisitFeeCharges` (D2), `PartyFeePricingTables` → `PartyFeePricingTiers` / `PartyFeePricingAssignments`, `IncentiveSuspensions`, `DiscountFlags`, `FinancialReportConfigs`, `FinancialReferenceSequences` (prefix `DS`). **Also on this database, named in `case_study`:** `InspectorFeeLedgers`, `InspectorFeeTransitions`, `DisbursementBatches` (D1; batch → ledger link enforced because both sit on the same database). Maps `audit.AuditLogs` read/append-only (`FinancialDbContext.cs`, `ApplyAuditModel(ownsMigrations: false)`).

### `valuation` — `ValuationModel.cs`
`ValuationRequests` (xmin row version; unique `DisplayId` `VR-n` from sequence `valuation.ValuationRequestDisplayId` starting at 445; partial unique index "one open request per property"), `EvaluatorRecallRecords`, `ComparableProperties` (the comparable bank), `PropertyComparableLinks`, `ValuationComparableSelections` (xmin row version) → `ValuationComparableAdjustmentLines`, `ValuationAdjustmentFactorRationales`, `ValuationMarketApproaches`, `ValuationApproachSettings`, `ValuationCostApproaches` → `ValuationCostLines` / `ValuationIndirectCostItems`, `ValuationReconciliations` → `ValuationReconciliationMethodLines`, `ValuationReportIssuances` (one current copy per request via partial unique index). Every child FK to `ValuationRequests` cascades. The context also maps `messaging.OutboxMessages` (`ValuationDbContext.cs`).

### `platform` — `PlatformModel.cs`
Courts: `Courts` → `CourtCircuits`, `CourtAuditLogs`. Geography: `Regions` → `Cities` → `Districts` (status CHECK from `LocationCatalogStatuses.All`; merge links restrict). Configuration singletons with jsonb bodies: `FieldDictionaryConfigs`, `AttachmentPrintDictionaryConfigs`, `DifferenceFactorCatalogConfigs`, `CaseStudyInfoRolesConfigs`, `OrganizationSettings`, `ValuationReportTextPackages` (immutable, unique `Version`), `FieldSyncStatuses`. Owns the migrations of `audit.AuditLogs` (`PlatformDbContext.cs`, `ApplyAuditModel(ownsMigrations: true)`; schema relocation in `Data/Migrations/20260730110223_RelocateAuditLogToAuditSchema.cs`).

### `failures` — `FailuresModel.cs`
`PropertyFailures` (xmin row version; status/severity CHECKs; partial index on suspended rows), `FailureTypesCatalogConfigs` (jsonb).

### `attachments` — `AttachmentsModel.cs`
`FileAttachments` (metadata + `StorageKey`; bytes are in the blob store), `PhotoMetadata` (unique per photo, FK cascade).

### `messaging` — `MessagingModel.cs`
`OutboxMessages` (per-producer; partial index on the pending backlog), `ProcessedIntegrationEvents` (per-consumer inbox; PK `Consumer + EventId`), `CommandIdempotencyRecords` (ADR 0008 HTTP idempotency; `bytea` response), `UserNotifications` (unique unread-per-source-event), `PushSubscriptions`, `PushPreferences`.

### Who may touch which schema
`docs/architecture/boundary-baseline.json` (`apiSchemaAccess`) is the ceiling enforced by `SchemaAccessBoundaryTests`: attachments → `attachments`; identity → `identity`, `audit`; platform → `platform`, `audit`, `messaging`; valuation → `valuation`; failures → `failures`, `messaging`; operations → `operations`, `case_study`, `messaging`; financial → `financial`, `case_study`, `audit`, `messaging`; case-study → `case_study`, `messaging`; reporting → nothing. The `case_study` entries for financial/operations are the D1/D2 tables on their **own** databases, not reads of the Case Study database. The baseline records **no cross-schema foreign keys and no cross-schema navigations** (`crossSchemaForeignKeys: []`, `crossSchemaNavigations: []`). Ownership per table is catalogued in `docs/architecture/table-ownership.json` and read by `backend/RealEstateEval.Architecture.Tests/Support/TableOwnershipCatalog.cs`.

---

## Integrity and conventions (shipped 2026-09-05/06)

| Feature | What it does | Implemented in |
|---|---|---|
| Same-schema foreign keys | Child rows cascade or restrict with their aggregate (tasks with properties, envelope children with envelopes, valuation children with requests, batches ↔ ledgers, photo metadata with the file) | `*Model.cs` `HasOne/HasMany`; migrations `case-study/…/20260905121852_CaseStudyForeignKeysAndChecks.cs`, `financial/…/20260905121830_FinancialForeignKeysAndChecks.cs`, `attachments/…/20260906053921_PhotoMetadataForeignKey.cs` |
| `uuid` property / task ids | `PropertyId` and `TaskId` columns converted from text to `uuid` with `USING …::uuid` | `valuation/…/20260905121840_PropertyIdAsUuidJsonbAndChecks.cs`, `failures/…/20260905121812_PropertyIdAsUuidAndStatusChecks.cs` |
| CHECK constraints from constants | `HasAllowedValues(table, column, Xxx.All)` emits `CK_{table}_{column}`; `HasNonNegative` emits `CK_{table}_{column}_NonNegative`; SQL is generated from the same `All` lists the code writes, so they cannot drift | `backend/RealEstateEval.Infrastructure/Data/ModelCheckConstraints.cs`; hand-written ones on `UserProfiles` in `IdentityModel.cs` |
| All JSON columns are `jsonb` | Every `*Json` column is `HasColumnType("jsonb")`; compare stored text with `JsonTextEquality.SemanticallyEqual` because PostgreSQL normalises key order and whitespace | `*Model.cs`; `backend/RealEstateEval.Application/Rules/JsonTextEquality.cs` |
| xmin row versions | `UseOptimisticConcurrency()` maps a shadow `Version` property with `IsRowVersion()` to PostgreSQL's `xmin`; stale saves raise a concurrency exception (409). Applied to `WorkOrderProperties`, `ValuationComparableSelections`, `UserProfiles`, `ValuationRequests`, `PropertyFailures`, key/envelope, billing and ledger rows | `backend/RealEstateEval.Infrastructure/Data/ModelConventions.cs` |
| `UpdatedAtUtc` stamping | Entities implementing `ITrackUpdatedAt` get `UpdatedAtUtc` set on every insert/update by a `SaveChangesInterceptor` registered on every context pool | `backend/shared/RealEstateEval.Shared.Contracts/Domain/ITrackUpdatedAt.cs`, `backend/RealEstateEval.Infrastructure/Data/UpdatedAtStampingInterceptor.cs`, registered in `AddBoundedContextPersistence` (`backend/RealEstateEval.Infrastructure/DependencyInjection.cs`) |
| Partial indexes instead of status indexes | Only the rows a query actually scans are indexed: suspended failures, enabled-no-key court accesses, open court-visit charges, pending outbox, unread notifications, open valuation request per property | `FailuresModel.cs`, `OperationsModel.cs`, `FinancialModel.cs`, `MessagingModel.cs`, `ValuationModel.cs`; migrations `…_StatusIndexPruning.cs`, `…_OutboxIndexPruning.cs`, `…_SuspendedFailuresPartialIndex.cs` |
| Reference sequences | One `<Ctx>ReferenceSequences` table per owner schema; `ReferenceSequenceAllocator` does an atomic `INSERT … ON CONFLICT … RETURNING` per prefix+year; prefixes in `ReferenceNumbering` (`TX`, `US`, `LT`, `CS`, `DS`, `KE`, …). Operations task display ids `T-{year}-{seq:D4}` draw from `operations.OperationsReferenceSequences` | `backend/RealEstateEval.Infrastructure/Data/ReferenceSequenceModel.cs`, `ReferenceSequenceAllocator.cs`, `backend/shared/RealEstateEval.Shared.Contracts/Domain/ReferenceNumbering.cs`, `operations/…/20260905121820_TaskSequenceToReferenceSequencesAndChecks.cs` |
| Deed search on tasks | Stored generated column `DeedsText` = `"DeedsJson" #>> '{}'` with a `gin_trgm_ops` index (`IX_OperationsTasks_DeedsText_Trgm`) for `LIKE '%…%'`; a `jsonb_path_ops` GIN index answers exact `@>` matches | `OperationsModel.cs`, `operations/…/20260904093334_AddOperationsTaskDeedSearchIndex.cs` |
| Attachment bytes in blob store | `FileAttachments.Content` was dropped; rows point at `StorageKey`. The drop migration refuses to run while inline bytes remain — run `DbMigrate attachment-blobs` first | `attachments/…/20260906060608_DropInlineAttachmentContent.cs`, `backend/tools/DbMigrate/Program.cs` |
| Identity audit routed to Platform | Identity no longer maps `audit.AuditLogs`; it calls `IAuditLogAppend` → `HttpAuditLogAppend` → Platform's `AuditLogAppendController`, which writes through `PlatformAuditLogAppend` | `backend/RealEstateEval.Application/Abstractions/IAuditLogAppend.cs`, `backend/shared/RealEstateEval.Shared.RemoteClients/HttpAuditLogAppend.cs`, `identity/…/20260905121805_DropIdentityAuditMappingAndJsonbCoverage.cs` |
| Column widths | User-id columns share `ColumnLengths.UserId`; `…_IdColumnLengths.cs` migrations aligned every stream | `backend/RealEstateEval.Infrastructure/Data/ColumnLengths.cs` |

---

## Migrations and seeding

**Streams.** Nine streams, applied in the fixed order `Attachments → Platform → Valuation → Identity → Failures → Operations → Financial → CaseStudy → Messaging` (`BoundedContextMigrations.ApplyOrder`). Each stream's history table is `<schema>.__EFMigrationsHistory` (`HistorySchemaByContextName`). Migration files live in `backend/contexts/<ctx>/RealEstateEval.<Ctx>.Infrastructure/Data/Migrations/` (messaging: `backend/RealEstateEval.Infrastructure/Data/Contexts/Messaging/Migrations/`). Every stream starts with an `Initial<Ctx>Baseline` plus an `Ensure<Ctx>TablesForStandalone` migration that creates the tables on an empty dedicated database; the pre-split legacy stream is archived at git tag `a10-legacy-stream-final` (`backend/tools/DbMigrate/Program.cs` header). `MigrationStreamTests` checks that every stream is catalogued, that a stream's `schema: "…"` literals name only schemas it owns, and that DbMigrate's list matches `ApplyOrder`.

**Design-time.** `dotnet ef migrations add … --project backend/contexts/<ctx>/RealEstateEval.<Ctx>.Infrastructure` works without a host through the per-context design-time factories (`backend/RealEstateEval.Infrastructure/Data/Contexts/BoundedContextDesignTimeFactories.cs` and `<Ctx>DesignTimeFactory.cs`); the dedicated env var is used if set, otherwise a placeholder connection string.

**DbMigrate** (`backend/tools/DbMigrate/Program.cs`, image `ghcr.io/<owner>/case_study/db-migrate`):

| Command | Effect |
|---|---|
| `update` (default) / `migrate` | ensure each database exists, then apply pending migrations of all nine streams in order |
| `list` | print applied and pending migrations per stream |
| `seed` | migrate, then run `DataSeeder` against the Identity connection (also triggered by `Database:SeedDemoData=true` or `--seed`) |
| `rollback <MigrationName|0> <ContextName>` | migrate one stream down to the named migration (`0` = empty) |
| `attachment-blobs` | move legacy inline `FileAttachments.Content` bytes into the blob store (`BlobStorage__LocalRootPath` must be the Attachments service volume), then null the column |

It reads the nine `REAL_ESTATE_EVAL_PG_CONNECTION_STRING_*` variables from the environment and refuses to start if its stream list drifts from `ApplyOrder`.

**Seed contents** (`backend/tools/DevSeed/DataSeeder.cs`, `DataSeeder.SeedAsync`): Identity roles (`LegacyRoles` + `OrgRoles.All` + `DepartmentRoles.All`); the legacy admin; the HR staff accounts in `HrStaffSeeds` and the Jeddah survey office provider (`JeddahSurveyOfficeSeed`), each with a demo mobile from `DemoMobileByLogin` (`+96650000000{1..12}`) for phone login; reviewer city coverage and distribution-assignee backfills; prototype module data (`SurveyOffices`, `FailureTypesCatalogConfigs`); the engineering-survey pricing table with `DemoSurveyAreaTiers` and the demo office's `PartyFeePricingAssignment` (`EnsureEngineeringSurveyPricingTiersAsync`); and the comparable bank, idempotent by `ReferenceCode` (`backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Data/ComparableBankSeed.cs`). Re-running the seed on an already-seeded database only applies the idempotent "ensure" passes (`IsAlreadySeededAsync`). The Case Study host throws if `Database:SeedDemoData` is on in Production; seeding in production happens only through the `migrate` job.

**Production ordering** (`infra/docker-compose.prod.yml`): the `migrate` one-shot depends on `postgres` (`service_healthy`) and runs with `Database__SeedDemoData: "true"`; every API service lists `migrate: condition: service_completed_successfully` in its `depends_on` and runs with `Database__MigrateOnStartup: "false"`. The deploy job runs `docker compose -f docker-compose.prod.yml run --rm migrate` before `up -d` (`docs/DEPLOYMENT_HETZNER.md`).

---

## Operational jobs

| Job | Where it runs | What it does | Source |
|---|---|---|---|
| Outbox dispatcher | Case Study host (drains `MessagingDbContext`) and Valuation host (drains `ValuationDbContext`) | Polls `messaging.OutboxMessages` via the pending partial index and publishes to RabbitMQ | `AddOutboxDispatcher` in `backend/RealEstateEval.Infrastructure/DependencyInjection.cs`; `backend/services/case-study/RealEstateEval.CaseStudy.Api/ServiceModule.cs`, `backend/services/valuation/RealEstateEval.Valuation.Api/ServiceModule.cs` |
| Inbox | Case Study and Platform hosts | Insert into `ProcessedIntegrationEvents` (PK `Consumer + EventId`) is the redelivery dedupe | `AddIntegrationEventInbox`; `MessagingModel.ApplyInboxModel` |
| `MessagingRetentionHostedService` | Same hosts as the dispatcher; first sweep one minute after start, then every `IntervalMinutes` | Deletes processed outbox rows (> `ProcessedOutboxDays`, default 7), dead-lettered rows (> 30), inbox rows (> 30), expired `CommandIdempotencyRecords`, and read notifications (> 90). Inbox/idempotency/notification pruning only happens on `MessagingDbContext` | `backend/RealEstateEval.Infrastructure/Integration/MessagingRetentionHostedService.cs`; config section `MessagingRetention` (`Enabled`, `IntervalMinutes`, `ProcessedOutboxDays`, `DeadLetteredOutboxDays`, `ProcessedInboxDays`, `ReadNotificationDays`) |
| Reference sequences | In the owner's own transaction | Yearly counters per prefix; no cross-service call | `ReferenceSequenceAllocator.cs` |
| Valuation display ids | Valuation database | `nextval('valuation."ValuationRequestDisplayId"')` | `backend/RealEstateEval.Infrastructure/Data/DatabaseObjects.cs` |

---

## Known traps

1. **`operations.PropertyKeyRecords.PropertyId` is a deed label, not a property id.** The column is a `string(128)` (`backend/contexts/operations/RealEstateEval.Operations.Domain/PropertyKeyRecord.cs`) and is assigned from `FormatDeedLabel(...)` in `backend/contexts/operations/RealEstateEval.Operations.Infrastructure/Services/PropertyKeysService.cs`. Do not join it to `WorkOrderProperties.Id`.
2. **`case_study` tables inside the financial and operations streams must be shaped with raw `migrationBuilder.Sql`.** `MigrationStreamTests.ContextStreamsOnlyTouchTheirOwnSchemas` scans migrations for `schema: "…"` literals and fails on `schema: "case_study"` outside the Case Study stream, so `InspectorFeeLedgers` / `DisbursementBatches` (`financial/…/20260905121830_FinancialForeignKeysAndChecks.cs`) and `OperationsTasks` (`operations/…/20260905121820_TaskSequenceToReferenceSequencesAndChecks.cs`) are altered with `ALTER TABLE case_study."…"` strings.
3. **Column type changes are raw SQL.** Npgsql emits no `USING` clause, so `ALTER COLUMN … TYPE uuid USING "PropertyId"::uuid` is written by hand (`failures/…/20260905121812_PropertyIdAsUuidAndStatusChecks.cs`, `valuation/…/20260905121840_PropertyIdAsUuidJsonbAndChecks.cs`).
4. **Delete the scaffolded `AddColumn` for `xmin`.** `UseOptimisticConcurrency()` maps a shadow `Version` property to the system column `xmin` (`ModelConventions.cs`); EF scaffolds an `AddColumn<uint>("xmin")` for it that must be removed — the shipped row-version migrations contain no such op (`valuation/…/20260906053842_SelectionRowVersionAndRecallIndex.cs`, `case-study/…/20260906053831_WorkOrderPropertyRowVersionAndWorkspaceIndex.cs`).
5. **Hijri dates and free-text area / boundary fields in `case_study` are strings on purpose.** `DeedDate`, `RealEstateRegDate`, `AssignmentMandateDate`, `PartitionMinutesDate`, `RequestDate`, `SigDate` are `string(32)`; `Area`, `AreaSqm`, `NorthBoundary…WestBoundaryLengthM` are strings too (`CaseStudyModel.cs`). The prototype form is the ruling spec for these fields; the tri-state intake answers are kept to the prototype's wire strings by a CHECK (`TriStateAnswers`).
6. **One `case_study` schema name lives on three databases.** Case Study tables are on `realestate_eval_case_study`; `InspectorFee*`/`DisbursementBatches` are on the financial database; `OperationsTasks` is on the operations database (D1/D2 in `docs/architecture/table-ownership-catalog.md`). Query the right database.
7. **`attachment-blobs` before `DropInlineAttachmentContent`.** The migration raises `attachments.FileAttachments still holds inline content` if any row still has bytes.
8. **`backend/scripts/dev-infra.mjs` still prints `realestate_eval_dev` as the database name**; that database does not exist — use the nine names above.

---

## Related documentation

| Document | What it covers |
|---|---|
| `docs/ARCHITECTURE.md` | Clean-layer layout of `backend/` |
| `docs/architecture/table-ownership-catalog.md`, `docs/architecture/table-ownership.json` | Table → owner catalog, decisions D1–D6, guardrail tests (note: the narrative is dated 2026-07-30 and still describes `ApplicationDbContext`, which has since been deleted) |
| `docs/architecture/boundary-baseline.json` | Per-API and per-file schema reach ceiling; regenerate with `REE_ARCH_BASELINE=update dotnet test backend/RealEstateEval.Architecture.Tests` |
| `docs/architecture/pagination-contract.md` | List paging contract; §3 explains the deed-search indexes |
| `docs/architecture/solid-scorecard.md` | Refactor scorecard and ratchets |
| `docs/DEPLOYMENT_HETZNER.md` | Production stack, GHCR images, the `migrate` one-shot in CI/CD |
| `docs/MICROFRONTENDS_AND_MICROSERVICES.md` | Service and micro-frontend map |
| `backend/plan/LOCAL_INFRA.md` | Local infra URLs and credentials |

---

## One-line status for stakeholders

> **All product modules persist to PostgreSQL across nine dedicated databases (one per bounded context plus messaging), migrated by a deploy-time `DbMigrate` job with per-stream history tables; as of 2026-09-06 the schema carries same-schema foreign keys, uuid ids, generated CHECK constraints, `jsonb` columns, xmin concurrency tokens and automatic retention of messaging rows.**
