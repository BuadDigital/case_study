# Architecture — Clean layers

This repo uses a **pragmatic Clean Architecture** split: domain rules at the center, application/use-cases around them, infrastructure at the edge, UI/API as delivery.

## Backend (`backend/`)

```text
RealEstateEval.Domain/          Entities & enums (WorkOrder, WorkflowTask, …)
RealEstateEval.Application/     DTOs, service interfaces, validation rules
RealEstateEval.Infrastructure/  EF Core, service implementations, migrations
services/*/RealEstateEval.*.Api/  HTTP controllers + Program.cs per domain service
gateway/RealEstateEval.Gateway/ YARP reverse proxy (public entry :5160)
RealEstateEval.Application.Tests/  Unit tests for application rules
```

See [backend/README.md](../backend/README.md) for gateway routes and local `dev:api` workflow.

**Dependency rule**

- `Domain` → no project references
- `Application` → `Domain`
- `Infrastructure` → `Application`, `Domain`
- Each `*.Api` service → `Application`, `Infrastructure` (and shared web helpers)

Register services via `Infrastructure.DependencyInjection.AddInfrastructure()`.

**EF migrations** (from repo root):

```bash
dotnet ef migrations add <Name> \
  --project backend/RealEstateEval.Infrastructure \
  --startup-project backend/services/case-study/RealEstateEval.CaseStudy.Api
```

## Frontend (`apps/shell/`)

```text
src/lib/domain/           Pure business rules (no React, no localStorage)
src/features/<area>/      Feature hooks & orchestration
src/lib/prototype/        Legacy adapters (API + localStorage) — migrate out over time
src/components/           UI only
packages/api-client/      HTTP client boundary
```

**Target flow:** `Component` → `features/*/hooks` → `lib/domain` + `api-client` / server queries.

**Still prototype / localStorage:** failures (courts catalog uses API; key-management UI removed until backend + `features/key-management` are rebuilt).

## Monorepo packages

| Package | Role |
|---------|------|
| `@platform/types` | Shared navigation & role types |
| `@platform/api-client` | REST DTOs & fetch helpers |
| `@platform/auth-client` | Session |
| `@platform/design-system` | Shared CSS & UI tokens |

## Next steps

1. Move remaining `lib/prototype/*-storage.ts` modules behind API + Infrastructure services.
2. Add `ICourtsCatalogService` so `CourtsController` does not use `DbContext` directly.
3. Split `apps/shell` into microfrontends per `apps/plan/FRONTEND.md`.
