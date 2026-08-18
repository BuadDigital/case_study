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
| A3 | Phase 1 step 3 — Failures + Operations contexts; replace Case Study / Identity / Financial reads | **done** | `FailuresDbContext` / `OperationsDbContext` + empty baselines; writers dual with legacy for financial/case-study cross-writes; pure services on own context |
| A4 | Phase 1 step 4 — Financial + Case Study contexts | **done** | `FinancialDbContext` / `CaseStudyDbContext` + empty baselines; legacy cutover advanced to tip of post-cutover fee/pricing migrations; dual writers still use ApplicationDbContext until pure service moves (A3 pattern residual); hosts register both streams |
| A5 | Phase 1 step 5 — Messaging (per-producer outbox / per-consumer inbox shape) | **done** | `MessagingDbContext` + empty baseline; Platform notifications/push/outbox/inbox on Messaging; Valuation still maps own outbox (D5); Case Study dispatcher claims via legacy App against same table |
| A6 | Phase 1 exit — every API stops registering legacy `AddPersistence` write path | **done** | Hosts use `AddHostSharedInfrastructure` + owned persistence; no service `ServiceModule` calls `AddPersistence`. Closeout: [`backend/plan/A6_CLOSEOUT.md`](../backend/plan/A6_CLOSEOUT.md). Transitional `ApplicationDbContext` shims in Infrastructure remain until A9 |
| A7 | ADR 0006 deploy migrator vs restored production-like DB (incl. `xmin` SQL) | **done** | Idle leftover `realestate_eval_dev` on host Postgres 17.9 `:5432` (apps no longer use it after the Phase 4 dedicated-DB split). Copied to `realestate_eval_a7_scratch`; `DbMigrate` applied legacy then bounded-context streams including `20260729104156_AddOptimisticConcurrencyTokens`. `xmin` is DDL-neutral (no user column; system `xmin` readable). Source leftover left untouched. |
| A8 | Phase 2 — split Domain / Application / Infrastructure into per-context libraries | **todo** | Phase 1 host wiring is done; start a slice after A9 pressure eases |
| A9 | Phase 3 — remove cross-boundary DB access (owner APIs + events/projections) | **in progress** | Lookup residuals that drop a second connection plus Platform audit append, Failures HTTP, Operations HTTP, Financial HTTP (`AddRemoteFinancial` / `/api/financial-dispatch`), and Case Study HTTP for Operations and **Financial** (`ICaseStudyLookup` / `ICaseStudyCommands` / `/api/case-study-dispatch`). Case Study and Operations no longer open `FinancialDbContext`. Operations and **Financial** no longer open `CaseStudyDbContext` (no compose `depends_on` case-study; CS already `depends_on` financial). **Failures** keeps CS EF (compose cycle with CS→Failures HTTP plus FailureService workflow/timeline/deed patches). **Valuation** keeps CS EF (report fill/issuance still load property/form aggregates). Write residuals: CS Messaging (+ Dev Identity); Ops Messaging; Failures Case Study + Messaging; Valuation Case Study. Gates: D6 consumers |
| A10 | Phase 4–5 — schema/DB physical separation | **in progress** | Owner databases are wired; compose apps no longer use the leftover. Idle `realestate_eval_dev` still exists on host Postgres `:5432` (A7 restore source; not dropped). Remaining work is Phase 3 residual readers and Phase 5 shims |

**Operations gates still outstanding (block remaining A9 / Phase 5, not A6):** nominate API/migrator owners; D6 production SQL/BI/role inventory; capture p95 / connection / outbox metrics; measure multi-context pool growth.

---

## B. Domain and application structure

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| B1 | Stringly-typed statuses/kinds on hot paths | **done** | Fee work / case-study form / gov-review visit / property-key workflow+gate / property-list row states / timeline tones / financial revenue-row chips. Prototype-only UI strings (queue card tones, HTML aliases like `removed`) remain |
| B2 | Anemic domain (public setters, thin aggregates) | **partial** | `PropertyFailure` + fee `ApplyBillingStatus`; `KeyEnvelope` create/handoff/assignment; `WorkOrder` create/lifecycle; more aggregates still open |
| B3 | God services (~1k+ line Infrastructure services) | **done** | InspectorFee / WorkOrder / WorkflowTask / OperationsTask façades + collaborators |
| B4 | Domain depends on ASP.NET Identity | **done** | Types moved to Infrastructure; Domain has zero package refs |
| B5 | CQRS / MediatR | **deferred** | Identity + Phase 1 are done. Wait until A9 lookup/host wiring settles; a first MediatR slice would collide with DI, ServiceModule, and HTTP lookups still in motion |
| B6 | Full FluentValidation adoption | **partial** | Boundary validators cover identity, attachments, work-order headers, ops create/patch/reassign/comment, key envelope create/assign/confirm/handoff, failures create/note/resolve/bourse, courts catalog, org settings, clients, inspection limits, fee-table create. Residual: nested valuation/billing bodies |
| B7 | Repository boundary | **deferred** | Style choice; not required while EF + services remain the pattern |
| B8 | `DateTime.UtcNow` testability | **done** | Production clocks go through injected `TimeProvider` (`time.UtcNow()` / `GetUtcNow()`). Architecture test covers Application, Infrastructure Services/Integration, and service controllers. Seeder, migrations, and tests keep wall-clock `DateTime.UtcNow` |
| B9 | Duplicated `Program.cs` / claim extraction | **done** | One shared `ServiceProgram.cs` linked into all nine APIs; each host keeps a `ServiceModule`. Actor id/role go through `ActorIdentity` / `ActorClaims` |
| B10 | DTO naming inconsistency | **done** | Convention: `Dto` / `Request` / `Query` / `Input` / `Actor`. Outliers renamed (`LoginResponseDto`, `*ResponseDto`). JSON properties unchanged; TS keeps deprecated aliases |

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
| C10 | API versioning inconsistency | **done** | Unversioned `/api/...` is canonical v1; `CanonicalV1AliasConvention` adds `/v1` aliases. Controllers declare one template. No Asp.Versioning for v1 |
| C11 | Inconsistent error shapes (all controllers) | **done** | Hand-written failures use `ApiProblemExtensions` (RFC 7807 + legacy `error`/`message`/`errors`). Architecture test forbids ad-hoc anonymous bodies |

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
| D10 | Cross-boundary Identity *reads* still on legacy context | **partial** | `IUserLabelLookup` on failures, work-order query/property cmds, ops task query/notifier; fee/profile/report residual App reads until A9 |
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
| E6 | Billing negotiation deadline notifications | **blocked** | Product policy still undefined — freeze documented in notification reliability doc |
| E7 | Physical notification DB separation | **partial** | Dedicated `realestate_eval_messaging`; Case Study drains that outbox. Seed/maintenance may still count notifications through the god context until A9/A10 shims go |

---

## F. Testing, ops, hygiene

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| F1 | CI PR gate + deploy smoke + safer prune | **done** | |
| F2 | Migrations off Production startup + DbMigrate | **done** | |
| F3 | Production observability Compose | **done** | OTel → Jaeger/Prometheus/Grafana; Fluent Bit → ES |
| F4 | Compose healthchecks + Docker image hygiene | **done** | |
| F5 | Testcontainers (Postgres / Rabbit / Redis) | **done** | Opt-out via `REAL_ESTATE_EVAL_CONTAINER_TESTS=0` |
| F6 | Broader controller-body coverage | **partial** | Added work-orders list, ops create 400, key-envelope / failures create validation |
| F7 | Coverlet in CI | **done** | Soft floor documented |
| F8 | Readiness logging + deeper dependency checks | **done** | `/ready` logs DB failures. Soft Rabbit + Redis TCP probes (`Readiness:CheckRabbit` / `CheckRedis`) report in the body and never flip HTTP 503. Blob storage is not probed |
| F9 | Serilog / structured JSON correlation | **done** | Built-in JSON console (not Serilog) outside Dev with `CorrelationId` + `Service` scopes and trace/span ids. Validated `X-Correlation-Id`; gateway overwrites on proxy; `HttpClient` forwards on owner lookups |
| F10 | Seeder uses ILogger | **done** | |
| F11 | Dead `AddInfrastructure` registration | **done** | |
| F12 | Reseed tool in solution | **done** | |
| F13 | README CI file claim | **done** | |
| F14 | Empty / “Sync” repair migrations cleanup | **done** | Documented: never delete applied empty baselines; keep as history seeds only |
| F15 | Integration factories mutate process env | **done** | |

---

## F14 — empty / Sync migrations (hygiene policy)

Do **not** delete empty baselines or Sync no-ops once they exist in a stream people may have applied (`*Initial*Baseline`, `SyncFinancialAuditLog`, legacy `SyncPendingModelChangesAug2026*`, messaging baseline, etc.). They seed per-context `__EFMigrationsHistory` without DDL. Future empty migrations must stay commented no-ops; cleanup is documentation-only.

---

## G. Suggested order on the next device

1. **Continue A9** — next residual readers: Failures compose cycle (do not add Failures `depends_on` Case Study), Valuation report fill. Do not open `FailuresDbContext`, `OperationsDbContext`, or `FinancialDbContext` from Case Study. Do not add Operations `depends_on` Case Study. Do not add Financial `depends_on` Case Study. Financial no longer opens Case Study EF.  
2. **Ops gates still open** — A7 leftover-upgrade evidence is recorded. Remaining: nominate migrator owner, D6 SQL/BI inventory, p95 / connection / outbox metrics.  
3. **Parallel low-risk slices:** F6 controller-body tests. C10, C11, B1, B8, B10, F8, and F9 are done. B6 still has nested valuation/billing bodies.  
4. **A10 leftover shared DB is gone.** Do not reintroduce a shared connection. Remaining A10 work is Phase 5 shims. Full D10 cutover and E6 still wait on product/ops gates.  
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
