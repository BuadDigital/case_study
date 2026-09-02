using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Failures.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class PartyTaskSubmissionAcceptTests
{
    private static readonly Guid TaskId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static readonly Guid PropertyId = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");

    [Fact]
    public async Task Accept_sets_AcceptedAtUtc_and_exposes_it_on_the_dto()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        SeedAcceptedableSurvey(db);
        var service = CreateService(db, bundle.Failures, bundle.Ops);

        var (result, errors) = await service.AcceptAsync(
            TaskId,
            new PartySubmissionActor
            {
                UserId = "specialist-1",
                DisplayName = "أخصائي",
                PrototypeRole = "case-specialist",
            });

        Assert.Null(errors);
        Assert.NotNull(result);
        Assert.False(string.IsNullOrWhiteSpace(result!.AcceptedAtUtc));

        var entity = await db.PartyTaskSubmissions.AsNoTracking()
            .SingleAsync(s => s.WorkflowTaskId == TaskId);
        Assert.NotNull(entity.AcceptedAtUtc);
    }

    [Fact]
    public async Task Accept_keeps_the_first_acceptance_timestamp_on_re_accept()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        SeedAcceptedableSurvey(db);
        var service = CreateService(db, bundle.Failures, bundle.Ops);

        var actor = new PartySubmissionActor
        {
            UserId = "specialist-1",
            DisplayName = "أخصائي",
            PrototypeRole = "case-specialist",
        };
        var (first, _) = await service.AcceptAsync(TaskId, actor);
        var (second, _) = await service.AcceptAsync(TaskId, actor);

        Assert.NotNull(first);
        Assert.NotNull(second);
        Assert.Equal(first!.AcceptedAtUtc, second!.AcceptedAtUtc);
    }

    [Fact]
    public async Task Get_returns_null_AcceptedAtUtc_before_acceptance()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        SeedAcceptedableSurvey(db);
        var service = CreateService(db, bundle.Failures, bundle.Ops);

        var dto = await service.GetAsync(TaskId);

        Assert.NotNull(dto);
        Assert.Null(dto!.AcceptedAtUtc);
    }

    [Fact]
    public async Task Accept_field_inspection_sets_AcceptedAtUtc_without_fee_ledger()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        SeedAcceptedableFieldInspection(db);
        var service = CreateService(db, bundle.Failures, bundle.Ops);

        var (result, errors) = await service.AcceptAsync(
            TaskId,
            new PartySubmissionActor
            {
                UserId = "specialist-1",
                DisplayName = "أخصائي",
                PrototypeRole = "case-specialist",
            });

        Assert.Null(errors);
        Assert.NotNull(result);
        Assert.False(string.IsNullOrWhiteSpace(result!.AcceptedAtUtc));

        var entity = await db.PartyTaskSubmissions.AsNoTracking()
            .SingleAsync(s => s.WorkflowTaskId == TaskId);
        Assert.NotNull(entity.AcceptedAtUtc);
        Assert.Equal("specialist-1", entity.AcceptedByUserId);
        Assert.Equal("أخصائي", entity.AcceptedByName);

        var fin = TestInspectorFeeServiceFactory.ShareFinancial(db);
        Assert.False(await fin.InspectorFeeLedgers.AnyAsync(l => l.WorkflowTaskId == TaskId));
    }

    private static void SeedAcceptedableFieldInspection(CaseStudyDbContext db)
    {
        var now = DateTime.UtcNow;
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-501",
            now,
            title: "معاينة",
            phase: WorkflowTaskPhase.Done,
            status: WorkflowTaskStatus.Completed,
            id: TaskId,
            propertyId: PropertyId));
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = TaskId,
            Kind = "field-inspection",
            Status = PartyTaskSubmissionStatus.Submitted,
            PropertyId = PropertyId,
            PoNumber = "PO-501",
            PayloadJson = "{}",
            SubmittedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        db.SaveChanges();
    }

    private static void SeedAcceptedableSurvey(CaseStudyDbContext db)
    {
        var now = DateTime.UtcNow;
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.EngineeringSurvey,
            "PO-500",
            now,
            title: "الرفع المساحي",
            phase: WorkflowTaskPhase.Done,
            status: WorkflowTaskStatus.Completed,
            id: TaskId,
            propertyId: PropertyId));
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = TaskId,
            Kind = "engineering-survey",
            Status = PartyTaskSubmissionStatus.Submitted,
            PropertyId = PropertyId,
            PoNumber = "PO-500",
            PayloadJson = "{}",
            SubmittedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
 // Ledger already accrued: the fee guard short-circuits so acceptance
 // exercises only the new AcceptedAtUtc persistence, no pricing needed.
        var fin = TestInspectorFeeServiceFactory.ShareFinancial(db);
        fin.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = TaskId,
            PoNumber = "PO-500",
            PropertyId = PropertyId,
            PropertyOrdinal = 1,
            InspectorType = "متعاون فرد",
            AgreedFeeSar = 1500m,
            BillingStatus = InspectorFeeBillingStatus.AtFinance,
            AccruedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        db.SaveChanges();
        fin.SaveChanges();
    }

    private static TestBoundedContexts.Bundle CreateDb() =>
        TestBoundedContexts.Create($"party-accept-{Guid.NewGuid():N}");

    private static PartyTaskSubmissionService CreateService(CaseStudyDbContext db, FailuresDbContext failures, OperationsDbContext __)
    {
        var timeline = TestInspectorFeeServiceFactory.CreateTimeline(db);
        var (notifications, recipients) = TestInspectorFeeServiceFactory.CreateNotificationDeps(db);
        return new(
            new PartyTaskSubmissionRepository(db),
            new PartyTaskFailureGate(new FailureLookup(failures)),
            TestInspectorFeeServiceFactory.CreateWorkflow(db),
            new FieldInspectionAttachmentVerifier(TestInspectorFeeServiceFactory.ShareAttachmentLookup(db)),
            timeline,
            new HttpCurrentPrototypeRoleResolver(new NullHttpContextAccessor(), new NullPermissionService()),
            TestInspectorFeeServiceFactory.Create(db),
            notifications,
            recipients);
    }

    private sealed class NullHttpContextAccessor : IHttpContextAccessor
    {
        public HttpContext? HttpContext { get; set; }
    }

    private sealed class NullPermissionService : IPermissionService
    {
        public Task<PermissionsDto?> GetForUserIdAsync(string userId, CancellationToken cancellationToken = default)
        {
            return Task.FromResult<PermissionsDto?>(null);
        }
    }
}
