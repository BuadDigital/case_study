using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Read-side ownership: a party may only read its own task payloads, case staff read everything.
/// Denial is expressed as "not found" so callers cannot probe for existence.
/// </summary>
public class PartyTaskSubmissionReadAuthorizationTests
{
    private static readonly Guid OwnedTaskId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid ForeignTaskId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000002");
    private static readonly Guid PropertyId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    private static readonly PartySubmissionActor Owner = new()
    {
        UserId = "user-owner",
        DisplayName = "المكلف",
        PrototypeRole = "engineering-office",
        DistributionAssigneeId = "dist-owner",
    };

    private static readonly PartySubmissionActor CaseStaff = new()
    {
        UserId = "user-staff",
        DisplayName = "أخصائي",
        PrototypeRole = "case-specialist",
    };

    [Fact]
    public async Task Get_returns_submission_for_assigned_party()
    {
        await using var db = CreateDb();
        Seed(db);

        var dto = await CreateService(db).GetAsync(OwnedTaskId, Owner);

        Assert.NotNull(dto);
    }

    [Fact]
    public async Task Get_hides_submission_from_other_party()
    {
        await using var db = CreateDb();
        Seed(db);

        var dto = await CreateService(db).GetAsync(ForeignTaskId, Owner);

        Assert.Null(dto);
    }

    [Fact]
    public async Task Get_returns_any_submission_for_case_staff()
    {
        await using var db = CreateDb();
        Seed(db);

        var dto = await CreateService(db).GetAsync(ForeignTaskId, CaseStaff);

        Assert.NotNull(dto);
    }

    [Fact]
    public async Task List_drops_tasks_the_party_cannot_read()
    {
        await using var db = CreateDb();
        Seed(db);

        var rows = await CreateService(db).ListForTasksAsync(
            [OwnedTaskId, ForeignTaskId],
            Owner);

        Assert.Single(rows);
        Assert.Equal(OwnedTaskId.ToString(), rows[0].TaskId);
    }

    [Fact]
    public async Task List_returns_all_tasks_for_case_staff()
    {
        await using var db = CreateDb();
        Seed(db);

        var rows = await CreateService(db).ListForTasksAsync(
            [OwnedTaskId, ForeignTaskId],
            CaseStaff);

        Assert.Equal(2, rows.Count);
    }

    private static void Seed(ApplicationDbContext db)
    {
        AddTaskWithSubmission(db, OwnedTaskId, "dist-owner");
        AddTaskWithSubmission(db, ForeignTaskId, "dist-other");
        db.SaveChanges();
    }

    private static void AddTaskWithSubmission(
        ApplicationDbContext db,
        Guid taskId,
        string assigneeId)
    {
        var now = DateTime.UtcNow;
        db.WorkflowTasks.Add(new WorkflowTask
        {
            Id = taskId,
            Kind = "engineering-survey",
            PoNumber = "PO-READ",
            PropertyId = PropertyId,
            PropertyOrdinal = 1,
            Title = "الرفع المساحي",
            Phase = "survey",
            Status = WorkflowTaskStatus.Open,
            AssigneeId = assigneeId,
            AssigneeRole = "engineering-office",
            AssigneeName = "مكتب هندسي",
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = taskId,
            Kind = "engineering-survey",
            Status = PartyTaskSubmissionStatus.Draft,
            PropertyId = PropertyId,
            PoNumber = "PO-READ",
            PayloadJson = """{"status":"draft"}""",
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
    }

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"party-read-auth-{Guid.NewGuid():N}")
            .Options;
        return new ApplicationDbContext(options);
    }

    private static PartyTaskSubmissionService CreateService(ApplicationDbContext db)
    {
        var holds = new PropertyAccessHoldService(db);
        var (notifications, recipients) = TestInspectorFeeServiceFactory.CreateNotificationDeps(db);
        return new(
            db,
            TestInspectorFeeServiceFactory.CreateWorkflow(db),
            new FieldInspectionAttachmentVerifier(db),
            new PropertyTimelineService(db),
            new NullHttpContextAccessor(),
            new NullPermissionService(),
            new PropertyKeyGateResolver(db),
            new KeyEnvelopesService(db, holds),
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
            => Task.FromResult<PermissionsDto?>(null);
    }
}

/// <summary>
/// Case-study form reads. A party reaches the parent form through its own child task because the
/// party workspace seeds itself from the specialist's answers.
/// </summary>
public class CaseStudyFormReadAuthorizationTests
{
    private static readonly Guid ParentTaskId = Guid.Parse("cccccccc-0000-0000-0000-000000000001");
    private static readonly Guid PartyTaskId = Guid.Parse("cccccccc-0000-0000-0000-000000000002");
    private static readonly Guid ForeignPartyTaskId = Guid.Parse("cccccccc-0000-0000-0000-000000000003");
    private static readonly Guid PropertyId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");

    private static readonly CaseStudyFormActor Party = new()
    {
        UserId = "user-party",
        DisplayName = "طرف",
        PrototypeRole = "engineering-office",
        DistributionAssigneeId = "dist-party",
    };

    /// <summary>A party on a different PO entirely — no task under this parent.</summary>
    private static readonly CaseStudyFormActor Outsider = new()
    {
        UserId = "user-unrelated",
        DisplayName = "طرف آخر",
        PrototypeRole = "engineering-office",
        DistributionAssigneeId = "dist-unrelated",
    };

    [Fact]
    public async Task GetParty_returns_own_form()
    {
        await using var db = CreateDb();
        Seed(db);

        var dto = await CreateFormService(db).GetAsync(PartyTaskId, party: true, Party);

        Assert.NotNull(dto);
    }

    [Fact]
    public async Task GetParty_hides_other_partys_form()
    {
        await using var db = CreateDb();
        Seed(db);

        var dto = await CreateFormService(db).GetAsync(ForeignPartyTaskId, party: true, Party);

        Assert.Null(dto);
    }

    [Fact]
    public async Task Get_parent_form_visible_to_assigned_child_party()
    {
        await using var db = CreateDb();
        Seed(db);

        var dto = await CreateFormService(db).GetAsync(ParentTaskId, party: false, Party);

        Assert.NotNull(dto);
    }

    [Fact]
    public async Task Get_parent_form_hidden_from_unrelated_party()
    {
        await using var db = CreateDb();
        Seed(db);

        var dto = await CreateFormService(db).GetAsync(ParentTaskId, party: false, Outsider);

        Assert.Null(dto);
    }

    [Fact]
    public async Task Get_parent_form_visible_to_case_staff()
    {
        await using var db = CreateDb();
        Seed(db);

        var dto = await CreateFormService(db).GetAsync(
            ParentTaskId,
            party: false,
            new CaseStudyFormActor { UserId = "staff", PrototypeRole = "case-specialist" });

        Assert.NotNull(dto);
    }

    private static void Seed(ApplicationDbContext db)
    {
        var now = DateTime.UtcNow;
        db.WorkflowTasks.AddRange(
            NewTask(ParentTaskId, "case-study-property", "dist-specialist", null),
            NewTask(PartyTaskId, "engineering-survey", "dist-party", ParentTaskId),
            NewTask(ForeignPartyTaskId, "engineering-survey", "dist-outsider", ParentTaskId));

        db.CaseStudyForms.AddRange(
            new CaseStudyForm
            {
                Id = Guid.NewGuid(),
                TaskId = ParentTaskId,
                IsPartyForm = false,
                Status = "draft",
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            },
            new CaseStudyForm
            {
                Id = Guid.NewGuid(),
                TaskId = PartyTaskId,
                IsPartyForm = true,
                Status = "draft",
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            },
            new CaseStudyForm
            {
                Id = Guid.NewGuid(),
                TaskId = ForeignPartyTaskId,
                IsPartyForm = true,
                Status = "draft",
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        db.SaveChanges();
    }

    private static WorkflowTask NewTask(Guid id, string kind, string assigneeId, Guid? parentTaskId)
    {
        var now = DateTime.UtcNow;
        return new WorkflowTask
        {
            Id = id,
            Kind = kind,
            PoNumber = "PO-FORM-READ",
            PropertyId = PropertyId,
            PropertyOrdinal = 1,
            Title = kind,
            Phase = "enfath",
            Status = WorkflowTaskStatus.Open,
            AssigneeId = assigneeId,
            ParentTaskId = parentTaskId,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };
    }

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"case-study-form-read-{Guid.NewGuid():N}")
            .Options;
        return new ApplicationDbContext(options);
    }

    private static CaseStudyFormService CreateFormService(ApplicationDbContext db)
    {
        var timeline = new PropertyTimelineService(db);
        var valuation = new ValuationRequestService(
            db,
            new OutboxIntegrationEventPublisher(db, NullLogger<OutboxIntegrationEventPublisher>.Instance));
        var dispatch = new CaseStudyValuationDispatchService(
            db,
            valuation,
            timeline,
            NullLogger<CaseStudyValuationDispatchService>.Instance);
        return new CaseStudyFormService(
            db,
            dispatch,
            TestInspectorFeeServiceFactory.CreateWorkflow(db));
    }
}
