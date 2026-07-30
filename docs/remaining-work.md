# Remaining work

Canonical backlog of unfinished items after the 2026-07 audit remediation wave
(commit `04360a0` and earlier). Update this file when an item moves; do not treat a
partial slice as done.

**Companion docs**

| Doc | Role |
| --- | --- |
| [`architecture-split-plan.md`](architecture-split-plan.md) | How to finish the shared-DB / god-context / shared-assembly split |
| [`status/architecture-split-status.md`](status/architecture-split-status.md) | Honest Phase 1 progress |
| [`architecture/table-ownership-catalog.md`](architecture/table-ownership-catalog.md) | Table owners and gates |
| [`notification-architecture-reliability.md`](notification-architecture-reliability.md) | Notification residual gaps |
| [`adr/`](adr/) | Decisions already taken |

Status values: **todo** · **in progress** · **blocked** · **deferred** · **done**

---

## A. Architecture split (High — plan-driven)

Source of truth: [`architecture-split-plan.md`](architecture-split-plan.md).

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| A1 | Phase 1 step 1 — Attachments, Platform catalogs, Valuation contexts | **done** | Empty baselines; write path on owned contexts |
| A2 | Phase 1 step 2 — Identity context + claims permissions on other APIs | **done** | `IdentityDbContext`; `AddClaimsPermissionService` |
| A3 | Phase 1 step 3 — Failures + Operations contexts; replace Case Study / Identity / Financial reads | **todo** | Next extraction slice |
| A4 | Phase 1 step 4 — Financial + Case Study contexts | **todo** | Largest / most entangled; after contracts/projections |
| A5 | Phase 1 step 5 — Messaging (per-producer outbox / per-consumer inbox shape) | **todo** | Valuation already maps its own outbox (D5) |
| A6 | Phase 1 exit — every API stops registering legacy `AddPersistence` write path | **todo** | Cannot close until A3–A5 done |
| A7 | ADR 0006 deploy migrator vs restored production-like DB (incl. `xmin` SQL) | **blocked** | Needs a production restore; blank-DB half is done |
| A8 | Phase 2 — split Domain / Application / Infrastructure into per-context libraries | **todo** | After Phase 1 exit for a slice |
| A9 | Phase 3 — remove cross-boundary DB access (owner APIs + events/projections) | **todo** | Gates: A7 inventory metrics; D6 consumers |
| A10 | Phase 4–5 — schema/DB physical separation when ready | **todo** | Do not start until Phase 3 exit |

**Operations gates still outstanding (block Phase 3/4, not A3):** nominate API/migrator owners; D6 production SQL/BI/role inventory; capture p95 / connection / outbox metrics; measure multi-context pool growth.

---

## B. Domain and application structure

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| B1 | Stringly-typed statuses/kinds on hot paths | **partial** | Workflow / operations / valuation enums landed; more entities still use magic strings |
| B2 | Anemic domain (public setters, thin aggregates) | **partial** | Some factories/private setters on WorkflowTask, OperationsTask, ValuationRequest; large surface remains |
| B3 | God services (~1k+ line Infrastructure services) | **partial** | Rules + collaborators extracted from six largest; InspectorFee / Workflow / WorkOrder still ~1k |
| B4 | Domain depends on ASP.NET Identity | **done** | Types moved to Infrastructure; Domain has zero package refs |
| B5 | CQRS / MediatR | **deferred** | Intentional; introduce one vertical slice only after Identity + Phase 1 stabilize |
| B6 | Full FluentValidation adoption | **partial** | Auth, activation, attachments, work-order writes wired; not every DTO |
| B7 | Repository boundary | **deferred** | Style choice; not required while EF + services remain the pattern |
| B8 | `DateTime.UtcNow` testability | **todo** | Sprinkle clock abstraction only where time rules are tested |
| B9 | Duplicated `Program.cs` / claim extraction | **partial** | Shared extensions exist; residual call sites remain |
| B10 | DTO naming inconsistency | **deferred** | Shared with frontend; rename only with contract version |

---

## C. Security and API surface

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| C1 | Passwordless / weak auth path | **done** | Email/password + activation tickets |
| C2 | JWT key committed / secret fallbacks | **done** | |
| C3 | Systemic IDOR on reads | **done** | Capability + ownership scoping |
| C4 | Refresh tokens / revocation | **done** | |
| C5 | Rate limiting / security headers / CORS / gateway readiness | **done** | |
| C6 | Temp passwords in create-user API | **done** | Activation ticket flow |
| C7 | Attachment MIME trusts client | **done** | Magic-byte inspector |
| C8 | Billing / pricing leak exception messages | **done** | ProblemDetails + logging |
| C9 | JWT package outdated | **done** | 8.22.0 |
| C10 | API versioning inconsistency | **partial** | Unversioned financial/reporting aliases = canonical v1; `/v1` kept; formal versioning package not required yet |
| C11 | Inconsistent error shapes (all controllers) | **partial** | Touched endpoints + shared helpers; legacy `error`/`errors` kept for compatibility |

---

## D. Data, performance, messaging

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| D1 | Unbounded lists | **done** | Caps / paging |
| D2 | Financial summary in-memory scan | **done** | DB-side aggregation |
| D3 | Notification fan-out N+1 | **done** | |
| D4 | Optimistic concurrency | **done** | `xmin` + HTTP 409 |
| D5 | Multi-step transitions without transactions | **done** | Key paths |
| D6 | Outbox double-deliver / poison / silent disabled broker | **done** | |
| D7 | Missing indexes + race conditions | **done** | Sequence, partial unique indexes, migration |
| D8 | Cache stampede | **done** | Per-process single-flight |
| D9 | Reporting HTTP resilience | **done** | Timeout / retry / circuit breaker |
| D10 | Cross-boundary Identity *reads* still on legacy context | **todo** | Fees, notifications labels, financial reports — Phase 3 (A9) |
| D11 | Notification uniqueness index race ownership | **done** | Filtered unique index + conflict handling |

---

## E. Notifications product gaps

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| E1 | Tone / entity type contract mismatch | **done** | Canonical contract + legacy maps |
| E2 | Platform-owned write stepping stone | **done** | Events → Platform persist |
| E3 | Failures outbox dispatch | **done** | Shared dispatcher; no competing host |
| E4 | Multi-instance SSE | **done** | Rabbit fan-out + poll fallback |
| E5 | Browser storage user-namespaced | **done** | |
| E6 | Billing negotiation deadline notifications | **blocked** | No product timing/escalation policy — see [`notification-architecture-reliability.md`](notification-architecture-reliability.md) |
| E7 | Physical notification DB separation | **todo** | Needs per-service dispatchers at cutover (A5 / A10) |

---

## F. Testing, ops, hygiene

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| F1 | CI PR gate + deploy smoke + safer prune | **done** | |
| F2 | Migrations off Production startup + DbMigrate | **done** | |
| F3 | Production observability Compose | **done** | OTel → Jaeger/Prometheus/Grafana; Fluent Bit → ES |
| F4 | Compose healthchecks + Docker image hygiene | **done** | |
| F5 | Testcontainers (Postgres / Rabbit / Redis) | **done** | Opt-out via `REAL_ESTATE_EVAL_CONTAINER_TESTS=0` |
| F6 | Broader controller-body coverage | **todo** | ~10 actions / 8 controllers today; expand ContainerTests |
| F7 | Coverlet in CI | **done** | Soft floor documented |
| F8 | Readiness logging + deeper dependency checks | **partial** | DB readiness improved; Rabbit/Redis/blob not all probed |
| F9 | Serilog / structured JSON correlation | **partial** | JSON logs + validated correlation IDs outside Dev |
| F10 | Seeder uses ILogger | **done** | |
| F11 | Dead `AddInfrastructure` registration | **done** | |
| F12 | Reseed tool in solution | **done** | |
| F13 | README CI file claim | **done** | |
| F14 | Empty / “Sync” repair migrations cleanup | **todo** | Hygiene when touching migration stream |
| F15 | Integration factories mutate process env | **done** | |

---

## G. Suggested order on the next device

1. **Continue Phase 1** — A3 (Failures + Operations), then A4, then A5 → close A6.  
2. **Keep A7 / ops gates visible** — do not invent a production restore; mark progress when available.  
3. **Parallel low-risk slices** when not touching the same files as A3–A5:  
   - F6 controller-body tests  
   - B1/B3 more enums + service extraction  
   - F8 readiness depth  
4. **Do not start** A8–A10 or B5 until Phase 1 exit criteria hold for the slices you care about.  
5. **E6** only after product defines deadline/escalation rules.

---

## H. How to pick up

```bash
git clone https://github.com/BuadDigital/case_study.git
cd case_study
git pull
# Read these first:
#   docs/remaining-work.md          (this file)
#   docs/status/architecture-split-status.md
#   docs/architecture-split-plan.md
```

After finishing an item: set its status here, update the architecture status file if it was an A-item, run Architecture + Application (+ Integration/Container when relevant) tests, then commit.
