using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// «وقت الإجراء» of «أعمالي» (Omar 2026-11-08): each workflow-task row carries <c>LastStepAtUtc</c>, the
/// deed's latest business milestone. The technical rows the timeline hides (the due date, task
/// bookkeeping, per-party assignment) never count — they are not a step the transaction moved by.
/// </summary>
public class WorkflowTaskLastStepTests
{
    private static readonly DateTime Now = new(2026, 11, 8, 12, 0, 0, DateTimeKind.Utc);
    private static readonly Guid PropertyId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    [Fact]
    public async Task The_row_carries_the_latest_business_milestone()
    {
        await using var db = CreateDb();
        Seed(db, withTimeline: true);

        var row = (await CreateQuery(db).ListAsync(Staff())).Single(r => r.Title == "deed-task");

        Assert.Equal(Now.AddHours(-5), DateTime.Parse(row.LastStepAtUtc!).ToUniversalTime());
        Assert.Equal("party:p1:submitted:2", row.LastStepKey);
        Assert.Equal("detail of party:p1:submitted:2", row.LastStepDetail);
    }

    [Fact]
    public async Task A_deed_with_no_milestone_has_no_last_step()
    {
        await using var db = CreateDb();
        Seed(db, withTimeline: false);

        var row = (await CreateQuery(db).ListAsync(Staff())).Single(r => r.Title == "deed-task");

        Assert.Null(row.LastStepAtUtc);
        Assert.Null(row.LastStepKey);
    }

    /// <summary>
    /// A field party's row says whether coordination accepted its package (A→Z 2026-11-09), so
    /// «أعمالي» can tell «بانتظار قبولك» from an accepted delivery; other kinds carry no flag.
    /// </summary>
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task A_party_row_carries_whether_its_package_was_accepted(bool accepted)
    {
        await using var db = CreateDb();
        Seed(db, withTimeline: false);
        var inspection = WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-1",
            Now.AddDays(-2),
            title: "inspection",
            propertyId: PropertyId,
            propertyOrdinal: 1);
        db.WorkflowTasks.Add(inspection);
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = inspection.Id,
            Kind = "field-inspection",
            Status = PartyTaskSubmissionStatus.Submitted,
            PropertyId = PropertyId,
            PoNumber = "PO-1",
            SubmittedAtUtc = Now.AddDays(-1),
            AcceptedAtUtc = accepted ? Now.AddHours(-2) : null,
            CreatedAtUtc = Now.AddDays(-2),
            UpdatedAtUtc = Now.AddHours(-2),
        });
        db.SaveChanges();

        var rows = await CreateQuery(db).ListAsync(Staff());

        Assert.Equal(accepted, rows.Single(r => r.Title == "inspection").PackageAccepted);
        Assert.Null(rows.Single(r => r.Title == "deed-task").PackageAccepted);
    }

    private static void Seed(CaseStudyDbContext db, bool withTimeline)
    {
        db.WorkOrders.Add(new WorkOrder
        {
            Id = Guid.NewGuid(),
            PoNumber = "PO-1",
            CreatedAtUtc = Now.AddDays(-3),
            ReceivedFromEnfathAt = new DateOnly(2026, 11, 1),
            Properties = [new WorkOrderProperty { Id = PropertyId, DeedNumber = "410107029844" }],
        });
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            "PO-1",
            Now.AddDays(-3),
            title: "deed-task",
            propertyId: PropertyId,
            propertyOrdinal: 1));
        if (withTimeline)
        {
            // The milestones: the distribution, then the inspector's submission (the latest).
            Entry(db, "task:t1:distribution:1", Now.AddDays(-2));
            Entry(db, "party:p1:submitted:2", Now.AddHours(-5));
            // Hidden technical rows, all newer — none may win.
            Entry(db, "due", Now.AddHours(-1));
            Entry(db, "task:t1:created", Now.AddHours(-1));
            Entry(db, "task:t1:bourse-complete", Now.AddHours(-1));
            Entry(db, "task:t1:case-study", Now.AddHours(-1));
            Entry(db, "task:t1:specialist-assigned", Now.AddHours(-1));
            Entry(db, "task:t1:blocked", Now.AddHours(-1));
            Entry(db, "party:p1:assigned", Now.AddHours(-1));
        }
        db.SaveChanges();
    }

    private static void Entry(CaseStudyDbContext db, string key, DateTime at) =>
        db.PropertyTimelineEntries.Add(new PropertyTimelineEntry
        {
            Id = Guid.NewGuid(),
            PoNumber = "PO-1",
            PropertyId = PropertyId,
            EventKey = key,
            Title = key,
            Detail = $"detail of {key}",
            OccurredAtUtc = at,
            RecordedAtUtc = at,
        });

    private static PermissionsDto Staff() => new()
    {
        UserId = "staff-1",
        PrototypeRole = "case-specialist", SubRoles = CaseSpecialistSubRoles.All,
    };

    private static CaseStudyDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<CaseStudyDbContext>()
            .UseInMemoryDatabase($"wt-last-step-{Guid.NewGuid():N}")
            .Options);

    private static WorkflowTaskQueryService CreateQuery(CaseStudyDbContext db) =>
        new(db, Options.Create(new DatabaseOptions()));
}
