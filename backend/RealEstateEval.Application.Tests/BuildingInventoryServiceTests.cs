using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class BuildingInventoryServiceTests
{
    private const string Po = "PO-INV";
    private static readonly Guid PropertyId = Guid.Parse("11111111-aaaa-aaaa-aaaa-111111111111");
    private static readonly Guid TaskId = Guid.Parse("22222222-aaaa-aaaa-aaaa-222222222222");

    private static PartySubmissionActor Inspector(string userId = "insp-1") =>
        new() { UserId = userId, DisplayName = "المعاين", PrototypeRole = "field-inspector" };

    private static PartySubmissionActor Specialist() =>
        new() { UserId = "spec-1", DisplayName = "الأخصائي", PrototypeRole = "case-specialist" };

    private static CaseStudyDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<CaseStudyDbContext>()
            .UseInMemoryDatabase($"inventory-{Guid.NewGuid():N}", new InMemoryDatabaseRoot())
            .Options);

    private static BuildingInventoryService CreateService(CaseStudyDbContext db) =>
        new(new BuildingInventoryRepository(db));

    /// <summary>A property with one field-inspection task assigned to insp-1 in the given package status (null = no package row).</summary>
    private static void Seed(CaseStudyDbContext db, string? packageStatus = PartyTaskSubmissionStatus.Draft,
        WorkflowTaskStatus taskStatus = WorkflowTaskStatus.Open, string? specialistText = "نص الأخصائي")
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
        db.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = PropertyId,
            WorkOrderId = order.Id,
            DeedNumber = "DEED-INV",
            SpecialistComponentsText = specialistText,
        });
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            Po,
            now,
            status: taskStatus,
            id: TaskId,
            propertyId: PropertyId,
            assigneeId: "insp-1"));
        if (packageStatus is not null)
        {
            db.PartyTaskSubmissions.Add(new PartyTaskSubmission
            {
                Id = Guid.NewGuid(),
                WorkflowTaskId = TaskId,
                Kind = "field-inspection",
                Status = packageStatus,
                PropertyId = PropertyId,
                PoNumber = Po,
                PayloadJson = "{}",
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        }

        db.SaveChanges();
    }

    private static SaveBuildingInventoryRequest Request(string? text, params BuildingInventoryLineDto[] lines) =>
        new() { ComponentsText = text, Lines = [.. lines] };

    private static BuildingInventoryLineDto Line(string label, Guid? id = null) =>
        new() { Id = id, StructureKind = "floor", Label = label, AreaSqm = "100" };

    // ---- access resolution ----

    [Fact]
    public async Task Access_follows_the_assignment_and_the_package_status()
    {
        await using var db = CreateDb();
        Seed(db);
        var service = CreateService(db);

        Assert.Equal(BuildingInventoryWriteAccess.Inspector,
            await service.ResolveWriteAccessAsync(Po, PropertyId, Inspector(), default));
        Assert.Equal(BuildingInventoryWriteAccess.Denied,
            await service.ResolveWriteAccessAsync(Po, PropertyId, Inspector("insp-2"), default));
        Assert.Equal(BuildingInventoryWriteAccess.Staff,
            await service.ResolveWriteAccessAsync(Po, PropertyId, Specialist(), default));
        Assert.Equal(BuildingInventoryWriteAccess.Denied,
            await service.ResolveWriteAccessAsync(
                Po, PropertyId,
                new PartySubmissionActor { UserId = "insp-1", PrototypeRole = "engineering-office" }, default));
    }

    [Fact]
    public async Task A_task_with_no_package_row_yet_is_a_draft()
    {
        await using var db = CreateDb();
        Seed(db, packageStatus: null);

        Assert.Equal(BuildingInventoryWriteAccess.Inspector,
            await CreateService(db).ResolveWriteAccessAsync(Po, PropertyId, Inspector(), default));
    }

    [Fact]
    public async Task A_submitted_package_denies_the_inspector_and_a_reopened_one_reopens_access()
    {
        await using var db = CreateDb();
        Seed(db, PartyTaskSubmissionStatus.Submitted, WorkflowTaskStatus.Completed);
        var service = CreateService(db);

        Assert.Equal(BuildingInventoryWriteAccess.Denied,
            await service.ResolveWriteAccessAsync(Po, PropertyId, Inspector(), default));

        var package = db.PartyTaskSubmissions.Single();
        package.Status = PartyTaskSubmissionStatus.Reopened;
        db.SaveChanges();

        Assert.Equal(BuildingInventoryWriteAccess.Inspector,
            await service.ResolveWriteAccessAsync(Po, PropertyId, Inspector(), default));
    }

    [Fact]
    public async Task A_cancelled_inspection_task_gives_the_inspector_nothing()
    {
        await using var db = CreateDb();
        Seed(db, PartyTaskSubmissionStatus.Draft, WorkflowTaskStatus.Cancelled);

        Assert.Equal(BuildingInventoryWriteAccess.Denied,
            await CreateService(db).ResolveWriteAccessAsync(Po, PropertyId, Inspector(), default));
    }

    [Fact]
    public async Task The_inspector_reads_only_his_assigned_property()
    {
        await using var db = CreateDb();
        Seed(db, PartyTaskSubmissionStatus.Submitted, WorkflowTaskStatus.Completed);
        var service = CreateService(db);

        Assert.True(await service.CanReadAsync(Po, PropertyId, Inspector(), default));
        Assert.False(await service.CanReadAsync(Po, PropertyId, Inspector("insp-2"), default));
        Assert.True(await service.CanReadAsync(Po, PropertyId, Specialist(), default));
    }

    // ---- save ----

    [Fact]
    public async Task The_inspector_saves_the_table_but_his_components_text_is_ignored()
    {
        await using var db = CreateDb();
        Seed(db, specialistText: "نص الأخصائي");
        var service = CreateService(db);

        var (result, errors) = await service.SaveAsync(
            Po, PropertyId, Request("نص المعاين الذي يُتجاهل", Line("الدور الأرضي")),
            BuildingInventoryWriteAccess.Inspector, default, Inspector());

        Assert.Null(errors);
        Assert.Equal("نص الأخصائي", result!.ComponentsText);
        var line = Assert.Single(result.Lines);
        Assert.Equal("field-inspector", line.Provenance!.WrittenByRole);
        Assert.Equal("insp-1", line.Provenance.WrittenByUserId);
        Assert.Equal(HasStructuresToValueValues.Yes, result.HasStructuresToValue);
        Assert.Equal("نص الأخصائي", db.WorkOrderProperties.Single().SpecialistComponentsText);
    }

    [Fact]
    public async Task The_inspector_cannot_blank_the_specialists_text_with_an_empty_string()
    {
        await using var db = CreateDb();
        Seed(db, specialistText: "نص الأخصائي");

        var (result, errors) = await CreateService(db).SaveAsync(
            Po, PropertyId, Request("", Line("ملحق")),
            BuildingInventoryWriteAccess.Inspector, default, Inspector());

        Assert.Null(errors);
        Assert.Equal("نص الأخصائي", result!.ComponentsText);
    }

    [Fact]
    public async Task Staff_still_write_the_text()
    {
        await using var db = CreateDb();
        Seed(db, specialistText: null);

        var (result, errors) = await CreateService(db).SaveAsync(
            Po, PropertyId, Request("مكونات", Line("الدور الأرضي")),
            BuildingInventoryWriteAccess.Staff, default, Specialist());

        Assert.Null(errors);
        Assert.Equal("مكونات", result!.ComponentsText);
    }

    [Fact]
    public async Task A_line_the_specialist_edits_stays_attributed_to_the_inspector_who_wrote_it()
    {
        await using var db = CreateDb();
        Seed(db);
        var service = CreateService(db);

        var (created, _) = await service.SaveAsync(
            Po, PropertyId, Request(null, Line("الدور الأرضي")),
            BuildingInventoryWriteAccess.Inspector, default, Inspector());
        var lineId = created!.Lines.Single().Id;

        var (edited, errors) = await service.SaveAsync(
            Po, PropertyId, Request(null, Line("الدور الأرضي المعدّل", lineId)),
            BuildingInventoryWriteAccess.Staff, default, Specialist());

        Assert.Null(errors);
        var provenance = Assert.Single(edited!.Lines).Provenance!;
        Assert.Equal("field-inspector", provenance.WrittenByRole);
        Assert.Equal("case-specialist", provenance.EditedByRole);
        Assert.Equal("spec-1", provenance.EditedByUserId);
    }

    [Fact]
    public async Task A_late_inspector_save_after_the_package_was_submitted_is_refused()
    {
        await using var db = CreateDb();
        Seed(db, PartyTaskSubmissionStatus.Submitted, WorkflowTaskStatus.Completed);

        var (result, errors) = await CreateService(db).SaveAsync(
            Po, PropertyId, Request(null, Line("بند")),
            BuildingInventoryWriteAccess.Inspector, default, Inspector());

        Assert.Null(result);
        Assert.Equal(BuildingInventoryWriteRules.PackageSubmitted, errors!["_"]);
        Assert.Empty(db.BuildingInventoryLines);
    }

    [Fact]
    public async Task A_denied_caller_writes_nothing()
    {
        await using var db = CreateDb();
        Seed(db);

        var (result, errors) = await CreateService(db).SaveAsync(
            Po, PropertyId, Request("نص", Line("بند")),
            BuildingInventoryWriteAccess.Denied, default, Inspector("insp-2"));

        Assert.Null(result);
        Assert.Contains("_", errors!.Keys);
        Assert.Empty(db.BuildingInventoryLines);
    }
}
