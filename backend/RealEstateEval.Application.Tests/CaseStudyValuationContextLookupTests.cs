using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The one-call Case Study read the Valuation host uses instead of CaseStudyDbContext.
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
        Assert.Equal("market", context.BasisOfValueKey);
        Assert.Equal("hau", context.ValuePremiseKey);
        Assert.Equal(DeedKindLabels.Traditional, context.DeedKind);
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
        // The seeded latest non-party report is still «new»: the study report is not issued.
        Assert.False(context.StudyReportIssued);

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
        Assert.True(context.RequiresEngineeringSurvey);
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
        Assert.False(bare.StudyReportIssued); // no report at all is «not issued», never «unknown»
        Assert.Null(bare.ClientNameAr);
        Assert.Empty(bare.BuildingInventoryLines);
        Assert.Empty(bare.ReportUserClientNamesAr);
    }

    [Fact]
    public async Task Context_reports_the_study_report_issued_from_the_latest_non_party_row_only()
    {
        await using var cs = CreateDb();
        Seed(cs);
        var lookup = new CaseStudyLookup(cs);

        // A newer ISSUED party contribution does not make the specialist's report issued.
        var party = await cs.CaseStudyReports.SingleAsync(r => r.IsPartyContribution);
        party.Status = CaseStudyReportStatuses.Issued;
        await cs.SaveChangesAsync();
        Assert.False((await lookup.GetValuationPropertyContextAsync(PropertyId))!.StudyReportIssued);

        // The specialist's own report issued: true.
        var report = await cs.CaseStudyReports.SingleAsync(r => !r.IsPartyContribution);
        report.Status = CaseStudyReportStatuses.Issued;
        await cs.SaveChangesAsync();
        var context = await lookup.GetValuationPropertyContextAsync(PropertyId);
        Assert.True(context!.StudyReportIssued);
        Assert.Equal("matched", context.DeedNatureMatchOutcome);

        // Reopened (draft) again: false.
        report.Status = CaseStudyReportStatuses.Draft;
        await cs.SaveChangesAsync();
        Assert.False((await lookup.GetValuationPropertyContextAsync(PropertyId))!.StudyReportIssued);
    }

    [Fact]
    public async Task Effective_type_follows_the_inspector_draft_until_a_submitted_type_exists()
    {
        await using var cs = CreateDb();
        Seed(cs);
        var lookup = new CaseStudyLookup(cs);

        // Intake type only (the seeded draft names no asset type).
        var intake = await lookup.GetValuationPropertyContextAsync(PropertyId);
        Assert.Null(intake!.DraftInspectedPropertyType);
        Assert.Equal("villa", intake.EffectivePropertyType());

        // The inspector's draft states «أرض» — the unsaved approach defaults follow it.
        var submission = await cs.PartyTaskSubmissions.SingleAsync(s => s.Id == SubmissionId);
        submission.PayloadJson = """{"featureValues":{"assetSubject":"أرض"}}""";
        await cs.SaveChangesAsync();
        var draft = await lookup.GetValuationPropertyContextAsync(PropertyId);
        Assert.Equal("أرض", draft!.DraftInspectedPropertyType);
        Assert.Null(draft.InspectedPropertyType);
        Assert.Equal("أرض", draft.EffectivePropertyType());

        // A value outside the closed list is not a type.
        submission.PayloadJson = """{"featureValues":{"assetSubject":"قصر"}}""";
        await cs.SaveChangesAsync();
        Assert.Equal("villa", (await lookup.GetValuationPropertyContextAsync(PropertyId))!.EffectivePropertyType());

        // The submitted type wins over the draft; saved settings are never rewritten by this read.
        submission.PayloadJson = """{"featureValues":{"assetSubject":"أرض"}}""";
        var property = await cs.WorkOrderProperties.SingleAsync(p => p.Id == PropertyId);
        property.InspectedPropertyType = "فيلا";
        await cs.SaveChangesAsync();
        var submitted = await lookup.GetValuationPropertyContextAsync(PropertyId);
        Assert.Equal("فيلا", submitted!.EffectivePropertyType());
    }

    [Fact]
    public async Task Context_names_the_engineering_survey_tasks_whose_uploads_count_for_the_property()
    {
        await using var cs = CreateDb();
        Seed(cs);
        var now = DateTime.UtcNow;
        var survey = WorkflowTask.Create(WorkflowTaskKind.EngineeringSurvey, "PO-900", now, propertyId: PropertyId);
        var inspection = WorkflowTask.Create(WorkflowTaskKind.FieldInspection, "PO-900", now, propertyId: PropertyId);
        var otherProperty = WorkflowTask.Create(WorkflowTaskKind.EngineeringSurvey, "PO-900", now, propertyId: Guid.NewGuid());
        cs.WorkflowTasks.AddRange(survey, inspection, otherProperty);
        cs.PartyTaskSubmissions.AddRange(
            SurveyPackage(survey.Id, PartyTaskSubmissionStatus.Submitted, now),
            SurveyPackage(otherProperty.Id, PartyTaskSubmissionStatus.Submitted, now));
        await cs.SaveChangesAsync();

        var context = await new CaseStudyLookup(cs).GetValuationPropertyContextAsync(PropertyId);

        Assert.Equal([survey.Id], context!.SurveyTaskIds);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(PartyTaskSubmissionStatus.Draft)]
    [InlineData(PartyTaskSubmissionStatus.Reopened)]
    public async Task A_survey_the_office_has_not_submitted_does_not_count_yet(string? status)
    {
        await using var cs = CreateDb();
        Seed(cs);
        var now = DateTime.UtcNow;
        var survey = WorkflowTask.Create(WorkflowTaskKind.EngineeringSurvey, "PO-900", now, propertyId: PropertyId);
        cs.WorkflowTasks.Add(survey);
        if (status is not null)
            cs.PartyTaskSubmissions.Add(SurveyPackage(survey.Id, status, now));
        await cs.SaveChangesAsync();

        var context = await new CaseStudyLookup(cs).GetValuationPropertyContextAsync(PropertyId);

        Assert.Empty(context!.SurveyTaskIds);
    }

    private static PartyTaskSubmission SurveyPackage(Guid taskId, string status, DateTime now) => new()
    {
        Id = Guid.NewGuid(),
        WorkflowTaskId = taskId,
        Kind = WorkflowTaskKindValues.EngineeringSurvey,
        Status = status,
        PropertyId = PropertyId,
        PoNumber = "PO-900",
        PayloadJson = "{}",
        CreatedAtUtc = now,
        UpdatedAtUtc = now,
    };

    private static CaseStudyDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<CaseStudyDbContext>()
            .UseInMemoryDatabase($"valuation-context-{Guid.NewGuid():N}")
            .Options;
        return new CaseStudyDbContext(options);
    }

    /// <summary>Phase 5: a linked property's context names the transaction and every deed in it.</summary>
    [Fact]
    public async Task Context_carries_the_transaction_and_its_deeds_for_a_linked_property()
    {
        await using var cs = CreateDb();
        Seed(cs);
        var transaction = Transaction.CreateDraft("TMP-26-00007", DateTime.UtcNow);
        transaction.LinkKind = TransactionLinkKinds.OneBuilding;
        transaction.StudyHolderPropertyId = PropertyId;
        cs.Transactions.Add(transaction);
        var holder = await cs.WorkOrderProperties.SingleAsync(p => p.Id == PropertyId);
        holder.TransactionId = transaction.Id;
        holder.DeedDate = "1440/01/01";
        var siblingOrder = Guid.NewGuid();
        cs.WorkOrders.Add(new WorkOrder { Id = siblingOrder, PoNumber = "PO-901", CreatedAtUtc = DateTime.UtcNow.AddDays(1) });
        cs.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = Guid.NewGuid(),
            WorkOrderId = siblingOrder,
            TransactionId = transaction.Id,
            IdentifierType = PropertyIdentifierType.RealEstateRegistration,
            RealEstateRegNumber = "REG-7",
            RealEstateRegDate = "1441/02/02",
            Area = "300",
        });
        await cs.SaveChangesAsync();

        var context = await new CaseStudyLookup(cs).GetValuationPropertyContextAsync(PropertyId);

        Assert.NotNull(context);
        Assert.True(context.IsLinkedProperty);
        Assert.Equal(transaction.Id, context.TransactionId);
        Assert.Equal("TMP-26-00007", context.TransactionNumber);
        Assert.Equal(TransactionLinkKinds.OneBuilding, context.TransactionLinkKind);
        Assert.Equal(PropertyId, context.StudyHolderPropertyId);
        Assert.Equal(new[] { "D-100", "REG-7" }, context.TransactionDeeds.Select(d => d.Label()).ToArray());
        Assert.Equal("D-100 ، REG-7", CaseStudyTransactionDeedRules.JoinedLabels(context.TransactionDeeds));
        Assert.Equal("1440/01/01 ، 1441/02/02", CaseStudyTransactionDeedRules.JoinedDates(context.TransactionDeeds));

        // An ordinary property: no joined cells, the single deed prints as before.
        var alone = await new CaseStudyLookup(cs).GetValuationPropertyContextAsync(Guid.NewGuid());
        Assert.Null(alone);
        Assert.Null(CaseStudyTransactionDeedRules.JoinedLabels([context.TransactionDeeds[0]]));
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
            BasisOfValueKey = "market",
            ValuePremiseKey = "hau",
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
        cs.CaseStudyReports.AddRange(
            new CaseStudyReport
            {
                Id = Guid.NewGuid(),
                TaskId = Guid.NewGuid(),
                PropertyId = PropertyId,
                IsPartyContribution = false,
                DeedNatureMatchOutcome = "matched",
                UpdatedAtUtc = new DateTime(2026, 8, 5, 0, 0, 0, DateTimeKind.Utc),
            },
            new CaseStudyReport
            {
                Id = Guid.NewGuid(),
                TaskId = Guid.NewGuid(),
                PropertyId = PropertyId,
                IsPartyContribution = true,
                DeedNatureMatchOutcome = "mismatch",
                UpdatedAtUtc = new DateTime(2026, 8, 12, 0, 0, 0, DateTimeKind.Utc),
            });
        cs.SaveChanges();
    }
}
