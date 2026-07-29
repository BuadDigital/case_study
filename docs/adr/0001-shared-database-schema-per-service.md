# ADR 0001: Shared PostgreSQL database with schema-per-service

- **Status:** Accepted (transitional)
- **Date:** 2026-07-29

## Context

The nine APIs select service-specific connection-string names, but
`ServiceCollectionExtensions.RequireConnectionString` falls back to
`REAL_ESTATE_EVAL_PG_CONNECTION_STRING` and then `ConnectionStrings:DefaultConnection`
(`backend/shared/RealEstateEval.Shared.Web/ServiceCollectionExtensions.cs:191-218`).
Every service's development settings currently resolve to the same
`realestate_eval_dev` database. `DatabaseSchemas` defines nine PostgreSQL schemas:
`identity`, `case_study`, `platform`, `failures`, `operations`, `valuation`,
`attachments`, `financial`, and `messaging`
(`backend/RealEstateEval.Infrastructure/Data/DatabaseSchemas.cs:3-27`).

Schemas make intended ownership visible and allow grants, migration history, and naming
to be separated later. They do not provide failure isolation, independent backup/restore,
independent scaling, or enforcement against cross-schema queries. The current
`ApplicationDbContext` can access all schemas in one transaction.

Verified cross-schema dependencies include:

- `WorkOrderService` reads `financial.PoEnfazInvoices` and
  `failures.PropertyFailures` while managing `case_study` work orders
  (`backend/RealEstateEval.Infrastructure/Services/WorkOrderService.cs:102-121,205-235`).
- `FinancialReportService` reads financial tables together with
  `case_study.InspectorFeeLedgers`, `case_study.WorkflowTasks`,
  `case_study.WorkOrders`, and identity users/profiles
  (`backend/RealEstateEval.Infrastructure/Services/FinancialReportService.cs:85-101,159-204,267-292`).
- `OperationsTaskService` reads/writes `case_study.OperationsTasks`, reads identity
  profiles, and reads/writes `financial.CourtVisitFeeCharges`
  (`backend/RealEstateEval.Infrastructure/Services/OperationsTaskService.cs:74-1178`).
- Case Study and Failures register `NotificationService`, which writes
  `messaging.UserNotifications`; Platform exposes the notification list and mutation API
  (`backend/RealEstateEval.Infrastructure/DependencyInjection.cs:148-173,210-222`;
  `backend/services/platform/RealEstateEval.Platform.Api/Controllers/NotificationsController.cs`).

## Decision

Keep one physical PostgreSQL database while bounded contexts, contexts, migration streams,
and inter-service contracts are separated. Treat each schema as an ownership boundary:
one service may write it; other services must move toward APIs, integration events, or
locally owned projections. Do not add new cross-schema foreign keys, joins, or multi-schema
write transactions.

Split a service into its own database only when it has:

1. an explicit table owner and writer for every table it takes;
2. no runtime cross-schema joins or writes in its critical paths;
3. an outbox in the producer's database and an inbox in each consumer's database;
4. a tested data copy, cutover, reconciliation, and rollback procedure; and
5. independent migration and operational ownership.

Database-per-service is a means of enforcing a proven boundary, not the first mechanism
used to discover one.

## Consequences

- Schema names expose intended ownership without a high-risk data move.
- Existing transactions and queries keep working during decomposition.
- The shared database remains a common failure, capacity, credential, and restore domain.
- PostgreSQL permissions can detect accidental coupling only after each service receives
  a schema-limited role; the current common context prevents doing that immediately.
- Messaging is not yet service-owned: one shared `messaging` schema and a dispatcher
  registered only by Case Study must be split before databases can be split safely
  (`backend/RealEstateEval.Infrastructure/DependencyInjection.cs:255-266`).

## Alternatives considered

- **Split all databases now.** Rejected: verified joins and same-context transactions would
  fail, and ownership of notifications, inspector fees, operations tasks, and reporting
  data is not yet clean.
- **Keep a shared database permanently.** Rejected as a target: it leaves ownership and
  independent operation unenforced.
- **Create a database per API while retaining one shared context.** Rejected: model and
  migration coupling would remain while deployments become harder to coordinate.
