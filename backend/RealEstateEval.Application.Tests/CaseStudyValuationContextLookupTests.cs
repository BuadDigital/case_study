using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// A9 — the one-call Case Study read the Valuation host uses instead of CaseStudyDbContext.
/// </summary>
public class CaseStudyValuationContextLookupTests
{
    private static readonly Guid PropertyId = Guid.Parse("11111111-1111-4111-8111-111111111111");
    private static readonly Guid WorkOrderId = Guid.Parse("22222222-2222-4222-8222-222222222222");
    private static readonly Guid ClientId = Guid.Parse("33333333-3333-4333-8333-333333333333");
    private static readonly Guid ReportUserId = Guid.Parse("44444444-4444-4444-8444-444444444444");
    private static readonly Guid SubmissionId = Guid.Parse("55555555-5555-4555-8555-555555555555");

    [Fact]
    public async Task Context_returns_aggregate_latest_workspace_form_outcome_and_client_names()
    {
        await using var cs = CreateDb();
        Seed(cs);

        var lookup = new CaseStudyLookup(cs);
        var context = await lookup.GetValuationPropertyContextAsync(PropertyId);

        Assert.NotNull(context);
        Assert.Equal(PropertyId, context.Id);
        Assert.Equal("PO-900", context.PoNumber);
        Assert.Equal("تنفيذ", context.AssignmentType);
        Assert.Equal(AssignmentType.Execution, context.AssignmentTypeValue());
        Assert.Equal(nameof(DeedKind.Traditional), context.DeedKind);
        Assert.Equal(DeedKind.Traditional, context.DeedKindValue());
        Assert.Equal("yes", context.HasStructuresToValue);
        Assert.Equal("external", context.InspectionScopeKey);
        Assert.Equal("الرياض", context.City);
        Assert.Equal("حي الملقا", context.District);
        Assert.Equal("شمالاً شارع عرض 20م", context.NorthBoundary);

        Assert.Equal(2, context.BuildingInventoryLines.Count);
        Assert.Equal(
            new[] { "دور أرضي", "سور" },
            context.BuildingInventoryLines.Select(l => l.Label).ToArray());

        Assert.NotNull(context.LatestWorkspace);
        Assert.Equal(24.7m, context.LatestWorkspace.MapLatitude);
        Assert.Equal(46.6m, context.LatestWorkspace.MapLongitude);
        Assert.Equal(SubmissionId, context.LatestWorkspace.PartyTaskSubmissionId);
        Assert.Contains("buildState", context.InspectorPayloadJson);

        // Latest NON-party form wins; the newer party form must not.
        Assert.Equal("matched", context.DeedNatureMatchOutcome);

        Assert.Equal("مركز إنفاذ", context.ClientNameAr);
        Assert.Equal("Infath", context.ClientNameEn);
        Assert.Equal(new[] { "بنك التنمية" }, context.ReportUserClientNamesAr.ToArray());
    }

    [Fact]
    public async Task Context_materializes_property_and_workspace_for_report_fill()
    {
        await using var cs = CreateDb();
        Seed(cs);

        var lookup = new CaseStudyLookup(cs);
        var context = await lookup.GetValuationPropertyContextAsync(PropertyId);

        var property = context!.ToProperty();
        Assert.Equal(PropertyId, property.Id);
        Assert.Equal(WorkOrderId, property.WorkOrderId);
        Assert.Equal(DeedKind.Traditional, property.DeedKind);
        Assert.Equal("D-100", property.DeedNumber);
        Assert.Equal("yes", property.HasStructuresToValue);
        Assert.Equal(2, property.BuildingInventoryLines.Count);

        var workspace = context.LatestWorkspace!.ToWorkspace();
        Assert.Equal(24.7m, workspace.MapLatitude);
        Assert.Equal(new DateOnly(2026, 8, 10), workspace.InspectionDate);
    }

    [Fact]
    public async Task Context_is_null_for_unknown_property_and_tolerates_missing_children()
    {
        await using var cs = CreateDb();
        Seed(cs);

        var lookup = new CaseStudyLookup(cs);
        Assert.Null(await lookup.GetValuationPropertyContextAsync(Guid.NewGuid()));

        // A bare property: no workspace, no forms, no client.
        var bareId = Guid.NewGuid();
        var bareWorkOrderId = Guid.NewGuid();
        cs.WorkOrders.Add(new WorkOrder { Id = bareWorkOrderId, PoNumber = "PO-901" });
        cs.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = bareId,
            WorkOrderId = bareWorkOrderId,
        });
        cs.SaveChanges();

        var bare = await lookup.GetValuationPropertyContextAsync(bareId);
        Assert.NotNull(bare);
        Assert.Equal("PO-901", bare.PoNumber);
        Assert.Null(bare.LatestWorkspace);
        Assert.Null(bare.InspectorPayloadJson);
        Assert.Null(bare.DeedNatureMatchOutcome);
        Assert.Null(bare.ClientNameAr);
        Assert.Empty(bare.BuildingInventoryLines);
        Assert.Empty(bare.ReportUserClientNamesAr);
    }

    private static CaseStudyDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<CaseStudyDbContext>()
            .UseInMemoryDatabase($"valuation-context-{Guid.NewGuid():N}")
            .Options;
        return new CaseStudyDbContext(options);
    }

    private static void Seed(CaseStudyDbContext cs)
    {
        cs.Clients.AddRange(
            new Client { Id = ClientId, NameAr = "مركز إنفاذ", NameEn = "Infath" },
            new Client { Id = ReportUserId, NameAr = "بنك التنمية" });
        cs.WorkOrders.Add(new WorkOrder
        {
            Id = WorkOrderId,
            PoNumber = " PO-900 ",
            ClientId = ClientId,
            ReportUserClientIdsJson = WorkOrderReportUsers.Serialize([ReportUserId]),
        });
        cs.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = PropertyId,
            WorkOrderId = WorkOrderId,
            DeedKind = DeedKind.Traditional,
            DeedNumber = "D-100",
            City = "الرياض",
            District = "حي الملقا",
            PropertyType = "villa",
            HasStructuresToValue = "yes",
            InspectionScopeKey = "external",
            NorthBoundary = "شمالاً شارع عرض 20م",
        });
        cs.BuildingInventoryLines.AddRange(
            new BuildingInventoryLine
            {
                Id = Guid.NewGuid(),
                PropertyId = PropertyId,
                SortOrder = 2,
                StructureKind = BuildingStructureKinds.Fence,
                Label = "سور",
            },
            new BuildingInventoryLine
            {
                Id = Guid.NewGuid(),
                PropertyId = PropertyId,
                SortOrder = 1,
                StructureKind = BuildingStructureKinds.Floor,
                Label = "دور أرضي",
                AreaSqm = "220",
            });
        cs.FieldInspectionWorkspaces.AddRange(
            new FieldInspectionWorkspace
            {
                WorkflowTaskId = Guid.NewGuid(),
                PartyTaskSubmissionId = Guid.NewGuid(),
                PropertyId = PropertyId,
                MapLatitude = 10m,
                MapLongitude = 10m,
                UpdatedAtUtc = new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc),
            },
            new FieldInspectionWorkspace
            {
                WorkflowTaskId = Guid.NewGuid(),
                PartyTaskSubmissionId = SubmissionId,
                PropertyId = PropertyId,
                InspectionDate = new DateOnly(2026, 8, 10),
                MapLatitude = 24.7m,
                MapLongitude = 46.6m,
                UpdatedAtUtc = new DateTime(2026, 8, 10, 0, 0, 0, DateTimeKind.Utc),
            });
        cs.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = SubmissionId,
            WorkflowTaskId = Guid.NewGuid(),
            PayloadJson = """{"featureValues":{"buildState":"جيد"}}""",
        });
        cs.CaseStudyForms.AddRange(
            new CaseStudyForm
            {
                Id = Guid.NewGuid(),
                TaskId = Guid.NewGuid(),
                PropertyId = PropertyId,
                IsPartyForm = false,
                DeedNatureMatchOutcome = "matched",
                UpdatedAtUtc = new DateTime(2026, 8, 5, 0, 0, 0, DateTimeKind.Utc),
            },
            new CaseStudyForm
            {
                Id = Guid.NewGuid(),
                TaskId = Guid.NewGuid(),
                PropertyId = PropertyId,
                IsPartyForm = true,
                DeedNatureMatchOutcome = "mismatch",
                UpdatedAtUtc = new DateTime(2026, 8, 12, 0, 0, 0, DateTimeKind.Utc),
            });
        cs.SaveChanges();
    }
}
