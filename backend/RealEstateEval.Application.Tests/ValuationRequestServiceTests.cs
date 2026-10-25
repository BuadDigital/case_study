using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Services;
using RealEstateEval.Valuation.Infrastructure.Integration;

namespace RealEstateEval.Application.Tests;

public class ValuationRequestServiceTests
{
    [Fact]
    public async Task RecordImpediment_marks_request_as_fail()
    {
        await using var db = CreateDb();
        var id = Guid.Parse("a1000001-0000-4000-8000-000000000001");
        db.ValuationRequests.Add(OpenRequest(id, "VR-500"));
        await db.SaveChangesAsync();

        var service = CreateService(db);

        var (result, error) = await service.RecordImpedimentAsync(
            id,
            new() { Reason = "تعذّر الوصول للعقار" });

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal("fail", result!.Status);

        var row = await db.ValuationRequests.SingleAsync();
        Assert.Equal(ValuationRequestStatus.Failed, row.Status);
    }

    [Fact]
    public async Task Create_numbers_the_request_and_queues_the_created_event()
    {
        await using var db = CreateDb();
        var service = CreateService(db);

        var (result, error) = await service.CreateAsync(new SaveValuationRequestRequest
        {
            PropId = Guid.NewGuid().ToString(),
            Area = "جدة",
            Type = "فيلا",
            Appraiser = "مقيم",
            Status = ValuationRequestStatuses.Progress,
            Date = "2026-07-29",
        });

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.StartsWith("VR-", result!.DisplayId);
        Assert.Equal(IntegrationEventTypes.ValuationRequestCreated, (await db.OutboxMessages.SingleAsync()).EventType);
    }

    [Fact]
    public async Task GetOpenByProperty_matches_guid_format_variants()
    {
        await using var db = CreateDb();
        var propertyId = Guid.Parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        db.ValuationRequests.Add(ValuationRequest.Create(
            Guid.Parse("a1000001-0000-4000-8000-000000000003"),
            "VR-510",
            propertyId,
            "جدة",
            "فيلا",
            "مقيم",
            "2026-08-19",
            DateTime.UtcNow));
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var found = await service.GetOpenByPropertyAsync(propertyId.ToString("D").ToUpperInvariant());
        Assert.NotNull(found);
        Assert.Equal("VR-510", found!.DisplayId);
    }

    [Fact]
    public async Task EnsureOpen_returns_existing_without_creating_a_second()
    {
        await using var db = CreateDb();
        var propertyId = Guid.Parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
        db.ValuationRequests.Add(ValuationRequest.Create(
            Guid.Parse("a1000001-0000-4000-8000-000000000004"),
            "VR-511",
            propertyId,
            "جدة",
            "فيلا",
            "مقيم",
            "2026-08-19",
            DateTime.UtcNow));
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var (result, error) = await service.EnsureOpenByPropertyAsync(new SaveValuationRequestRequest
        {
            PropId = propertyId.ToString("D"),
            Area = "جدة",
            Type = "فيلا",
            Appraiser = "مقيم",
            Status = ValuationRequestStatuses.Progress,
            Date = "2026-08-19",
        });

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal("VR-511", result!.DisplayId);
        Assert.Equal(1, await db.ValuationRequests.CountAsync());
    }

    [Fact]
    public async Task RecordImpediment_rejects_without_reason()
    {
        await using var db = CreateDb();
        var id = Guid.Parse("a1000001-0000-4000-8000-000000000002");
        db.ValuationRequests.Add(OpenRequest(id, "VR-501"));
        await db.SaveChangesAsync();

        var service = CreateService(db);

        var (result, error) = await service.RecordImpedimentAsync(
            id,
            new() { Reason = "   " });

        Assert.Equal("reason_required", error);
        Assert.Null(result);
    }

    [Fact]
    public async Task List_includes_final_opinion_and_issue_date()
    {
        await using var db = CreateDb();
        var requestId = Guid.Parse("a1000001-0000-4000-8000-000000000005");
        var propertyId = Guid.Parse("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
        var request = ValuationRequest.Create(
            requestId,
            "VR-520",
            propertyId,
            "جدة",
            "فيلا",
            "مقيم الاختبار",
            "2026-09-01",
            DateTime.UtcNow,
            ValuationRequestStatus.Done);
        db.ValuationRequests.Add(request);
        db.ValuationReconciliations.Add(new ValuationReconciliation
        {
            Id = Guid.Parse("a1000001-0000-4000-8000-000000000006"),
            ValuationRequestId = requestId,
            MethodsRationale = "سوق",
            FinalRoundDecimals = 0,
            BasisOfValueKey = BasisOfValueKeys.Market,
            UpdatedAtUtc = DateTime.UtcNow,
            Methods =
            [
                new ValuationReconciliationMethodLine
                {
                    Id = Guid.Parse("a1000001-0000-4000-8000-000000000007"),
                    ApproachKind = ValuationApproachKinds.Market,
                    ApproachValue = 1_850_000m,
                    WeightPct = 100m,
                    IsIncluded = true,
                    Rationale = "سوق",
                },
            ],
        });
        db.ValuationReportIssuances.Add(ValuationReportIssuance.IssueDeposit(
            requestId,
            "{}",
            "staff",
            new DateTime(2026, 9, 10, 8, 0, 0, DateTimeKind.Utc)));
        await db.SaveChangesAsync();

        db.ValuationRequests.Add(ValuationRequest.Create(
            Guid.Parse("a1000001-0000-4000-8000-000000000008"),
            "VR-521",
            Guid.Parse("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"),
            "جدة",
            "فيلا",
            "مقيم آخر",
            "2026-08-01",
            DateTime.UtcNow));
        await db.SaveChangesAsync();

        var listed = await CreateService(db).ListAsync();
        var row = Assert.Single(listed, x => x.DisplayId == "VR-520");
        Assert.Equal(1_850_000m, row.FinalOpinionValue);
        Assert.Equal("2026-09-10", row.IssueDate);
        Assert.Equal("مقيم الاختبار", row.Appraiser);
        Assert.Equal("done", row.Status);

        var open = Assert.Single(listed, x => x.DisplayId == "VR-521");
        Assert.Null(open.FinalOpinionValue);
        Assert.Null(open.IssueDate);
    }

    // ------------------------------------------------------------ phase 5: one valuation per transaction

    [Fact]
    public async Task Fold_marks_the_moved_deeds_requests_merged_into_the_holders_and_open_by_property_follows_it()
    {
        await using var db = CreateDb();
        var holderProperty = Guid.Parse("11111111-1111-4111-8111-111111111111");
        var movedProperty = Guid.Parse("22222222-2222-4222-8222-222222222222");
        var holderRequest = Guid.Parse("a1000001-0000-4000-8000-000000000010");
        var movedRequest = Guid.Parse("a1000001-0000-4000-8000-000000000011");
        db.ValuationRequests.Add(OpenRequest(holderRequest, "VR-600", holderProperty));
        db.ValuationRequests.Add(OpenRequest(movedRequest, "VR-601", movedProperty));
        await db.SaveChangesAsync();
        var service = CreateService(db);
        var folding = new ValuationRequestFoldingService(db);

        var folded = await folding.FoldAsync(new FoldValuationRequestsRequest
        {
            PropertyIds = [movedProperty, Guid.NewGuid()],
            HolderPropertyId = holderProperty,
        });

        Assert.Equal(1, folded.FoldedCount);
        Assert.Equal(holderRequest, folded.HolderRequestId);
        var row = await db.ValuationRequests.AsNoTracking().SingleAsync(x => x.Id == movedRequest);
        Assert.Equal(ValuationRequestStatus.Merged, row.Status);
        Assert.Equal(holderRequest, row.MergedIntoRequestId);
        Assert.False(row.IsOpen);

        // The moved deed's "open request" is now the holder's — the gates that read it keep working.
        var open = await service.GetOpenByPropertyAsync(movedProperty.ToString("D"));
        Assert.Equal("VR-600", open!.DisplayId);
        Assert.Contains("merged", (await service.ListAsync()).Select(x => x.Status));
        Assert.Equal(holderRequest, (await service.GetAsync(movedRequest))!.MergedIntoRequestId);

        // Idempotent.
        var again = await folding.FoldAsync(new FoldValuationRequestsRequest
        {
            PropertyIds = [movedProperty],
            HolderPropertyId = holderProperty,
        });
        Assert.Equal(0, again.FoldedCount);
    }

    [Fact]
    public async Task A_merged_deed_reads_as_closed_once_the_holders_request_is_done_and_unfold_reopens_it()
    {
        await using var db = CreateDb();
        var holderProperty = Guid.Parse("33333333-3333-4333-8333-333333333333");
        var movedProperty = Guid.Parse("44444444-4444-4444-8444-444444444444");
        var holderRequest = Guid.Parse("a1000001-0000-4000-8000-000000000012");
        var movedRequest = Guid.Parse("a1000001-0000-4000-8000-000000000013");
        db.ValuationRequests.Add(OpenRequest(holderRequest, "VR-610", holderProperty));
        db.ValuationRequests.Add(OpenRequest(movedRequest, "VR-611", movedProperty));
        await db.SaveChangesAsync();
        var service = CreateService(db);
        var folding = new ValuationRequestFoldingService(db);
        await folding.FoldAsync(new FoldValuationRequestsRequest
        {
            PropertyIds = [movedProperty],
            HolderPropertyId = holderProperty,
        });

        var holder = await db.ValuationRequests.SingleAsync(x => x.Id == holderRequest);
        holder.SubmitReport(DateTime.UtcNow);
        await db.SaveChangesAsync();
        Assert.Null(await service.GetOpenByPropertyAsync(movedProperty.ToString("D")));

        var unfolded = await folding.UnfoldAsync(new UnfoldValuationRequestRequest { PropertyId = movedProperty });

        Assert.Equal(1, unfolded.FoldedCount);
        var row = await db.ValuationRequests.AsNoTracking().SingleAsync(x => x.Id == movedRequest);
        Assert.Equal(ValuationRequestStatus.Progress, row.Status);
        Assert.Null(row.MergedIntoRequestId);
        Assert.Equal("VR-611", (await service.GetOpenByPropertyAsync(movedProperty.ToString("D")))!.DisplayId);
        Assert.Equal(0, (await folding.UnfoldAsync(new UnfoldValuationRequestRequest { PropertyId = movedProperty })).FoldedCount);
    }

    // ------------------------------------------------------------ final report status by property

    private static ValuationReportIssuance FinalCopy(Guid requestId, int version, DateTime issuedAt, bool pdfReady)
    {
        var issuance = ValuationReportIssuance.IssueDeposit(requestId, "{}", "u-1", issuedAt, version);
        issuance.DepositCode = "DEP-1";
        issuance.FinalIssuedAtUtc = issuedAt;
        if (pdfReady) issuance.SetFinalPdf(Guid.NewGuid(), "DEP-1", issuedAt);
        return issuance;
    }

    [Fact]
    public async Task Final_report_status_ignores_a_replaced_copy()
    {
        await using var db = CreateDb();
        var property = Guid.NewGuid();
        var request = Guid.NewGuid();
        db.ValuationRequests.Add(OpenRequest(request, "VR-630", property));
        var old = FinalCopy(request, version: 1, new DateTime(2026, 10, 1, 9, 0, 0, DateTimeKind.Utc), pdfReady: false);
        db.ValuationReportIssuances.Add(old);
        await db.SaveChangesAsync();
        var service = CreateService(db);
        var key = property.ToString("D");

        Assert.Equal(FinalReportStatuses.Preparing, await service.GetFinalReportStatusByPropertyAsync(key));

        // Reopened after the handover: the old copy is replaced and no current copy exists yet.
        Assert.Null(old.Supersede("u-2", "إعادة فتح للتعديل", DateTime.UtcNow));
        await db.SaveChangesAsync();
        Assert.Null(await service.GetFinalReportStatusByPropertyAsync(key));

        // The new cycle's deposit copy is the one the status follows.
        db.ValuationReportIssuances.Add(ValuationReportIssuance.IssueDeposit(
            request, "{}", "u-1", new DateTime(2026, 10, 5, 9, 0, 0, DateTimeKind.Utc), version: 2));
        await db.SaveChangesAsync();
        Assert.Equal(FinalReportStatuses.None, await service.GetFinalReportStatusByPropertyAsync(key));
    }

    [Fact]
    public async Task Final_report_status_follows_the_pdf_of_the_current_copy()
    {
        await using var db = CreateDb();
        var property = Guid.NewGuid();
        var request = Guid.NewGuid();
        db.ValuationRequests.Add(OpenRequest(request, "VR-631", property));
        var copy = FinalCopy(request, version: 1, DateTime.UtcNow, pdfReady: false);
        db.ValuationReportIssuances.Add(copy);
        await db.SaveChangesAsync();
        var service = CreateService(db);
        var key = property.ToString("D");

        Assert.Equal(FinalReportStatuses.Preparing, await service.GetFinalReportStatusByPropertyAsync(key));

        copy.SetFinalPdf(Guid.NewGuid(), "DEP-1", DateTime.UtcNow);
        await db.SaveChangesAsync();
        Assert.Equal(FinalReportStatuses.Ready, await service.GetFinalReportStatusByPropertyAsync(key));
    }

    [Fact]
    public async Task A_merged_deed_reads_the_final_report_status_of_the_holders_request()
    {
        await using var db = CreateDb();
        var holderProperty = Guid.NewGuid();
        var movedProperty = Guid.NewGuid();
        var holderRequest = Guid.NewGuid();
        db.ValuationRequests.Add(OpenRequest(holderRequest, "VR-632", holderProperty));
        db.ValuationRequests.Add(OpenRequest(Guid.NewGuid(), "VR-633", movedProperty));
        await db.SaveChangesAsync();
        await new ValuationRequestFoldingService(db).FoldAsync(new FoldValuationRequestsRequest
        {
            PropertyIds = [movedProperty],
            HolderPropertyId = holderProperty,
        });
        var copy = FinalCopy(holderRequest, version: 1, DateTime.UtcNow, pdfReady: false);
        db.ValuationReportIssuances.Add(copy);
        await db.SaveChangesAsync();
        var service = CreateService(db);

        Assert.Equal(FinalReportStatuses.Preparing, await service.GetFinalReportStatusByPropertyAsync(holderProperty.ToString("D")));
        Assert.Equal(FinalReportStatuses.Preparing, await service.GetFinalReportStatusByPropertyAsync(movedProperty.ToString("D")));

        copy.SetFinalPdf(Guid.NewGuid(), "DEP-1", DateTime.UtcNow);
        await db.SaveChangesAsync();
        Assert.Equal(FinalReportStatuses.Ready, await service.GetFinalReportStatusByPropertyAsync(movedProperty.ToString("D")));
    }

    [Fact]
    public void A_closed_request_is_never_folded()
    {
        var row = ValuationRequest.Create(
            Guid.NewGuid(), "VR-620", Guid.NewGuid(), "جدة", "فيلا", "مقيم", "2026-06-25", DateTime.UtcNow,
            ValuationRequestStatus.Done);
        Assert.False(row.MarkMerged(Guid.NewGuid(), DateTime.UtcNow));
        Assert.Equal(ValuationRequestStatus.Done, row.Status);
        Assert.Equal("merged", ValuationRequestStatus.Merged.ToDbValue());
        Assert.Equal(ValuationRequestStatus.Merged, ValuationRequestStatuses.Parse("merged"));
    }

    private static ValuationRequest OpenRequest(Guid id, string displayId, Guid? propertyId = null) =>
        ValuationRequest.Create(
            id,
            displayId,
            propertyId ?? Guid.NewGuid(),
            "جدة",
            "فيلا",
            "مقيم",
            "2026-06-25",
            DateTime.UtcNow);

    private static ValuationDbContext CreateDb() => TestDatabases.Valuation("valuation-request");

 /// <summary>
 /// The Valuation context cannot read Case Study tables, so the PO number arrives through
 /// the owner interface.
 /// </summary>
    private static ValuationRequestService CreateService(ValuationDbContext db) =>
        new(
            db,
            new ValuationOutboxPublisher(db, NullLogger<ValuationOutboxPublisher>.Instance),
            new StubPoNumberLookup("PO-900"));

    private sealed class StubPoNumberLookup(string poNumber) : IPropertyPoNumberLookup
    {
        public Task<string> ResolveForPropertyAsync(
            string propertyId,
            CancellationToken cancellationToken = default) => Task.FromResult(poNumber);
    }
}
