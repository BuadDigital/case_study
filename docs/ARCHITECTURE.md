# Architecture — current state

Last reviewed: 2026-09-20. This page describes the **live** tree, not the 2026-07
roadmap. Historical decisions live in [`adr/`](adr/). The split plan and remaining
tail are in [`architecture-split-plan.md`](architecture-split-plan.md) and
[`remaining-work.md`](remaining-work.md). Schema detail:
[`DATABASE_OVERVIEW.md`](DATABASE_OVERVIEW.md).

The platform is a **pragmatic Clean Architecture** split: domain rules at the
center, use cases around them, infrastructure at the edge, HTTP/UI as delivery.
Bounded contexts are the primary partition; layers sit **inside** each context.

## Backend

```text
backend/
  gateway/RealEstateEval.Gateway/          YARP public entry (:5160)
  services/<ctx>/RealEstateEval.<Ctx>.Api/  Thin controllers + host DI
  contexts/<ctx>/RealEstateEval.<Ctx>.{Domain,Application,Infrastructure}
  shared/RealEstateEval.Shared.{Contracts,Web,RemoteClients}
  RealEstateEval.Application/              Shared contracts/rules still referenced by every API
  RealEstateEval.Infrastructure/           Shared persistence/messaging plumbing
  tools/DbMigrate/                         Deploy-time migrator (nine streams)
  tools/DevSeed/                           Development seed / reset
```

Nine API hosts: identity, case-study, operations, reporting, financial,
valuation, failures, platform, attachments. Reporting has **no** persistence;
it is an HTTP read model.

**Dependency rule (enforced by `RealEstateEval.Architecture.Tests`)**

- Context `Domain` → only `Shared.Contracts` (no NuGet, no EF, no ASP.NET)
- Context `Application` → Domain + Shared.Contracts (no EF)
- Context `Infrastructure` → Application + Domain; owns the DbContext and migrations
- Each `*.Api` host → its context libraries + shared web/remote-client helpers
- Global `RealEstateEval.Domain` is **deleted** and must not return

Cross-owner reads and commands go over HTTP (`AddRemote*` in
`Shared.RemoteClients`, dispatch endpoints such as `/api/case-study-dispatch`).
The architecture tests freeze schema reach, project references, table ownership,
and service size (Application 500 lines, Infrastructure 400; frozen over-cap
lists are empty).

**Databases.** Nine PostgreSQL databases, one per owner plus messaging. There
is no leftover shared database. D1 inspector-fee tables live in the
`financial` schema on the financial database; D2 `OperationsTasks` lives in
the `operations` schema on the operations database.

**Migrations** (from repo root), against the **owner** context project:

```bash
dotnet ef migrations add <Name> \
  --project backend/contexts/<ctx>/RealEstateEval.<Ctx>.Infrastructure \
  --startup-project backend/services/<ctx>/RealEstateEval.<Ctx>.Api
```

Production applies streams with `backend/tools/DbMigrate` before app rollout
(`Database__MigrateOnStartup: false`). Development may let Case Study apply
pending migrations at startup. See [backend/README.md](../backend/README.md).

## Frontend

```text
apps/shell/                    Host: login, layout, nav, Next.js routes
apps/mfe-*/                    Feature packages imported by the shell
packages/api-client            REST DTOs & fetch helpers
packages/auth-client           Session
packages/app-shared            Shared nav, queries, domain helpers
packages/ui-kit                CSS tokens and shared controls
packages/types                 PageId, RoleId, navigation types
```

**Today:** logical micro-frontends, **one deploy**. The shell dynamically
imports `@case-study/mfe`, `@evaluator/mfe`, `@engineering-office/mfe`, and
the other packages. Module Federation is deferred until an independent
release cadence is needed (`apps/plan/FRONTEND.md`).

Business data is **not** mock: work orders, properties, tasks, valuation,
failures, keys, and billing persist through the gateway to owner APIs.

## What is still shared on purpose

`RealEstateEval.Infrastructure` stays for messaging + outbox, audit mapping,
and connection plumbing. Global `RealEstateEval.Application` still holds
cross-service ports that mention owner entities (`ICaseStudyLookup`,
notifications, identity directory). TimeProvider/cache/inbox ports,
`PermissionsDto`, and `FieldFormats` live in `Shared.Contracts`; identity
login/staff and financial billing/fee types live in their owner Application
libraries (2026-09-20). `Shared.Web` does not reference Application.
Dissolving the leftover entity-shaped ports is ADR 0002 remainder — it
needs primitive/DTO signatures, not a rename.

## Next slices (not Module Federation, not blob-folder reshapes)

1. Keep this documentation matched to the code (this page, ADR statuses, frontend plan).
2. Finish ADR 0002 only when a given abstraction has a single owner. Cross-service ports that still mention owner entities (`ICaseStudyLookup`, notifications) stay in global Application until those signatures are primitives/DTOs.
3. Read live p95 / pool / outbox series in Grafana (`ree-service-overview`) once production has traffic — the instruments already export over OTLP.

## Assessments

- [`architecture/solid-scorecard.md`](architecture/solid-scorecard.md) — SOLID / pattern inventory with measured evidence (passes through 2026-09-06).
- [`status/architecture-split-status.md`](status/architecture-split-status.md) — phase closeout.
- [`DATABASE_OVERVIEW.md`](DATABASE_OVERVIEW.md) — schemas, streams, DbMigrate.
