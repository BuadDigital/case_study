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

## Remaining work at a glance — updated 2026-08-19 (evening)

Everything below is current after the A8 extraction marathon (2026-08-18/19).
**`dev` is fully pushed to GitHub (through `9cdbeffd`); `main` is untouched — nothing has
deployed to production yet.** Landed after the marathon, same day:

- **Identity auth-scheme fix** (`8021ac44`): `AddIdentity()` was overriding the JWT default
  scheme with its login cookie, so every `[Authorize]` endpoint on the Identity host — incl.
  `/api/permissions`, which feeds the shell role chip — returned 401 and the UI fell back to
  the hardcoded «مدير إدارة التقييم العقاري» persona under real users. Latent pre-existing
  bug, **would have shipped to production** — make sure the next `main` deploy includes it.
  Fix: bearer re-asserted after `AddIdentityStores`; verified all four suites green + live
  `/api/permissions` 200.
- **Dev upstream URLs → 127.0.0.1** (`9cdbeffd`): on this Windows box, `localhost` resolves
  to `::1` first and the firewall silently drops it → every fresh service-to-service
  connection stalled ~2s (keys page = 2 hops = ~4s after idle). Dev-only files; production
  compose uses container names and is unaffected. **Needs one stack restart to take effect**
  (options are cached at startup) — if keys/إدارة المفاتيح still feels slow on first load,
  the stack predates this fix.

**1. Needs a supervised session (A8 tail — the only substantial engineering left in the split):**

- **Physical DbContext + model + migrations moves** into the context libraries. The catalog
  blocker is removed (de-typing enabler, 2026-08-19). Order: pilot **Attachments** (smallest pin
  surface) → **Failures/Operations/Financial** (first extract a dev-seeding leaf project for
  `DataSeeder`) → **Valuation** → **Platform/Identity/CaseStudy** last (their hard-stay services
  must be unwound first). Rules: every `Migrations/` file must be a 100% rename in
  `git diff --find-renames`; never run `dotnet ef migrations add` during a move; `DbMigrate -- list`
  against a scratch copy must show all-applied/zero-pending after each move.
- **Hard-stay unwind** (unlocks the rest of Case Study): delete the `new CaseStudyLookup(...)` /
  `new CaseStudyCommands(...)` convenience ctors in the 9 financial/operations infra files, move
  `NotificationRecipientResolver.ForContexts` off `new WorkflowAssigneeLookup`, give Operations an
  HTTP path instead of registering `PropertyAccessHoldService`, and move the reporting-shared DTO
  files (`WorkOrderDtos`/`WorkflowTaskDtos`/`FieldInspectionWorkspaceDtos`/`ReportingDtos`) to
  `Shared.Contracts`.
- **Namespace alignment + global Domain/Application/Infrastructure retirement** — after the two
  items above.

**2. Waiting on Omar:**

- ~~Push authorization~~ **done 2026-08-19** — `dev` pushed as sole author (standing rule: no
  AI co-author trailers in this repo). **Next decision: deploy** — merging `dev` → `main`
  auto-deploys production with no test gate. Smoke-test first (failure lifecycle, valuation
  report preview, a notification, role chip shows real roles), then merge when ready; the
  identity auth-scheme fix should ship with it.
- **Dev system reset redesign** (explicitly parked "for later"): the old reset walked the god
  context; `DELETE /api/system/data` returns 501. The settings UI
  (`apps/mfe-settings/src/lib/system-maintenance-api.ts`) and `apps/shell/scripts/clear-all-pos.mjs`
  still call it. A working reset must fan out per owner service (or a dedicated maintenance job);
  also wire `IAuthSessionService`/`IAuditLogWriter` into `CreateIdentityMaintenanceProvider` when
  redesigning, or `DeleteAllRegisteredAsync` fails there.
- **E6** — billing negotiation deadline notifications: product policy undefined.
- **7 party-billing/Enfaz validators** — financially-shaped but bound by the case-study host;
  decide which slice owns them before moving.

**3. Gated on production/ops (not a decision, an observation window):**

- p95 / connection-pool / outbox metrics capture (section A gates block).
- Retiring the idle `realestate_eval_dev` leftover — needs the metrics gate **plus** a backup
  decision; it is the A7 restore source. Do **not** drop it, do **not** point the unsuffixed
  `REAL_ESTATE_EVAL_PG_CONNECTION_STRING` at it, do **not** run `copy-*-data.sh` /
  `drop-leftover-shared.sh` casually.
- B2 (more aggregates) and F6 (broader controller-body coverage) — open-ended, no gate.

**4. Product queue (separate track, governed by `docs/ejadah-cursor-package-v2`):**
ق-8 هندسة المبررات ← ق-6 الإصدار ثنائي المرحلة ← ق-9 آلة الحالات + المكتب الهندسي ← أصول
المنشأة المشتركة (قرار 25) ← منظومة النصوص (قرار 23).

Local run reminders: nine dedicated DBs + DbMigrate (the Failures schema is **not** migrated by
CS startup) + the upstream APIs Case Study calls. Run `npm run dev:api:run` from a human
terminal, not from an agent session.

### Reference — per-host second connections (A9 final state)

| Host | Still opens (second connection) | Do not |
| --- | --- | --- |
| Case Study | Messaging (Dev seed runs in the throwaway maintenance provider, not the request host) | `FailuresDbContext`, `OperationsDbContext`, `FinancialDbContext`; no leftover shared CS |
| Operations | Messaging | `CaseStudyDbContext`; no `depends_on` case-study |
| Financial | none of CS EF | no `depends_on` case-study (CS already `depends_on` financial) |
| Failures | ~~Case Study~~ **dropped 2026-08-18** — reads via `ICaseStudyLookup`, side effects via `ICaseStudyFailureCommands` (`/api/case-study-dispatch` POST routes); Messaging remains (D5) | no `depends_on` case-study (CS already `depends_on` failures) |
| Valuation | ~~Case Study~~ **dropped 2026-08-18** — reads go through `GET /api/case-study-dispatch/valuation-property-context/{propertyId}` (`ICaseStudyLookup.GetValuationPropertyContextAsync`) + `RemotePropertyPoNumberLookup` | no `depends_on` case-study (CS already `depends_on` valuation) |

Messaging outbox on non-Platform hosts is D5 by design.

**A8/A10 snapshot:** see the at-a-glance block at the top of this file and the A8/A10 rows below. Ops gates: migrator owner **closed (Sliman)**, D6 SQL/BI inventory **closed (empty by rule)**; still open: p95 / connection / outbox metrics.

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
| A8 | Phase 2 — split Domain / Application / Infrastructure into per-context libraries | **in progress — extraction phase done** | **All eight extraction slices landed** (Failures 2026-08-18 as the template, then Attachments, Valuation, Platform, Operations, Financial, Identity, Case Study by 2026-08-19), each verified against all four suites (Architecture 48 / Application 839 / Integration 207 / Container 26). **Messaging + Reporting closed as no-op slices** (Messaging is D5 shared plumbing registered by 2–5 hosts; Reporting lives entirely in its host with zero DB access — `ReportingHasNoDirectDatabaseAccess` guardrail); the platform-only notification handlers folded into the Platform slice. **Migration-catalog de-typing enabler landed 2026-08-19**: `ApplyOrder`/`HistorySchemaByContextName`/`ServiceNameFor` keyed by context class name; hosts enumerate `BoundedContextStreamRegistration` markers; DbMigrate + the container-test stream migrator hold concrete lists that fail loudly on drift; no migration file touched. **Template facts** (apply to every slice): `RealEstateEval.<Ctx>.{Domain,Application,Infrastructure}` under `backend/contexts/<ctx>/`, RootNamespace stays global (zero using churn), reference direction `Ctx.Infrastructure → {Ctx.Application, global Infrastructure}` and `global Infrastructure → Ctx.Application → {Ctx.Domain, global Application}` (acyclic), DbContexts+migrations still global, HTTP clients consumed by other hosts stay global, context validators register on their host via `AddValidatorsFromAssemblyContaining` (the global FV scan anchors on `PasswordLoginRequestValidator`, which must stay global), context DI in `<Ctx>DependencyInjection.cs` (SourceFacts parses those), every Dockerfile copies `backend/contexts/`. Per-slice detail lives in the eight commit messages on `dev` (2026-08-18/19). **Remaining (supervised session — see at-a-glance §1):** physical DbContext+migrations moves (pilot Attachments → Failures/Ops/Financial with a DataSeeder leaf → Valuation → Platform/Identity/CaseStudy last); the hard-stay unwind (`CaseStudyLookup`/`CaseStudyCommands` ctor `new`s in 9 financial/ops files, `NotificationRecipientResolver.ForContexts`, `PropertyAccessHoldService` on the ops host, `WorkflowTaskMapper` in DataSeeder, reporting DTOs → Shared.Contracts, shared-kernel rules `PoRoleMatrixRules`/`DocumentaryWorkflowRules`/`PartyTaskSubmissionPayloadRules` stay by design, 7 party-billing/Enfaz validators pending ownership decision); then namespace alignment and global project retirement |
| A9 | Phase 3 — remove cross-boundary DB access (owner APIs + events/projections) | **done** | Completed 2026-08-18. All cross-boundary readers/writers are on owner HTTP APIs: Platform audit append, Failures HTTP, Operations HTTP, Financial HTTP (`AddRemoteFinancial` / `/api/financial-dispatch`), Case Study HTTP for Operations/Financial (`ICaseStudyLookup` / `ICaseStudyCommands`), **Valuation** (one-call `valuation-property-context` read; `RemotePropertyPoNumberLookup`), and **Failures** (reads via `ICaseStudyLookup` incl. `po-numbers-by-assignee`; workflow/deed/timeline side effects server-side on `ICaseStudyFailureCommands` — the old flow was already non-atomic across contexts, so HTTP changed no guarantees; hold block/unblock returns `{TaskId, AssigneeId}` so Failures still notifies). No host outside Case Study opens `CaseStudyDbContext`; D10 Identity reads closed the same day. The only second connections left are the Messaging outboxes — **D5 by design, not residual**. No compose `depends_on` cycles. Owner + D6 inventory gates closed (see ops-gates block); the p95/connection/outbox metrics capture is evidence for **Phase 5**, tracked there |
| A10 | Phase 4–5 — schema/DB physical separation | **in progress** | Owner databases wired; compose apps no longer use the leftover. **Phase 5 shims removed 2026-08-18:** `ApplicationDbContext` is no longer registered by any runtime composition — `DataSeeder` was ported to the six owner contexts (also fixing a latent bug: the seed would have written to the wrong database in the split world), the seed/maintenance provider is bounded-context-only, `AddPersistence`/`AddLegacyApplicationPersistence` are deleted, the Messaging notification/outbox/inbox fallbacks are collapsed to hard `MessagingDbContext` dependencies (dual App constructors deleted), the dead `SystemMaintenanceService` is gone, and the reseed tool runs on Identity infrastructure alone. `ApplicationDbContext` survives only as the frozen legacy-stream artifact (DbMigrate optional legacy apply, design-time factory, EF-model guardrails) and as InMemory test fixtures. Remaining: retire the idle `realestate_eval_dev` leftover (A7 restore source — needs the metrics gate + a backup decision), then archive the legacy stream + context |

**Operations gates (updated 2026-08-18):**

- **Migrator owner: closed.** Owner is **Sliman (سليمان)**. Migrations apply via the DbMigrate compose job before rollout; services `depends_on` the migrate job, so a failed migration halts the deploy by construction. On failure: read the `ree-migrate` container logs, fix **forward** with a new migration — never edit or roll back an applied migration in production — and redeploy. Recovery path: Postgres volume backup / point-in-time restore per the deploy guide. Locally the same tool runs as `dotnet run --project backend/tools/DbMigrate -- update` with the nine `REAL_ESTATE_EVAL_PG_CONNECTION_STRING_{SERVICE}` env vars.
- **D6 production SQL/BI consumer inventory: closed as empty.** Nothing reads production Postgres directly: Grafana reads Prometheus, Kibana reads Elasticsearch, and all product reads go through the service APIs. **Rule:** any future dashboard, script, or tool that wants direct SQL access must be added to this inventory *before* it connects — otherwise database splits and schema changes may silently break it.
- **Still open:** capture p95 / connection-pool / outbox metrics; measure multi-context pool growth. These need a production observation window, not a decision.

---

## B. Domain and application structure

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| B1 | Stringly-typed statuses/kinds on hot paths | **done** | Fee work / case-study form / gov-review visit / property-key workflow+gate / property-list row states / timeline tones / financial revenue-row chips. Prototype-only UI strings (queue card tones, HTML aliases like `removed`) remain |
| B2 | Anemic domain (public setters, thin aggregates) | **partial** | `PropertyFailure` + fee `ApplyBillingStatus`; `KeyEnvelope` create/handoff/assignment; `WorkOrder` create/lifecycle; more aggregates still open |
| B3 | God services (~1k+ line Infrastructure services) | **done** | InspectorFee / WorkOrder / WorkflowTask / OperationsTask façades + collaborators |
| B4 | Domain depends on ASP.NET Identity | **done** | Types moved to Infrastructure; Domain has zero package refs |
| B5 | CQRS / MediatR | **deferred** | Identity + Phase 1 are done. Wait until A9 lookup/host wiring settles; a first MediatR slice would collide with DI, ServiceModule, and HTTP lookups still in motion |
| B6 | Full FluentValidation adoption | **done** | 2026-08-18: billing bodies (party billing create/close/cancel/defer, vendor invoice submit/reject, PO-enfaz revenue lines incl. nested line rules) gained FluentValidation validators — they previously had no caps at all. The valuation save bodies already carry `[Required]`/`[MaxLength]` DataAnnotations enforced recursively by `[ApiController]`; converting them to FluentValidation would be stylistic churn with regression risk and is deliberately not done. Boundary coverage is complete |
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
| D10 | Cross-boundary Identity *reads* still on legacy context | **done** | 2026-08-18: every request path resolves labels via `IdentityDbContext` (Identity host) or the HTTP identity directory (all other hosts). The `ApplicationDbContext` leg of `UserLabelLookup`/`PersonLabelResolver` was removed; `AddLegacyApplicationPersistence` requires Identity for labels. The god context itself survives only in the seed/maintenance provider and reseed tool (Phase 5 scope) |
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
| E7 | Physical notification DB separation | **done** | Dedicated `realestate_eval_messaging`; Case Study drains that outbox. 2026-08-18: the last god-context messaging path (the dead `SystemMaintenanceService`) was deleted with the Phase 5 shim removal — no code touches messaging tables outside `MessagingDbContext` |

---

## F. Testing, ops, hygiene

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| F1 | CI PR gate + deploy smoke + safer prune | **done** | |
| F2 | Migrations off Production startup + DbMigrate | **done** | |
| F3 | Production observability Compose | **done** | OTel → Jaeger/Prometheus/Grafana; Fluent Bit → ES |
| F4 | Compose healthchecks + Docker image hygiene | **done** | |
| F5 | Testcontainers (Postgres / Rabbit / Redis) | **done** | Opt-out via `REAL_ESTATE_EVAL_CONTAINER_TESTS=0` |
| F6 | Broader controller-body coverage | **partial** | Added work-orders list, ops create 400, key-envelope / failures create validation. 2026-08-18: `CaseStudyDispatchPostgresTests` covers the A9 dispatch surface over HTTP against real Postgres — valuation property context (200 + 404), po-numbers-by-assignee, hold block/unblock (task status flips + assignee reported), deed-status by failure identifiers, and timeline-record idempotency |
| F7 | Coverlet in CI | **done** | Soft floor documented |
| F8 | Readiness logging + deeper dependency checks | **done** | `/ready` logs DB failures. Soft Rabbit + Redis TCP probes (`Readiness:CheckRabbit` / `CheckRedis`) report in the body and never flip HTTP 503. Blob storage is not probed |
| F9 | Serilog / structured JSON correlation | **done** | Built-in JSON console (not Serilog) outside Dev with `CorrelationId` + `Service` scopes and trace/span ids. Validated `X-Correlation-Id`; gateway overwrites on proxy; `HttpClient` forwards on owner lookups |
| F10 | Seeder uses ILogger | **done** | |
| F11 | Dead `AddInfrastructure` registration | **done** | |
| F12 | Reseed tool in solution | **done** | |
| F13 | README CI file claim | **done** | |
| F14 | Empty / “Sync” repair migrations cleanup | **done** | Documented: never delete applied empty baselines; keep as history seeds only |
| F15 | Integration factories mutate process env | **done** | |
| F16 | Container-test suite: 6 pre-existing failures | **done** | Found and fixed 2026-08-18 (failures predated that day's work). Causes and fixes: (1) tests applied only the frozen legacy stream, but post-cutover columns (`WorkOrder.ClientId` etc.) live in the per-context streams → new `BoundedContextStreamMigrator` applies every stream like the deploy migrator (migration, readiness, and controller-body setups). (2) The container-test env lacked `RabbitMQ:RequireEnabled=false` for the new Production event-broker guard. (3) A9's HTTP lookups meant Operations/Financial hosts dialed a nonexistent Case Study server → the test factory re-points `ICaseStudyLookup`/`IWorkflowAssigneeLookup`/`IIdentityDirectory` at EF implementations over the shared test DB, with the contexts registered as **keyed** services so the remaining equal-arity EF/interface constructor pairs don't turn ambiguous. Suite: 21/21 green. Residual hazard noted: those dual-constructor pairs (e.g. `PropertyKeysService`) are latent DI ambiguities — remove them like the 2026-08-18 boot fix did |

---

## F14 — empty / Sync migrations (hygiene policy)

Do **not** delete empty baselines or Sync no-ops once they exist in a stream people may have applied (`*Initial*Baseline`, `SyncFinancialAuditLog`, legacy `SyncPendingModelChangesAug2026*`, messaging baseline, etc.). They seed per-context `__EFMigrationsHistory` without DDL. Future empty migrations must stay commented no-ops; cleanup is documentation-only.

---

## G. Suggested order — updated 2026-08-19

1. **Smoke-test + push** — restart the stack (human terminal), verify failure lifecycle /
   valuation report preview / a notification, then Omar authorizes the push of the ~23 `dev`
   commits (push to `main` auto-deploys production).
2. **Supervised A8 tail session** — physical context moves (pilot Attachments) and the
   hard-stay unwind, per the at-a-glance §1 plan. Never touch migration file contents; renames
   only.
3. **Production metrics window** — capture p95 / connection-pool / outbox metrics (section A
   gates block); afterwards decide the `realestate_eval_dev` retirement (backup first — it is
   the A7 restore source).
4. **Product queue** — ق-8 ← ق-6 ← ق-9 per the v2 package, any time; it does not conflict
   with the A8 tail.
5. **Open-ended / parallel:** F6 controller-body coverage, B2 aggregates, dev-reset redesign
   (when Omar un-parks it), E6 after product defines deadline/escalation rules.
6. **Standing "do nots":** no `ApplicationDbContext` on request hosts; no cross-context EF
   opens (Case Study must not open Failures/Operations/Financial contexts and vice versa); no
   new compose `depends_on` cycles; no shared-DB connection reintroduction.

---

## H. How to pick up

```bash
git clone https://github.com/BuadDigital/case_study.git
cd case_study
git pull
# Read these first:
#   docs/remaining-work.md          (this file — the at-a-glance block first)
#   docs/status/architecture-split-status.md
#   docs/architecture-split-plan.md
```

After finishing an item: set its status here, update the architecture status file if it was an A-item, run Architecture + Application (+ Integration/Container when relevant) tests, then commit.
