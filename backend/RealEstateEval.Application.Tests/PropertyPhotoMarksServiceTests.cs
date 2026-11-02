using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Mapping;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>2026-11-01: the specialist marks the main photo, the meters and the report's photos.</summary>
public class PropertyPhotoMarksServiceTests
{
    private const string Po = "PO-MARKS";
    private static readonly Guid PropertyId = Guid.Parse("33333333-aaaa-aaaa-aaaa-333333333333");

    private static readonly PartySubmissionActor Specialist =
        new() { UserId = "spec-1", DisplayName = "الأخصائي", PrototypeRole = "case-specialist" };

    private static CaseStudyDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<CaseStudyDbContext>()
            .UseInMemoryDatabase($"photo-marks-{Guid.NewGuid():N}", new InMemoryDatabaseRoot())
            .Options);

    private static void Seed(CaseStudyDbContext db, string? reportStatus = null)
    {
        var now = DateTime.UtcNow;
        var order = new WorkOrder
        {
            Id = Guid.NewGuid(),
            PoNumber = Po,
            AssignmentType = AssignmentType.Execution,
            PromulgationDate = DateOnly.FromDateTime(now),
            ReceivedFromEnfathAt = DateOnly.FromDateTime(now),
            DueDateAt = DateOnly.FromDateTime(now.AddDays(7)),
            CreatedAtUtc = now,
        };
        db.WorkOrders.Add(order);
        db.WorkOrderProperties.Add(new WorkOrderProperty { Id = PropertyId, WorkOrderId = order.Id, DeedNumber = "DEED" });
        if (reportStatus is not null)
        {
            db.CaseStudyReports.Add(new CaseStudyReport
            {
                Id = Guid.NewGuid(),
                TaskId = Guid.NewGuid(),
                PropertyId = PropertyId,
                PoNumber = Po,
                Status = reportStatus,
            });
        }

        db.SaveChanges();
    }

    private sealed class RecordingAuditLog : IAuditLogAppend
    {
        public List<AuditLog> Entries { get; } = [];

        public Task AppendAsync(AuditLog entry, CancellationToken cancellationToken = default)
        {
            Entries.Add(entry);
            return Task.CompletedTask;
        }
    }

    private static (PropertyPhotoMarksService Service, RecordingAuditLog Log) CreateService(CaseStudyDbContext db)
    {
        var log = new RecordingAuditLog();
        return (new PropertyPhotoMarksService(new PropertyPhotoMarksRepository(db), new AuditLogWriter(), log), log);
    }

    private static PropertyPhotoMarksDto Marks(string? main = "a1") =>
        new() { Main = main, Electricity = ["a2"], Water = ["a3"], Report = ["a1", "a2"] };

    [Fact]
    public async Task Saves_the_marks_and_returns_them_with_the_property()
    {
        using var db = CreateDb();
        Seed(db);
        var (service, log) = CreateService(db);

        var (result, errors) = await service.SaveAsync(Po, PropertyId, Marks(), Specialist, default);

        Assert.Null(errors);
        Assert.Equal("a1", result!.Main);
        var stored = PropertyPhotoMarksRules.Parse(db.WorkOrderProperties.Single().PhotoMarksJson);
        Assert.Equal(["a2"], stored.Electricity);
        Assert.Equal(["a1", "a2"], stored.Report);
        Assert.Equal("case-study.property.photo-marks-saved", Assert.Single(log.Entries).Action);
    }

    [Fact]
    public async Task Saving_the_same_marks_writes_no_audit_row()
    {
        using var db = CreateDb();
        Seed(db);
        var (service, log) = CreateService(db);

        await service.SaveAsync(Po, PropertyId, Marks(), Specialist, default);
        await service.SaveAsync(Po, PropertyId, Marks(), Specialist, default);

        Assert.Single(log.Entries);
    }

    [Fact]
    public async Task Clearing_every_mark_stores_nothing()
    {
        using var db = CreateDb();
        Seed(db);
        var (service, _) = CreateService(db);

        await service.SaveAsync(Po, PropertyId, Marks(), Specialist, default);
        await service.SaveAsync(Po, PropertyId, new PropertyPhotoMarksDto(), Specialist, default);

        Assert.Null(db.WorkOrderProperties.Single().PhotoMarksJson);
    }

    [Fact]
    public async Task An_issued_study_refuses_the_save()
    {
        using var db = CreateDb();
        Seed(db, CaseStudyReportStatuses.Issued);
        var (service, _) = CreateService(db);

        var (result, errors) = await service.SaveAsync(Po, PropertyId, Marks(), Specialist, default);

        Assert.Null(result);
        Assert.Equal(CaseStudyReportService.ReportIssuedReopenFirstAr, errors!["_"]);
        Assert.Null(db.WorkOrderProperties.Single().PhotoMarksJson);
    }

    [Fact]
    public async Task A_study_still_in_draft_takes_the_save()
    {
        using var db = CreateDb();
        Seed(db, CaseStudyReportStatuses.Draft);
        var (service, _) = CreateService(db);

        var (_, errors) = await service.SaveAsync(Po, PropertyId, Marks(), Specialist, default);

        Assert.Null(errors);
    }

    [Fact]
    public async Task A_property_of_another_order_is_not_found()
    {
        using var db = CreateDb();
        Seed(db);
        var (service, _) = CreateService(db);

        var (_, errors) = await service.SaveAsync("PO-OTHER", PropertyId, Marks(), Specialist, default);

        Assert.Equal("العقار غير موجود", errors!["_"]);
    }

    [Fact]
    public void One_photo_holds_one_role()
    {
        var errors = PropertyPhotoMarksRules.Validate(new PropertyPhotoMarksDto
        {
            Main = "a1",
            Electricity = ["a1"],
        });

        Assert.Contains("_", errors.Keys);
    }

    [Fact]
    public void A_meter_may_still_print_in_the_report()
    {
        var errors = PropertyPhotoMarksRules.Validate(new PropertyPhotoMarksDto
        {
            Electricity = ["a1"],
            Report = ["a1"],
        });

        Assert.Empty(errors);
    }

    [Theory]
    [InlineData(12, true)]
    [InlineData(13, false)]
    public void The_report_takes_twelve_photos(int count, bool valid)
    {
        var errors = PropertyPhotoMarksRules.Validate(new PropertyPhotoMarksDto
        {
            Report = Enumerable.Range(0, count).Select(i => $"a{i}").ToList(),
        });

        Assert.Equal(valid, errors.Count == 0);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("{broken")]
    public void A_blank_or_broken_column_reads_as_no_marks(string? json)
    {
        var marks = PropertyPhotoMarksRules.Parse(json);

        Assert.Null(marks.Main);
        Assert.Empty(marks.Report);
    }

    [Fact]
    public void Blank_and_repeated_ids_are_dropped()
    {
        var json = PropertyPhotoMarksRules.Serialize(new PropertyPhotoMarksDto
        {
            Main = " ",
            Report = ["a1", " a1 ", ""],
        });

        Assert.Equal(["a1"], PropertyPhotoMarksRules.Parse(json).Report);
    }

    [Fact]
    public void The_property_response_carries_the_marks()
    {
        var dto = WorkOrderMapper.ToPropertyDto(new WorkOrderProperty
        {
            PhotoMarksJson = PropertyPhotoMarksRules.Serialize(Marks()),
        });

        Assert.Equal("a1", dto.PhotoMarks!.Main);
    }
}
