# A6 Phase 1 Exit - Closeout Proof

Date: 2026-08-18

## Result

A6 Phase 1 exit is complete for host wiring:

- No backend service host calls `AddPersistence(...)`.
- Hosts use `AddHostSharedInfrastructure(...)` + owned bounded-context persistence registrations.
- `case-study` no longer registers the legacy `ApplicationDbContext` pool.

## Grep Evidence

### 1) No host uses AddPersistence

Search:

`rg "AddPersistence\\(" backend/services`

Result:

- No matches found.

### 2) All service hosts use AddHostSharedInfrastructure

Search:

`rg "AddHostSharedInfrastructure\\(" backend/services`

Result includes:

- `backend/services/case-study/RealEstateEval.CaseStudy.Api/Program.cs`
- `backend/services/platform/RealEstateEval.Platform.Api/Program.cs`
- `backend/services/attachments/RealEstateEval.Attachments.Api/Program.cs`
- `backend/services/operations/RealEstateEval.Operations.Api/Program.cs`
- `backend/services/failures/RealEstateEval.Failures.Api/Program.cs`
- `backend/services/financial/RealEstateEval.Financial.Api/Program.cs`
- `backend/services/identity/RealEstateEval.Identity.Api/Program.cs`
- `backend/services/valuation/RealEstateEval.Valuation.Api/Program.cs`

### 3) Remaining ApplicationDbContext references in Infrastructure services are intentional

Search:

`rg "ApplicationDbContext" backend/RealEstateEval.Infrastructure/Services -l`

Result:

- `backend/RealEstateEval.Infrastructure/Services/PersonLabelResolver.cs` (compat overload)
- `backend/RealEstateEval.Infrastructure/Services/SystemMaintenanceService.cs` (maintenance/dev path)
- `backend/RealEstateEval.Infrastructure/Services/UserLabelLookup.cs` (legacy fallback ctor; DI prefers Identity)

### 4) Case-study host does not require ApplicationDbContext at runtime wiring

Search:

`rg "ApplicationDbContext" backend/services/case-study/RealEstateEval.CaseStudy.Api/Program.cs`

Result:

- Only a comment about legacy migration ownership by deploy job.

## Verification

Command:

`dotnet build backend -c Release --no-restore`

Result:

- Build succeeded.
- 0 warnings, 0 errors.

## Notes

- Legacy `ApplicationDbContext` migration remains the responsibility of deploy-time `DbMigrate`.
- Transitional compatibility shims remain by design and are not host registration dependencies.
