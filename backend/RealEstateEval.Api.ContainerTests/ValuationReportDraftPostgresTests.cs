using Microsoft.EntityFrameworkCore;
using Npgsql;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Services;

namespace RealEstateEval.Api.ContainerTests;

/// <summary>
/// The report-draft table and the final-report columns of the issuance row, executed as SQL against a migrated
/// Postgres: the in-memory provider never runs the constraints, the jsonb / bytea columns or the cascade.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class ValuationReportDraftPostgresTests : IAsyncLifetime
{
    private static readonly DateTime Now = new(2026, 10, 5, 9, 0, 0, DateTimeKind.Utc);

    private readonly PostgresFixture _postgres;
    private string _connectionString = "";

    public ValuationReportDraftPostgresTests(PostgresFixture postgres) => _postgres = postgres;

    public async Task InitializeAsync()
    {
        if (!DockerEnvironment.IsAvailable) return;
        _connectionString = await _postgres.EnsureDatabaseAsync("valuation_report_drafts");
        await BoundedContextStreamMigrator.ApplyAllStreamsAsync(_connectionString);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private ValuationDbContext Open() =>
        (ValuationDbContext)BoundedContextStreamMigrator.CreateStreamContext(typeof(ValuationDbContext), _connectionString);

    private static ValuationRequest NewRequest(Guid propertyId) =>
        ValuationRequest.Create(Guid.NewGuid(), $"VR-{Guid.NewGuid():N}"[..14], propertyId, "جدة", "فيلا", "مقيم", "2026-06-25", Now);

    [DockerFact]
    public async Task A_draft_and_the_final_report_columns_round_trip()
    {
        var request = NewRequest(Guid.NewGuid());
        var snapshot = new byte[] { 0x1f, 0x8b, 8, 0, 1, 2, 3 };
        var certificateId = Guid.NewGuid();
        var finalPdfId = Guid.NewGuid();

        await using (var db = Open())
        {
            db.ValuationRequests.Add(request);
            var draft = ValuationReportDraft.Start(request.Id, 1, Now);
            draft.SpecialistChoicesJson = """{"esgEnv":{"impact":"none"},"printAttachmentKeys":["deed","survey"]}""";
            draft.SnapshotHtmlGz = snapshot;
            draft.SnapshotSha256 = new string('a', 64);
            draft.ReportDate = "2026-10-05";
            db.ValuationReportDrafts.Add(draft);

            var issuance = ValuationReportIssuance.IssueDeposit(request.Id, "{}", "u-app", Now);
            Assert.Null(issuance.RegisterCertificate("QYM-1", "certificate.pdf", "application/pdf", certificateId, null, "u-app", Now));
            Assert.Null(issuance.IssueFinal(Now));
            issuance.SetFinalPdf(finalPdfId, "QYM-1", Now);
            db.ValuationReportIssuances.Add(issuance);
            await db.SaveChangesAsync();
        }

        await using (var db = Open())
        {
            var draft = await db.ValuationReportDrafts.AsNoTracking().SingleAsync(x => x.ValuationRequestId == request.Id);
            Assert.Equal(snapshot, draft.SnapshotHtmlGz);
            Assert.Contains("printAttachmentKeys", draft.SpecialistChoicesJson);
            Assert.Equal(ReportDraftStatuses.Preparing, draft.Status);

            var issuance = await db.ValuationReportIssuances.AsNoTracking().SingleAsync(x => x.ValuationRequestId == request.Id);
            Assert.Equal(certificateId, issuance.CertificateAttachmentId);
            Assert.Null(issuance.CertificateContent);
            Assert.Equal(finalPdfId, issuance.FinalPdfAttachmentId);
            Assert.Equal("QYM-1", issuance.FinalPdfDepositCode);
            Assert.True(issuance.FinalPdfIsCurrent);
            Assert.Equal(FinalReportStatuses.Ready, issuance.FinalReportStatus);
        }
    }

    [DockerFact]
    public async Task The_database_refuses_an_unknown_draft_status()
    {
        var request = NewRequest(Guid.NewGuid());
        await using var db = Open();
        db.ValuationRequests.Add(request);
        var draft = ValuationReportDraft.Start(request.Id, 1, Now);
        draft.Status = "published";
        db.ValuationReportDrafts.Add(draft);

        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        Assert.IsType<PostgresException>(ex.InnerException);
        Assert.Equal(PostgresErrorCodes.CheckViolation, ((PostgresException)ex.InnerException!).SqlState);
    }

    [DockerFact]
    public async Task One_draft_per_request_and_cycle()
    {
        var request = NewRequest(Guid.NewGuid());
        await using var db = Open();
        db.ValuationRequests.Add(request);
        db.ValuationReportDrafts.Add(ValuationReportDraft.Start(request.Id, 1, Now));
        db.ValuationReportDrafts.Add(ValuationReportDraft.Start(request.Id, 1, Now));

        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        Assert.Equal(PostgresErrorCodes.UniqueViolation, ((PostgresException)ex.InnerException!).SqlState);
    }

    [DockerFact]
    public async Task Deleting_the_request_removes_its_drafts_and_copies()
    {
        var request = NewRequest(Guid.NewGuid());
        await using (var db = Open())
        {
            db.ValuationRequests.Add(request);
            db.ValuationReportDrafts.Add(ValuationReportDraft.Start(request.Id, 1, Now));
            db.ValuationReportIssuances.Add(ValuationReportIssuance.IssueDeposit(request.Id, "{}", "u-app", Now));
            await db.SaveChangesAsync();
        }

        await using (var db = Open())
        {
            await db.ValuationRequests.Where(x => x.Id == request.Id).ExecuteDeleteAsync();
        }

        await using (var db = Open())
        {
            Assert.False(await db.ValuationReportDrafts.AnyAsync(x => x.ValuationRequestId == request.Id));
            Assert.False(await db.ValuationReportIssuances.AnyAsync(x => x.ValuationRequestId == request.Id));
        }
    }

    [DockerFact]
    public async Task The_batch_states_read_the_latest_request_of_each_property_from_postgres()
    {
        var withDraft = NewRequest(Guid.NewGuid());
        var deposited = NewRequest(Guid.NewGuid());
        var untouched = NewRequest(Guid.NewGuid());
        await using (var db = Open())
        {
            db.ValuationRequests.AddRange(withDraft, deposited, untouched);

            var sent = ValuationReportDraft.Start(withDraft.Id, 1, Now);
            sent.Status = ReportDraftStatuses.Sent;
            db.ValuationReportDrafts.Add(sent);

            var approved = ValuationReportDraft.Start(deposited.Id, 1, Now);
            approved.Status = ReportDraftStatuses.Approved;
            db.ValuationReportDrafts.Add(approved);
            db.ValuationReportIssuances.Add(ValuationReportIssuance.IssueDeposit(deposited.Id, "{}", "u-app", Now));
            await db.SaveChangesAsync();
        }

        await using var read = Open();
        var service = new ValuationReportDraftService(read, null!, null!, null!);
        var states = (await service.ListStatesAsync([withDraft.PropertyId, deposited.PropertyId, untouched.PropertyId, Guid.NewGuid()]))
            .ToDictionary(x => x.PropertyId);

        Assert.Equal(ReportDraftStatuses.Sent, states[withDraft.PropertyId].Status);
        Assert.Equal(ReportIssuanceStages.Draft, states[withDraft.PropertyId].ReportStage);
        Assert.Equal(ReportDraftStatuses.Approved, states[deposited.PropertyId].Status);
        Assert.Equal(ReportIssuanceStages.DepositIssued, states[deposited.PropertyId].ReportStage);
        Assert.Equal("none", states[untouched.PropertyId].Status);
        Assert.Equal(3, states.Count);
    }
}
