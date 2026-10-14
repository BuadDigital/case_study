using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Application.Services;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Integration;
using RealEstateEval.Valuation.Infrastructure.Persistence;
using RealEstateEval.Valuation.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The appraiser's submission is a hand-over to the case specialist: from then until the package is
/// returned every valuation write is closed on the server, the task stays open, and the request
/// closes (publishing the one delivery event) only with the final issuance.
/// </summary>
public class ValuationAppraiserHandOverLockTests
{
    // ---- the gate ----

    [Theory]
    [InlineData("submitted", true)]
    [InlineData("draft", false)]
    [InlineData("reopened", false)]
    [InlineData("none", false)]
    public async Task The_gate_locks_exactly_while_the_package_is_submitted(string packageStatus, bool locked)
    {
        await using var contexts = TestDatabases.Create("lock-gate");
        var (requestId, propertyId) = NewRequest(contexts.Valuation, "VR-L1");
        await contexts.Valuation.SaveChangesAsync();
        var gate = new ValuationReportFreezeGate(contexts.Valuation, LookupReturning(packageStatus));

        var message = await gate.GetFrozenMessageAsync(requestId, propertyId);

        Assert.Equal(locked ? ValuationReportFreezeRules.AppraiserSubmittedMessageAr : null, message);
    }

    [Fact]
    public async Task An_unknown_state_from_an_older_case_study_host_does_not_lock()
    {
        await using var contexts = TestDatabases.Create("lock-gate-unknown");
        var (requestId, propertyId) = NewRequest(contexts.Valuation, "VR-L2");
        await contexts.Valuation.SaveChangesAsync();
        var gate = new ValuationReportFreezeGate(contexts.Valuation, LookupProxy.Create(() => null));

        Assert.Null(await gate.GetFrozenMessageAsync(requestId, propertyId));
    }

    [Fact]
    public async Task The_gate_fails_closed_when_the_state_cannot_be_read()
    {
        await using var contexts = TestDatabases.Create("lock-gate-down");
        var (requestId, propertyId) = NewRequest(contexts.Valuation, "VR-L3");
        await contexts.Valuation.SaveChangesAsync();
        var gate = new ValuationReportFreezeGate(
            contexts.Valuation,
            LookupProxy.Create(() => throw new HttpRequestException("case-study down")));

        Assert.Equal(
            ValuationReportFreezeRules.PackageStateUnavailableMessageAr,
            await gate.GetFrozenMessageAsync(requestId, propertyId));
    }

    [Fact]
    public async Task Without_a_lookup_only_the_deposit_layer_applies()
    {
        await using var contexts = TestDatabases.Create("lock-gate-none");
        var (requestId, propertyId) = NewRequest(contexts.Valuation, "VR-L4");
        await contexts.Valuation.SaveChangesAsync();

        Assert.Null(await new ValuationReportFreezeGate(contexts.Valuation).GetFrozenMessageAsync(requestId, propertyId));
    }

    [Fact]
    public async Task The_deposit_layer_is_reported_first_and_needs_no_remote_read()
    {
        await using var contexts = TestDatabases.Create("lock-gate-deposit");
        var (requestId, propertyId) = NewRequest(contexts.Valuation, "VR-L5");
        contexts.Valuation.ValuationReportIssuances.Add(ValuationReportIssuance.IssueDeposit(
            requestId, "{}", "staff", DateTime.UtcNow));
        await contexts.Valuation.SaveChangesAsync();
        var gate = new ValuationReportFreezeGate(
            contexts.Valuation,
            LookupProxy.Create(() => throw new InvalidOperationException("must not be called")));

        Assert.Equal(
            ValuationReportFreezeRules.FrozenMessageAr,
            await gate.GetFrozenMessageAsync(requestId, propertyId));
    }

    // ---- a write use case is refused with the gate's reason ----

    [Fact]
    public async Task A_valuation_write_is_refused_while_the_package_is_submitted_and_allowed_once_returned()
    {
        await using var contexts = TestDatabases.Create("lock-write");
        var (requestId, propertyId) = NewRequest(contexts.Valuation, "VR-L6");
        SeedAppraisal(contexts.CaseStudy, propertyId, PartyTaskSubmissionStatus.Submitted);
        await contexts.Valuation.SaveChangesAsync();
        var service = new ValuationComparableSelectionService(
            new ValuationComparableSelectionRepository(contexts.Valuation),
            new ValuationReportFreezeGate(contexts.Valuation, new CaseStudyLookup(contexts.CaseStudy)),
            new StubOrganizationSettings());

        var request = new SaveAdjustmentFactorRationaleRequest
        {
            SelectionContext = "market",
            FactorKey = "financing",
            RationaleAr = "شروط التمويل مماثلة",
        };

        var (refused, errors) = await service.SaveFactorRationaleAsync(requestId, request, "user-1");
        Assert.Null(refused);
        Assert.Equal(ValuationReportFreezeRules.AppraiserSubmittedMessageAr, errors!["_"]);

        // The specialist returns the package for correction: the lock lifts.
        var package = await contexts.CaseStudy.PartyTaskSubmissions.SingleAsync();
        package.Status = PartyTaskSubmissionStatus.Reopened;
        await contexts.CaseStudy.SaveChangesAsync();

        var (saved, savedErrors) = await service.SaveFactorRationaleAsync(requestId, request, "user-1");
        Assert.Null(savedErrors);
        Assert.NotNull(saved);
    }

    [Fact]
    public async Task Recording_an_impediment_is_a_valuation_write_too()
    {
        await using var contexts = TestDatabases.Create("lock-impediment");
        var (requestId, propertyId) = NewRequest(contexts.Valuation, "VR-L7");
        SeedAppraisal(contexts.CaseStudy, propertyId, PartyTaskSubmissionStatus.Submitted);
        await contexts.Valuation.SaveChangesAsync();
        var service = new ValuationRequestService(
            contexts.Valuation,
            new ValuationOutboxPublisher(contexts.Valuation, NullLogger<ValuationOutboxPublisher>.Instance),
            new StubPoNumberLookup(),
            freeze: new ValuationReportFreezeGate(contexts.Valuation, new CaseStudyLookup(contexts.CaseStudy)));

        var (result, error) = await service.RecordImpedimentAsync(
            requestId, new ValuationImpedimentRequest { Reason = "تعذّر الوصول" });

        Assert.Null(result);
        Assert.Equal(
            $"{ValuationReportFreezeRules.LockedErrorPrefix}{ValuationReportFreezeRules.AppraiserSubmittedMessageAr}",
            error);
        Assert.Equal(ValuationRequestStatus.Progress, (await contexts.Valuation.ValuationRequests.SingleAsync()).Status);
    }

    // ---- the lookup ----

    [Fact]
    public async Task The_case_study_lookup_reports_the_latest_appraisal_package_status()
    {
        await using var contexts = TestDatabases.Create("lock-lookup");
        var propertyId = Guid.NewGuid();
        var lookup = new CaseStudyLookup(contexts.CaseStudy);

        var none = await lookup.GetAppraisalPackageStateAsync(propertyId);
        Assert.Equal(AppraisalPackageStates.None, none!.PackageStatus);
        Assert.Null(none.TaskId);

        var taskId = SeedAppraisal(contexts.CaseStudy, propertyId, PartyTaskSubmissionStatus.Submitted);
        var submitted = await lookup.GetAppraisalPackageStateAsync(propertyId);
        Assert.Equal(PartyTaskSubmissionStatus.Submitted, submitted!.PackageStatus);
        Assert.Equal(taskId, submitted.TaskId);
        Assert.Equal("open", submitted.TaskStatus);
    }

    // ---- final issuance closes the request, once ----

    [Fact]
    public async Task The_final_issuance_publishes_the_delivery_event_once_and_a_corrective_registration_does_not()
    {
        await using var contexts = TestDatabases.Create("lock-final");
        var db = contexts.Valuation;
        var (requestId, _) = NewRequest(db, "VR-L8");
        await db.SaveChangesAsync();
        var service = IssuanceService(db);

        await service.IssueDepositAsync(requestId, "user-1");
        var (_, errors) = await service.RegisterCertificateAsync(requestId, Certificate("QYM-1"), "appraiser-1");
        Assert.Null(errors);

        var (_, corrected) = await service.RegisterCertificateAsync(requestId, Certificate("QYM-1-FIX"), "appraiser-1");
        Assert.Null(corrected);

        db.ChangeTracker.Clear();
        Assert.Single(db.OutboxMessages.Where(x => x.EventType == IntegrationEventTypes.ValuationReportSubmitted));
        Assert.Equal("QYM-1-FIX", (await db.ValuationReportIssuances.SingleAsync()).DepositCode);
    }

    [Theory]
    [InlineData("draft")]
    [InlineData("reopened")]
    public async Task The_deposit_steps_need_the_package_handed_over_first(string packageStatus)
    {
        await using var contexts = TestDatabases.Create("lock-handover-" + packageStatus);
        var (requestId, propertyId) = NewRequest(contexts.Valuation, "VR-L9");
        await contexts.Valuation.SaveChangesAsync();
        var service = IssuanceService(contexts.Valuation, LookupReturning(packageStatus), propertyId);

        var (_, errors) = await service.IssueDepositAsync(requestId, "user-1");

        Assert.Equal("سلّم التقييم للأخصائي أولاً", errors!["_"]);
        Assert.Empty(contexts.Valuation.ValuationReportIssuances);
    }

    [Fact]
    public async Task The_deposit_steps_proceed_once_the_package_is_submitted()
    {
        await using var contexts = TestDatabases.Create("lock-handover-ok");
        var (requestId, propertyId) = NewRequest(contexts.Valuation, "VR-L10");
        await contexts.Valuation.SaveChangesAsync();
        var service = IssuanceService(contexts.Valuation, LookupReturning("submitted"), propertyId);

        var (deposit, errors) = await service.IssueDepositAsync(requestId, "user-1");
        Assert.Null(errors);
        Assert.Equal(ReportIssuanceStages.DepositIssued, deposit!.Stage);

        var (final, finalErrors) = await service.RegisterCertificateAsync(requestId, Certificate("QYM-2"), "appraiser-1");
        Assert.Null(finalErrors);
        Assert.Equal(ReportIssuanceStages.FinalIssued, final!.Stage);
    }

    // ---- the request service ----

    [Fact]
    public async Task Ensure_open_returns_the_closed_request_instead_of_minting_a_second_one()
    {
        await using var contexts = TestDatabases.Create("lock-ensure-open");
        var db = contexts.Valuation;
        var propertyId = Guid.NewGuid();
        db.ValuationRequests.Add(ValuationRequest.Create(
            Guid.NewGuid(), "VR-L11", propertyId, "جدة", "فيلا", "مقيم", "2026-06-25",
            DateTime.UtcNow, ValuationRequestStatus.Done));
        await db.SaveChangesAsync();
        var service = new ValuationRequestService(
            db,
            new ValuationOutboxPublisher(db, NullLogger<ValuationOutboxPublisher>.Instance),
            new StubPoNumberLookup());

        var (result, error) = await service.EnsureOpenByPropertyAsync(new SaveValuationRequestRequest
        {
            PropId = propertyId.ToString("D"),
            Area = "جدة",
            Type = "فيلا",
            Appraiser = "مقيم",
            Date = "2026-10-05",
        });

        Assert.Null(error);
        Assert.Equal("VR-L11", result!.DisplayId);
        Assert.Equal("done", result.Status);
        Assert.Equal(1, await db.ValuationRequests.CountAsync());
    }

    [Fact]
    public async Task The_open_request_read_says_whether_the_report_is_frozen_as_the_deposit_copy()
    {
        await using var contexts = TestDatabases.Create("lock-stage");
        var db = contexts.Valuation;
        var (requestId, propertyId) = NewRequest(db, "VR-L13");
        await db.SaveChangesAsync();
        var service = new ValuationRequestService(
            db,
            new ValuationOutboxPublisher(db, NullLogger<ValuationOutboxPublisher>.Instance),
            new StubPoNumberLookup());

        var draft = await service.GetOpenByPropertyAsync(propertyId.ToString("D"));
        Assert.Equal(ValuationReportStageWire.Draft, draft!.ReportStage);

        db.ValuationReportIssuances.Add(ValuationReportIssuance.IssueDeposit(requestId, "{}", "u", DateTime.UtcNow));
        await db.SaveChangesAsync();
        var frozen = await service.GetOpenByPropertyAsync(propertyId.ToString("D"));
        Assert.Equal(ValuationReportStageWire.DepositIssued, frozen!.ReportStage);
    }

    [Fact]
    public void The_wire_stages_match_the_valuation_stages()
    {
        Assert.Equal(ReportIssuanceStages.Draft, ValuationReportStageWire.Draft);
        Assert.Equal(ReportIssuanceStages.DepositIssued, ValuationReportStageWire.DepositIssued);
        Assert.Equal(ReportIssuanceStages.FinalIssued, ValuationReportStageWire.FinalIssued);
    }

    [Fact]
    public async Task The_manual_submit_route_needs_a_final_issuance()
    {
        await using var contexts = TestDatabases.Create("lock-submit-route");
        var db = contexts.Valuation;
        var (requestId, _) = NewRequest(db, "VR-L12");
        await db.SaveChangesAsync();
        var service = new ValuationRequestService(
            db,
            new ValuationOutboxPublisher(db, NullLogger<ValuationOutboxPublisher>.Instance),
            new StubPoNumberLookup());

        var (result, error) = await service.SubmitReportAsync(requestId);

        Assert.Null(result);
        Assert.Equal("final_issuance_required", error);
        Assert.Equal(ValuationRequestStatus.Progress, (await db.ValuationRequests.SingleAsync()).Status);
    }

    // ---- helpers ----

    private static (Guid RequestId, Guid PropertyId) NewRequest(
        RealEstateEval.Valuation.Infrastructure.Data.Contexts.ValuationDbContext db,
        string displayId)
    {
        var id = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        db.ValuationRequests.Add(ValuationRequest.Create(
            id, displayId, propertyId, "جدة", "فيلا", "مقيم", "2026-06-25", DateTime.UtcNow));
        return (id, propertyId);
    }

    private static Guid SeedAppraisal(
        RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudyDbContext db,
        Guid propertyId,
        string packageStatus)
    {
        var taskId = Guid.NewGuid();
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.PropertyAppraisal, "PO-L", DateTime.UtcNow, title: "تقييم",
            phase: WorkflowTaskPhase.Done, id: taskId, propertyId: propertyId));
        var package = PartyTaskSubmission.CreateDraft(
            taskId, WorkflowTaskKindValues.PropertyAppraisal, propertyId, "PO-L", DateTime.UtcNow);
        package.Status = packageStatus;
        db.PartyTaskSubmissions.Add(package);
        db.SaveChanges();
        return taskId;
    }

    private static ICaseStudyLookup LookupReturning(string packageStatus) =>
        LookupProxy.Create(() => new CaseStudyAppraisalPackageStateDto { PackageStatus = packageStatus });

    private static ValuationReportIssuanceService IssuanceService(
        RealEstateEval.Valuation.Infrastructure.Data.Contexts.ValuationDbContext db,
        ICaseStudyLookup? caseStudy = null,
        Guid? propertyId = null) =>
        new(
            db,
            new StubGates(),
            new StubDocuments(),
            events: new ValuationOutboxPublisher(db, NullLogger<ValuationOutboxPublisher>.Instance),
            caseStudy: caseStudy);

    private static RegisterDepositCertificateRequest Certificate(string code) => new()
    {
        DepositCode = code,
        CertificateFileName = "certificate.pdf",
        CertificateContentType = "application/pdf",
        CertificateContentBase64 = TestPdf.OnePageBase64,
    };

    /// <summary>Answers only the package-state read; any other lookup call is a test bug.</summary>
    private class LookupProxy : DispatchProxy
    {
        private Func<CaseStudyAppraisalPackageStateDto?> _answer = () => null;

        public static ICaseStudyLookup Create(Func<CaseStudyAppraisalPackageStateDto?> answer)
        {
            var proxy = DispatchProxy.Create<ICaseStudyLookup, LookupProxy>();
            ((LookupProxy)(object)proxy)._answer = answer;
            return proxy;
        }

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod?.Name == nameof(ICaseStudyLookup.GetAppraisalPackageStateAsync))
                return Task.FromResult(_answer());
            throw new NotImplementedException(targetMethod?.Name);
        }
    }

    private sealed class StubGates : IValuationIssuanceGateService
    {
        public Task<ValuationIssuanceGatesDto?> EvaluateAsync(
            Guid valuationRequestId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<ValuationIssuanceGatesDto?>(new ValuationIssuanceGatesDto
            {
                ValuationRequestId = valuationRequestId,
                AllowsIssuance = true,
                BlockingReasonsAr = [],
            });
    }

    private sealed class StubDocuments : IValuationReportDocumentService
    {
        public Task<ValuationReportDocumentDto?> GetPreviewAsync(
            Guid valuationRequestId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<ValuationReportDocumentDto?>(new ValuationReportDocumentDto
            {
                ValuationRequestId = valuationRequestId,
                DisplayId = "VR-TEST",
                ReportDateDisplay = "2026/10/05",
                FinalOpinionDisplay = "1,000,000 ريال",
                Sections = [],
            });
    }

    private sealed class StubPoNumberLookup : IPropertyPoNumberLookup
    {
        public Task<string> ResolveForPropertyAsync(
            string propertyId,
            CancellationToken cancellationToken = default) => Task.FromResult("PO-L");
    }

    private sealed class StubOrganizationSettings : IOrganizationSettingsService
    {
        public Task<OrganizationSettingsDto> GetAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(new OrganizationSettingsDto());

        public Task<OrganizationSettingsDto> GetInternalAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(new OrganizationSettingsDto());

        public Task<OrganizationSettingsDto> SaveAsync(
            SaveOrganizationSettingsRequest request,
            string actorId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new OrganizationSettingsDto());

        public Task<OrganizationSettingsDto> SyncStaffValuerAsync(
            SyncStaffValuerRequest request,
            string actorId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new OrganizationSettingsDto());
    }
}
