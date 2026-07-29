# ADR 0002: Decompose shared Application and Infrastructure assemblies

- **Status:** Accepted
- **Date:** 2026-07-29

## Context

All nine service API projects reference both
`backend/RealEstateEval.Application/RealEstateEval.Application.csproj` and
`backend/RealEstateEval.Infrastructure/RealEstateEval.Infrastructure.csproj`; the only
exception in the process surface is the gateway, which references `Shared.Web`.
The shared Application project currently contains 88 C# files spanning identity,
case-study, failures, operations, valuation, attachments, financial, reporting, platform,
notifications, and integration abstractions. Infrastructure contains 45 service
implementation files plus one context, one dependency-injection module, messaging,
storage, migrations, and seed data.

Registration methods look service-specific, but compile-time boundaries are not.
For example, `AddFailuresInfrastructure` registers workflow, inspector-fee, pricing,
billing, timeline, failure, and notification services
(`backend/RealEstateEval.Infrastructure/DependencyInjection.cs:160-174`).
Any change to either shared project can rebuild and redeploy every API that references it.

Two existing libraries are legitimate shared seams:

- `RealEstateEval.Shared.Contracts` contains broker integration-event contracts and has no
  project references.
- `RealEstateEval.Shared.Web` contains cross-cutting HTTP hosting behavior. It currently
  references the whole Application project for authorization capabilities, so it is not
  yet independent (`backend/shared/RealEstateEval.Shared.Web/RealEstateEval.Shared.Web.csproj`).

## Decision

Create per-bounded-context Domain, Application, and Infrastructure libraries and move
vertical slices into them incrementally. An API references its own context libraries plus
small shared libraries, not a solution-wide Application or Infrastructure assembly.

Keep shared only code that is domain-neutral and stable:

- `Shared.Contracts`: versioned integration-event envelopes and contracts; no entities,
  EF types, service implementations, or internal DTOs.
- `Shared.Web`: authentication/JWT plumbing, exception/problem-details mapping,
  observability, health checks, CORS, and OpenAPI conventions. Move capability constants
  needed here into a small authorization-contract package or represent them as claims;
  remove the dependency on the global Application assembly.
- Small technical primitives may be shared only after at least two contexts need the same
  semantics. Do not use a shared project as a staging area.

Reporting is a separate read-model concern. It may consume stable APIs/events and own
projections; it must not force operational domain libraries back into a common assembly.

## Consequences

- Changes can compile, test, and deploy on a smaller service surface.
- Dependency direction becomes enforceable by project references.
- Some apparent reuse will become explicit contracts or intentionally duplicated
  domain-local code.
- During migration, temporary adapters and dual project references will exist. They must
  have an owner and removal issue.
- The shared Domain assembly must be decomposed with Application and Infrastructure;
  splitting only the latter two would leave entity coupling intact.

## Alternatives considered

- **Keep shared assemblies and rely on namespaces.** Rejected: namespaces do not constrain
  references, builds, deployments, or EF model ownership.
- **Copy all shared code into every API at once.** Rejected: high merge risk and likely
  semantic drift without established boundaries.
- **Create one library per technical layer across the solution.** Rejected: it preserves
  horizontal coupling. Libraries are grouped by bounded context first, then by layer.
- **Share all DTOs.** Rejected: internal request/read DTOs evolve with their owner. Only
  externally consumed, versioned contracts belong in `Shared.Contracts`.
