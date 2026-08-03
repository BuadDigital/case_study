# Ownership catalog and boundary guardrails

This is the Phase 0 artifact required by [`docs/architecture-split-plan.md`](../architecture-split-plan.md):
a table ownership catalog, a classification of every verified cross-boundary use, and
executable guardrails that stop the coupling from growing. Since ownership was approved it is
also the specification Phase 1 contexts are checked against.

**Phase status (2026-07-30):** ownership is **approved** for all 60 tables and decisions D1–D6
are recorded, so Phase 0's ownership gate is closed and Phase 1 has started. Phase 1 is **in
progress**: extraction step 1 (Attachments, Platform catalogs, Valuation) is done; steps 2–5
(Identity, Failures/Operations, Financial/Case Study, Messaging) are not. Two Phase 0
deliverables that the repository cannot produce remain open and are tracked in
[Remaining gates](#remaining-gates).

## Files

| File | Purpose |
| --- | --- |
| [`table-ownership.json`](table-ownership.json) | Machine-readable catalog: one write owner per table, the context(s) holding its write path, transaction group, decision reference. Source of truth for the tests. |
| [`boundary-baseline.json`](boundary-baseline.json) | Coupling that exists today (project references, per-API and per-file schema reach, service registration fan-out, cross-schema model links, legacy-context call sites). Treated as a **ceiling**. |
| `backend/RealEstateEval.Architecture.Tests` | Tests that enforce both files. |

Regenerate the baseline deliberately, then review the diff:

```bash
REE_ARCH_BASELINE=update dotnet test backend/RealEstateEval.Architecture.Tests
```

Coupling may shrink freely — removing a cross-schema read never fails a test. Adding one
fails until the baseline is updated in the same change, which makes the trade-off visible in
review.

## What the guardrails enforce

| Test | Rule |
| --- | --- |
| `TableOwnershipCatalogTests` | Every table mapped by `ApplicationDbContext` has exactly one catalogued owner and a valid ownership model, its catalogued schema matches the model, every decision carries an outcome and rationale, and the catalogued legacy cutover matches the code. |
| `BoundedContextBoundaryTests` | Contexts may exist only once ownership is approved, the declared contexts are exactly the catalogued ones, each extracted context maps exactly the tables it owns, only per-producer/per-consumer messaging tables may appear in more than one context, owning services no longer take the legacy context, and each extracted context has its own migrations-history schema. |
| `ProjectReferenceBoundaryTests` | `Domain` and `Shared.Contracts` stay reference-free, `Infrastructure` does not depend on hosting, the gateway depends only on `Shared.Web`, no API compiles another API, and references to the global `Application`/`Infrastructure`/`Domain` assemblies cannot grow (ADR 0002). |
| `SchemaAccessBoundaryTests` | No file or API reaches a schema it did not reach before, a persistence service cannot gain another hosting process (plan rule 1), reporting keeps no database access, and every owner can already reach the schema it owns. |
| `EfModelBoundaryTests` | Every table declares an explicit schema, no new cross-schema foreign keys or navigations (plan rule 2), and the model never drifts from the migration snapshot. |
| `MigrationStreamTests` | Every migration stream is catalogued and has exactly one snapshot for its own context, the legacy stream is frozen at the cutover, context streams shape only their own schemas, migrations touch only declared schemas, the deploy migrator applies the legacy stream plus every context stream, and only the Case Study development path applies migrations from a host (ADR 0006). |

Two facts the model check established, both useful for later phases: there are **no
cross-schema foreign keys** and **no cross-schema navigation properties**. Cross-boundary
coupling is entirely in queries and transactions, not in referential constraints.

## Ownership decisions (approved 2026-07-30)

| Id | Question | Outcome | Note |
| --- | --- | --- | --- |
| D1 | Inspector-fee ledgers, transitions, disbursement batches | **financial** | Accrual/discount/exclusion/batching are financial lifecycle states, and financial reporting and engineering billing already read the ledger. Rows stay in `case_study`; relocation is Phase 4. |
| D2 | Operations tasks, their sequences, court-visit charges | **operations** owns `OperationsTasks`/`OperationsTaskSequences`; **financial** owns `CourtVisitFeeCharges` | The task lifecycle is operations work; the charge it produces is priced and collected by Financial. Charge creation moves behind a Financial command in Phase 3. |
| D3 | Notification inbox rows and recipient resolution | **platform** | Platform already owns the list/mutation endpoints and non-owners already request notifications through the outbox. Recipient resolution becomes a Platform projection or an owner contract in Phase 3. |
| D4 | Document-reference counters | **case-study** | The counter is the correspondence-numbering sequence of the case-study document set; engineering billing is a consumer and gets numbers through a Case Study command in Phase 3. |
| D5 | Service-local shape of outbox/inbox | **per-producer outbox, per-consumer inbox** | Each producing context maps `messaging.OutboxMessages` and owns only the rows it inserts, so a business write and its event stay in one `SaveChanges`. Consumers own the rows carrying their own `Consumer` value. |
| D6 | Production-only SQL/BI consumers, roles, cross-schema objects | **accepted with residual risk** | Not discoverable from this repository. Judgment call on approval: it does not block Phase 1, because Phase 1 renames no table, moves no row, changes no grant and emits no DDL. It remains a hard gate for Phase 3 grant changes and Phase 4 data movement. |

Judgment calls made while approving, beyond the catalog's proposed owners:

- **`OutboxMessages` and `ProcessedIntegrationEvents` keep more than one owning context.**
  A strict reading of plan rule 1 ("one table has one write owner") would force a single
  messaging context, which D5 rejects and plan Phase 1 work item 2 explicitly warns against.
  The catalog resolves this with an `ownershipModel` field: `single-owner` tables may appear
  in exactly one context, `per-producer`/`per-consumer` tables own rows rather than the table.
  The guardrail enforces that distinction rather than the blanket rule.
- **Ownership is behavioural, not physical.** `InspectorFee*`, `DisbursementBatches`, and
  `OperationsTasks` are owned by Financial and Operations while their rows stay in the
  `case_study` schema. Approving an owner is not approving a table move; relocation is Phase 4.
- **A table can be owned by a context that is not yet extracted.** `UserNotifications` is
  Platform-owned (D3) but stays on the legacy context until the messaging slice, because
  extracting it separately would split notification writes from the outbox that carries them.

## Ownership catalog

60 tables: 53 declared `DbSet`s plus the seven inherited ASP.NET Identity tables. Every row is
`approved`. "Context" is the EF context that holds the write path **today**; rows still on
`ApplicationDbContext` move to their owner's context in a later extraction step.

### `identity`

| Table | Owner | Context | Transaction group |
| --- | --- | --- | --- |
| `Users`, `Roles`, `UserRoles`, `UserClaims`, `RoleClaims`, `UserLogins`, `UserTokens` | identity | `ApplicationDbContext` | `identity.account` |
| `UserProfiles`, `HrEmployeeProfiles`, `ProcServiceProviderProfiles` | identity | `ApplicationDbContext` | `identity.account` |
| `RefreshTokens` | identity | `ApplicationDbContext` | `identity.session` |

### `case_study`

| Table | Owner | Context | Transaction group |
| --- | --- | --- | --- |
| `WorkOrders`, `WorkOrderProperties`, `PropertyContacts`, `PropertyTimelineEntries` | case-study | `ApplicationDbContext` | `case-study.work-order` |
| `WorkflowTasks`, `CaseStudyForms`, `PartyTaskSubmissions`, `FieldInspectionWorkspaces` | case-study | `ApplicationDbContext` | `case-study.workflow` |
| `InternalDelegationLetterSets`, `PoIntakeDrafts`, `DocumentReferenceCounters` (D4) | case-study | `ApplicationDbContext` | `case-study.documents` |
| `InspectorFeeLedgers`, `InspectorFeeTransitions` (D1) | financial | `ApplicationDbContext` | `inspector-fees.ledger` |
| `DisbursementBatches` (D1) | financial | `ApplicationDbContext` | `inspector-fees.disbursement` |
| `OperationsTasks`, `OperationsTaskSequences` (D2) | operations | `ApplicationDbContext` | `operations.tasks` |

### `platform` — extracted

| Table | Owner | Context | Transaction group |
| --- | --- | --- | --- |
| `CourtCatalogEntries`, `Courts`, `CourtCircuits`, `CourtAuditLogs` | platform | `PlatformDbContext` | `platform.courts` |
| `Regions`, `Cities`, `Districts` | platform | `PlatformDbContext` | `platform.geo` |
| `FieldDictionaryConfigs`, `CaseStudyInfoRolesConfigs`, `OrganizationSettings` | platform | `PlatformDbContext` | `platform.config` |
| `FieldSyncStatuses` | platform | `PlatformDbContext` | `platform.field-sync` |

### `failures`, `operations`, `valuation`, `attachments`

| Table | Owner | Context | Transaction group |
| --- | --- | --- | --- |
| `PropertyFailures` | failures | `ApplicationDbContext` | `failures.lifecycle` |
| `FailureTypesCatalogConfigs` | failures | `ApplicationDbContext` | `failures.catalog` |
| `SurveyOffices` | operations | `ApplicationDbContext` | `operations.reference` |
| `PropertyKeyRecords`, `KeyEnvelopes`, `KeyEnvelopeAssignments`, `KeyEnvelopeHandoffs`, `KeyEnvelopeTimelineEntries`, `PropertyCourtAccesses` | operations | `ApplicationDbContext` | `operations.keys` |
| `ValuationRequests` | valuation | `ValuationDbContext` | `valuation.requests` |
| `EvaluatorRecallRecords` | valuation | `ValuationDbContext` | `valuation.recalls` |
| `FileAttachments`, `PhotoMetadata` | attachments | `AttachmentsDbContext` | `attachments.files` |

### `financial`

| Table | Owner | Context | Transaction group |
| --- | --- | --- | --- |
| `PoEnfazInvoices`, `PoEnfazRevenueLines` | financial | `ApplicationDbContext` | `financial.enfaz-invoicing` |
| `PartyBillingStatements`, `PartyBillingStatementLines` | financial | `ApplicationDbContext` | `financial.party-billing` |
| `KeyReceiptFeeCharges`, `CourtVisitFeeCharges` (D2) | financial | `ApplicationDbContext` | `financial.charges` |
| `PartyFeePricingTables`, `PartyFeePricingTiers`, `PartyFeePricingAssignments` | financial | `ApplicationDbContext` | `financial.pricing` |
| `DiscountFlags`, `IncentiveSuspensions` | financial | `ApplicationDbContext` | `financial.pricing` |
| `FinancialReportConfigs` | financial | `ApplicationDbContext` | `financial.reporting-config` |

### `messaging`

| Table | Owner | Context | Transaction group |
| --- | --- | --- | --- |
| `OutboxMessages` (D5) | per-producer | `ApplicationDbContext`, `ValuationDbContext` | `messaging.outbox` |
| `ProcessedIntegrationEvents` (D5) | per-consumer | `ApplicationDbContext` | `messaging.inbox` |
| `UserNotifications` (D3) | platform | `ApplicationDbContext` | `notifications.inbox` |

## Phase 1 contexts

One physical database, one connection string per service, several models. The only per-context
difference at runtime is the migrations-history table, so each stream records itself in the
schema it owns and cannot claim another's migrations.

| Context | State | Schemas | Migrations history | Notes |
| --- | --- | --- | --- | --- |
| `ApplicationDbContext` | legacy | all nine | `public.__EFMigrationsHistory` | Frozen at `20260729142123_DatabaseRaceGuardsAndIndexes`. Holds unextracted slices plus read-only mappings of extracted tables that non-owner slices still query. |
| `AttachmentsDbContext` | extracted | `attachments` | `attachments.__EFMigrationsHistory` | |
| `PlatformDbContext` | extracted | `platform` | `platform.__EFMigrationsHistory` | `messaging.UserNotifications` is Platform-owned but stays on the legacy context until the messaging slice. |
| `ValuationDbContext` | extracted | `valuation`, `messaging` | `valuation.__EFMigrationsHistory` | Maps `messaging.OutboxMessages` so a valuation write and the event announcing it stay in one `SaveChanges` (D5). |

Each context's first migration is an **empty baseline**: the tables already exist because the
legacy stream created them, and the legacy stream still creates them on a blank database. The
baseline exists so the context has a model snapshot to diff future changes against.

## Write paths with more than one process today

Schema names suggest single ownership; registration does not deliver it. These persistence
services are registered by several APIs, so several processes write the same tables. Phase 1
gives each of these tables one *context*; reducing them to one *process* is Phase 3 work.

| Service | Registered by | Tables it writes across the boundary |
| --- | --- | --- |
| `AuthSessionService`, `PermissionService`, `UserRegistrationService` (plus the ASP.NET Identity stores) | all eight database APIs | `identity.*` |
| `WorkflowTaskService` | case-study, failures | `case_study.WorkflowTasks` |
| `FailureService` | case-study, failures | `failures.PropertyFailures`, `case_study.WorkflowTasks` |
| `PropertyTimelineService` | case-study, failures | `case_study.PropertyTimelineEntries` |
| `InspectorFeeService` | case-study, failures | `case_study.InspectorFee*`, `DisbursementBatches` |
| `PoEnfazBillingService` | case-study, failures | `financial.PoEnfazInvoices`, `PoEnfazRevenueLines` |
| `EngineeringBillingStatementService` | case-study, failures | `financial.EngineeringBillingStatement*`, `case_study.DocumentReferenceCounters` |
| `PartyFeePricingService` | case-study, failures, financial | `financial.PartyFeePricing*` |
| `KeyEnvelopesService` | case-study, operations | `operations.KeyEnvelope*`, `financial.KeyReceiptFeeCharges` |
| `KeyEnvelopePeopleResolver` | case-study, operations | reads `identity.Users` for envelope people names |
| `PropertyKeyGateResolver`, `PropertyAccessHoldService` | case-study, operations | `case_study`, `operations`, `failures` reads and holds |
| `ValuationRequestService` | case-study, valuation | `valuation.ValuationRequests` (now through `ValuationDbContext` in both processes; Case Study writes it from `CaseStudyValuationDispatchService`) |
| `OutboxIntegrationEventPublisher` | case-study, failures, platform | `messaging.OutboxMessages` |
| `ValuationOutboxPublisher` | case-study, valuation | `messaging.OutboxMessages` (valuation rows only) |
| `CaseStudyPropertyPoNumberLookup` | case-study, valuation | reads `case_study.WorkOrderProperties`/`WorkOrders` for the PO number a valuation request carries |
| `IntegrationEventInbox` | case-study, platform | `messaging.ProcessedIntegrationEvents` |
| `NotificationRecipientResolver` | case-study, failures, platform | reads `identity.UserProfiles`, `case_study.WorkflowTasks` |

## Schema reach per API

Recorded from registrations and API-local code, not from intent.

| API | Schemas reached | Owns |
| --- | --- | --- |
| identity | identity | identity |
| attachments | attachments, identity | attachments |
| financial | case_study, financial, identity | financial |
| platform | case_study, identity, messaging, platform | platform |
| valuation | case_study, identity, messaging, valuation | valuation |
| failures | attachments, case_study, failures, financial, identity, messaging | failures |
| operations | attachments, case_study, failures, financial, identity, operations | operations |
| case-study | all nine | case-study |
| reporting | none (HTTP read model) | none |

Identity and Attachments are the closest to a schema-limited database role. Case Study is
the furthest, which matches the plan's suggested extraction order.

## Cross-boundary use classification

Every verified cross-boundary use, its classification, and the replacement pattern it must
use. The Phase-1 column records what changed in extraction step 1.

| Use | Evidence | Classification | Replacement pattern | Phase 1 |
| --- | --- | --- | --- | --- |
| Work-order list shows "billed" from `financial.PoEnfazInvoices` | `WorkOrderService` | reporting projection | invoice-status projection fed by Financial events | unchanged |
| Work-order and workflow gating on `failures.PropertyFailures` | `WorkOrderService`, `WorkflowTaskService`, `PropertyAccessHoldService` | synchronous invariant | Failures owner API for authoritative status; projection only where staleness is acceptable | unchanged |
| `FailureService` writing Case Study workflow tasks, work orders, properties | `FailureService` | command | Case Study command endpoint or integration event | unchanged |
| Financial reports joining Case Study ledgers/tasks/work orders and Identity users | `FinancialReportService` | reporting projection | Financial/Reporting read model from events plus reconciliation | unchanged |
| Engineering billing reading Case Study ledgers, tasks, properties, document counters, and `attachments.FileAttachments` | `EngineeringBillingStatementService` | command plus reference lookup | Case Study command for counters; Attachments API for existence checks | attachment reads still use the legacy read-only mapping |
| Operations tasks reading/writing `case_study.OperationsTasks`, `financial.CourtVisitFeeCharges`, `identity.UserProfiles`, `operations.KeyEnvelopes` | `OperationsTaskService` | synchronous invariant plus command | own `OperationsTasks` after D2; Financial command for charges; Identity projection for labels | unchanged |
| Party submissions reading Failures, Attachments, and Operations key state | `PartyTaskSubmissionService` | reference lookup plus invariant | owner APIs (Failures, Attachments, Operations) | unchanged |
| Inspector fees reading Case Study ledgers/tasks/properties and Identity profiles | `InspectorFeeService` | command plus invariant | after D1, Financial owns the ledger and consumes task-completion events | unchanged |
| Key envelopes creating `financial.KeyReceiptFeeCharges` and reading Attachments | `KeyEnvelopesService` | command | Financial charge command; Attachments API | unchanged |
| Notification recipient resolution reading `identity.UserProfiles` and `case_study.WorkflowTasks` | `NotificationRecipientResolver` | reference lookup | Platform projection or owner contract (D3) | unchanged |
| Display-name lookup on `identity.Users` from Case Study, Operations, and Financial code | `PersonLabelResolver` | reference lookup | Identity contract or projected label | unchanged |
| Every API registering the ASP.NET Identity stores and session/permission services | `AddIdentityInfrastructure` in all eight database APIs | write-ownership violation | validate JWT claims; only Identity registers the stores | extraction step 2 |
| Pricing lookups from Case Study, Failures, Operations | `PartyFeePricingService` | reference lookup | cacheable Financial pricing API or versioned snapshot | unchanged |
| `SystemMaintenanceService` touching eight schemas | `SystemMaintenanceService` | maintenance tooling | per-owner maintenance endpoints with explicit grants | unchanged — see [Known deviations](#known-deviations) |
| Valuation reading a property's PO number for its event payload | `ValuationRequestService` | reference lookup | Case Study owner API or a Valuation-local projection | **replaced** by `IPropertyPoNumberLookup`; the LINQ left the Valuation context |
| Valuation dispatch writing `valuation.ValuationRequests` from Case Study | `CaseStudyValuationDispatchService` | command | Valuation command or integration event (the event path already exists) | now writes through `ValuationDbContext`, not the legacy context |
| One shared `messaging` schema with a single Case Study dispatcher | `AddOutboxDispatcher` | infrastructure ownership | per-producer outbox and per-consumer inbox (D5) | Valuation now writes its own outbox rows; dispatch is still central |

## Known deviations

Accepted for Phase 1 and recorded so they are not mistaken for oversights. Each has an owner
and a removal criterion, as plan rule 5 requires.

| Deviation | Why it is accepted | Owner | Removal criterion |
| --- | --- | --- | --- |
| `SystemMaintenanceService` and `DataSeeder` still write extracted tables through the legacy context | Both are development/maintenance tooling, not request-path code, and Phase 1 changed neither. Extracting the primary write path first is the point of the slice. | case-study | Phase 3, when per-owner maintenance endpoints and explicit grants replace them |
| Extracted tables keep a read-only mapping on `ApplicationDbContext` | Non-owner slices (billing, party submissions, key envelopes, the field-inspection verifier) still query `FileAttachments`, and the case-study dispatcher still reads `ValuationRequests`. Removing the mapping before the owner API exists would break them. | case-study | Phase 3, when those reads move to owner APIs |
| `IPropertyPoNumberLookup` reads `case_study.WorkOrderProperties` from the Valuation process | The value is only a display string in a notification body. The read is now behind an owner interface, read-only, and outside the Valuation transaction. | case-study | Phase 3, when Case Study exposes it as an owner API or Valuation projects it locally |
| `ValuationRequestService` is registered by both Case Study and Valuation | Pre-existing; Case Study needs it for the dispatch adapter. Both processes now write through the same `ValuationDbContext`, so the table has one context even though it has two writing processes. | valuation | Phase 3, when dispatch becomes a Valuation command or event |

## Verification performed

| Check | Result |
| --- | --- |
| Legacy migration stream against a blank database (2026-07-29) | `DbMigrate update` applied the whole stream to an empty PostgreSQL 17 database. Resulting table counts match the catalog exactly (identity 11, case_study 16, platform 8, failures 2, operations 7, valuation 2, attachments 1, financial 10, messaging 3, plus the migrations history table). No user table received a physical `xmin` column, so `20260729104156_AddOptimisticConcurrencyTokens` is DDL-neutral on this PostgreSQL/Npgsql pair. The scratch database was dropped. |
| Legacy stream against a restored production-like database | **Not done.** Requires a production restore, which is not available here. Still a Phase 1 prerequisite; see [Remaining gates](#remaining-gates). |
| Phase 1 build and test run (2026-07-30) | See [`docs/status`](../status). |

## Remaining gates

Repository work for extraction step 1 is done. These items cannot be produced from the
repository and must be delivered by the named owners.

| Gate item | Owner | Blocks |
| --- | --- | --- |
| Nominate a service owner per API and an owner for the deploy-time migrator | engineering management | formal sign-off of the approvals recorded here |
| Inventory production-only SQL clients, BI jobs, database roles, backup/restore procedures, and cross-schema database objects (D6) | operations / data platform | Phase 3 grant changes; hard stop for Phase 4 |
| Capture p95 latency, error rate, connection counts, outbox backlog age, dead-letter count, consumer redeliveries, and key row counts | operations | comparison baseline for the rest of Phase 1 |
| Validate ADR 0006 deploy-time migration against a restored production-like database, including the `xmin` migration SQL (the blank-database half is done) | migrator owner | remaining Phase 1 extraction steps |
| Measure connection-pool counts per process now that each service opens a second pooled context | operations | extraction steps 2–5 (the plan's connection-growth risk) |
