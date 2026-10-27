using Microsoft.EntityFrameworkCore;
using RealEstateEval.Valuation.Application.Rules;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Integration;
using RealEstateEval.Valuation.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>two-phase issuance + deposit certificate.</summary>
public class ValuationReportIssuanceTests
{
    [Fact]
    public async Task Deposit_issue_requires_passing_gates()
    {
        await using var contexts = TestDatabases.Create("issuance-gates");
        var db = contexts.Valuation;
        var id = NewRequest(db, "VR-900");
        await db.SaveChangesAsync();

        var service = new ValuationReportIssuanceService(
            db,
            new StubGates(allows: false, reasons: ["مقارنات ناقصة"]),
            new StubDocuments());

        var (result, errors) = await service.IssueDepositAsync(id, "user-1");
        Assert.Null(result);
        Assert.Contains("بوابات الإصدار غير مكتملة", errors!["_"]);
        Assert.Empty(db.ValuationReportIssuances);
    }

    [Fact]
    public async Task Two_phase_flow_freezes_then_issues_final_with_code_and_certificate()
    {
        await using var contexts = TestDatabases.Create("issuance-flow");
        var db = contexts.Valuation;
        var id = NewRequest(db, "VR-901");
        await db.SaveChangesAsync();

        var service = new ValuationReportIssuanceService(
            db, new StubGates(allows: true), new StubDocuments());

        // Phase 1: deposit copy — freeze.
        var (deposit, depositErrors) = await service.IssueDepositAsync(id, "user-1");
        Assert.Null(depositErrors);
        Assert.Equal(ReportIssuanceStages.DepositIssued, deposit!.Stage);

        // Repeat rejected — report is frozen.
        var (_, dupErrors) = await service.IssueDepositAsync(id, "user-1");
        Assert.Contains("مجمّد", dupErrors!["_"]);

        // Freeze guard blocks editing adjustments after the deposit copy.
        Assert.True(await ValuationReportFreeze.IsFrozenAsync(db, id));

        // Phase 2: register certificate and code — final copy.
        var (final, finalErrors) = await service.RegisterCertificateAsync(
            id,
            new RegisterDepositCertificateRequest
            {
                DepositCode = "QYM-2026-001234",
                CertificateFileName = "certificate.pdf",
                CertificateContentType = "application/pdf",
                CertificateContentBase64 = TestPdf.OnePageBase64,
            },
            "user-2");
        Assert.Null(finalErrors);
        Assert.Equal(ReportIssuanceStages.FinalIssued, final!.Stage);
        Assert.Equal("QYM-2026-001234", final.DepositCode);

        // Code is filled into its field inside the frozen snapshot for the final copy.
        var row = db.ValuationReportIssuances.Single();
        Assert.Contains("report.deposit_code", row.DocumentJson);

        // Professional step complete — request becomes completed.
        var vr = db.ValuationRequests.Single(x => x.Id == id);
        Assert.False(vr.IsOpen);
    }

    [Fact]
    public async Task Certificate_requires_a_deposit_version_first()
    {
        await using var contexts = TestDatabases.Create("issuance-order");
        var db = contexts.Valuation;
        var id = NewRequest(db, "VR-902");
        await db.SaveChangesAsync();

        var service = new ValuationReportIssuanceService(
            db, new StubGates(allows: true), new StubDocuments());

        var (_, errors) = await service.RegisterCertificateAsync(
            id, new RegisterDepositCertificateRequest { DepositCode = "X-1" }, "user-1");
        Assert.Contains("أصدر نسخة الإيداع أولاً", errors!["_"]);
    }

    [Fact]
    public async Task Reopen_supersedes_active_version_and_next_deposit_is_version_two()
    {
        await using var contexts = TestDatabases.Create("issuance-reopen");
        var db = contexts.Valuation;
        var id = NewRequest(db, "VR-903");
        await db.SaveChangesAsync();

        var service = new ValuationReportIssuanceService(
            db, new StubGates(allows: true), new StubDocuments());

        var (deposit, _) = await service.IssueDepositAsync(id, "user-1");
        Assert.Equal(1, deposit!.Version);
        // Only a recorded deposit (code + certificate) is reopened as a new version.
        await service.RegisterCertificateAsync(id, Certificate("QYM-9"), "appraiser-1");

        // 2-B: reopen reason required — blank rejected; nothing changes.
        var (_, shortErrors) = await service.ReopenAfterDepositAsync(
            id, new ReopenReportIssuanceRequest { Reason = "  " }, "supervisor-1");
        Assert.Contains("مطلوب", shortErrors!["reason"]);
        Assert.True(await ValuationReportFreeze.IsFrozenAsync(db, id));

        // Current copy is marked superseded and kept on file; cycle returns to an open draft.
        var (reopened, reopenErrors) = await service.ReopenAfterDepositAsync(
            id,
            new ReopenReportIssuanceRequest { Reason = "قيمة المقارنات تغيّرت بعد صفقة مسجلة أحدث" },
            "supervisor-1");
        Assert.Null(reopenErrors);
        Assert.Equal(ReportIssuanceStages.Draft, reopened!.Stage);
        Assert.Equal(1, reopened.SupersededCount);
        Assert.False(await ValuationReportFreeze.IsFrozenAsync(db, id));

        db.ChangeTracker.Clear();
        var vr = db.ValuationRequests.Single(x => x.Id == id);
        Assert.True(vr.IsOpen);

        var superseded = db.ValuationReportIssuances.Single();
        Assert.NotNull(superseded.SupersededAtUtc);
        Assert.Equal("supervisor-1", superseded.SupersededByUserId);
        Assert.Contains("صفقة مسجلة أحدث", superseded.SupersededReason);

        // New cycle issues deposit copy N+1 — cycle numbers are not reused.
        var (second, secondErrors) = await service.IssueDepositAsync(id, "user-1");
        Assert.Null(secondErrors);
        Assert.Equal(2, second!.Version);
        Assert.Equal(1, second.SupersededCount);
        Assert.True(await ValuationReportFreeze.IsFrozenAsync(db, id));

        // Superseded is not deleted — two copies on file; current is the newest.
        db.ChangeTracker.Clear();
        Assert.Equal(2, db.ValuationReportIssuances.Count());
        Assert.Single(db.ValuationReportIssuances.Where(x => x.SupersededAtUtc == null));
    }

    /// <summary>The publisher only stages the outbox row — it has to ride the reopen's own save.</summary>
    [Fact]
    public async Task Reopen_commits_the_appraiser_notice_with_it()
    {
        await using var contexts = TestDatabases.Create("issuance-reopen-notice");
        var db = contexts.Valuation;
        var id = NewRequest(db, "VR-905");
        await db.SaveChangesAsync();

        var service = new ValuationReportIssuanceService(
            db,
            new StubGates(allows: true),
            new StubDocuments(),
            events: new ValuationOutboxPublisher(db, NullLogger<ValuationOutboxPublisher>.Instance));
        await service.IssueDepositAsync(id, "user-1");
        await service.RegisterCertificateAsync(id, Certificate("QYM-10"), "appraiser-1");

        var (_, errors) = await service.ReopenAfterDepositAsync(
            id,
            new ReopenReportIssuanceRequest { Reason = "قيمة المقارنات تغيّرت بعد صفقة مسجلة أحدث" },
            "supervisor-1");
        Assert.Null(errors);

        db.ChangeTracker.Clear();
        var notice = Assert.Single(
            db.OutboxMessages.Where(x => x.EventType == IntegrationEventTypes.ValuationWorkflowNotice));
        using var doc = System.Text.Json.JsonDocument.Parse(notice.PayloadJson);
        Assert.Equal(
            "إعادة فتح إصدار التقرير",
            doc.RootElement.GetProperty("Payload").GetProperty("Title").GetString());
    }

    [Fact]
    public async Task Reopen_without_active_deposit_points_back_to_recall()
    {
        await using var contexts = TestDatabases.Create("issuance-reopen-none");
        var db = contexts.Valuation;
        var id = NewRequest(db, "VR-904");
        await db.SaveChangesAsync();

        var service = new ValuationReportIssuanceService(
            db, new StubGates(allows: true), new StubDocuments());

        var (_, errors) = await service.ReopenAfterDepositAsync(
            id, new ReopenReportIssuanceRequest { Reason = "سبب جوهري بطول كافٍ" }, "supervisor-1");
        Assert.Contains("ر1", errors!["_"]);
    }

    // ----: the deposit code ----

    [Fact]
    public void Deposit_codes_are_stored_in_latin_digits_and_compared_case_and_space_insensitively()
    {
        Assert.Equal("QYM-2026-001234", ValuationReportIssuance.NormalizeDepositCode("  QYM-٢٠٢٦-٠٠١٢٣٤ "));
        Assert.Equal("qym 12", ValuationReportIssuance.NormalizeDepositCode("qym   ۱۲"));
        Assert.Equal("QYM-12", ValuationReportIssuance.DepositCodeKeyOf(" qym-١٢ "));
        Assert.Equal(
            ValuationReportIssuance.DepositCodeKeyOf("QYM 2026 01"),
            ValuationReportIssuance.DepositCodeKeyOf("qym202601"));
    }

    [Fact]
    public async Task A_deposit_code_already_on_another_current_report_is_refused_as_a_conflict()
    {
        await using var contexts = TestDatabases.Create("issuance-dup-code");
        var db = contexts.Valuation;
        var first = NewRequest(db, "VR-910");
        var second = NewRequest(db, "VR-911");
        await db.SaveChangesAsync();
        var service = new ValuationReportIssuanceService(db, new StubGates(allows: true), new StubDocuments());
        await service.IssueDepositAsync(first, "user-1");
        await service.IssueDepositAsync(second, "user-1");

        var (stored, storedErrors) = await service.RegisterCertificateAsync(first, Certificate("QYM-٢٠٢٦-٠٠١"), "app-1");
        Assert.Null(storedErrors);
        Assert.Equal("QYM-2026-001", stored!.DepositCode);

        var (_, duplicate) = await service.RegisterCertificateAsync(second, Certificate(" qym-2026-001 "), "app-2");
        Assert.Equal(DepositCertificateRules.DuplicateCodeAr, duplicate!["depositCode"]);
        Assert.True(duplicate.ContainsKey(DepositCertificateRules.ConflictKey));

        db.ChangeTracker.Clear();
        var secondRow = db.ValuationReportIssuances.Single(x => x.ValuationRequestId == second);
        Assert.Null(secondRow.DepositCode);
        Assert.Null(secondRow.FinalIssuedAtUtc);

        // Re-sending its own code (another case) is a correction of the same copy, not a duplicate.
        var (_, own) = await service.RegisterCertificateAsync(first, Certificate("qym-2026-001"), "app-1");
        Assert.Null(own);
    }

    [Fact]
    public async Task Correcting_the_code_never_moves_the_final_issue_moment()
    {
        await using var contexts = TestDatabases.Create("issuance-correct-code");
        var db = contexts.Valuation;
        var id = NewRequest(db, "VR-912");
        await db.SaveChangesAsync();
        var clock = new SteppingClock(new DateTimeOffset(2026, 10, 25, 9, 0, 0, TimeSpan.Zero));
        var service = new ValuationReportIssuanceService(
            db, new StubGates(allows: true), new StubDocuments(), clock);
        await service.IssueDepositAsync(id, "user-1");

        var (final, _) = await service.RegisterCertificateAsync(id, Certificate("QYM-1"), "app-1");
        clock.Advance(TimeSpan.FromMinutes(5));
        var (corrected, errors) = await service.RegisterCertificateAsync(
            id, new RegisterDepositCertificateRequest { DepositCode = "QYM-2" }, "app-1");

        Assert.Null(errors);
        Assert.Equal("QYM-2", corrected!.DepositCode);
        Assert.Equal(final!.FinalIssuedAtUtc, corrected.FinalIssuedAtUtc);
        Assert.Equal(1, corrected.Version);
    }

    [Fact]
    public async Task A_new_version_does_not_reuse_the_code_of_its_superseded_version()
    {
        await using var contexts = TestDatabases.Create("issuance-v2-code");
        var db = contexts.Valuation;
        var id = NewRequest(db, "VR-913");
        var other = NewRequest(db, "VR-914");
        await db.SaveChangesAsync();
        var service = new ValuationReportIssuanceService(db, new StubGates(allows: true), new StubDocuments());
        await service.IssueDepositAsync(id, "user-1");
        await service.RegisterCertificateAsync(id, Certificate("QYM-V1"), "app-1");
        await service.ReopenAfterDepositAsync(
            id, new ReopenReportIssuanceRequest { Reason = "قيمة المقارنات تغيّرت بعد صفقة أحدث" }, "supervisor-1");
        await service.IssueDepositAsync(id, "user-1");

        var (_, reused) = await service.RegisterCertificateAsync(id, Certificate("qym-v1"), "app-1");
        Assert.Equal(DepositCertificateRules.DuplicateCodeAr, reused!["depositCode"]);

        var (v2, fresh) = await service.RegisterCertificateAsync(id, Certificate("QYM-V2"), "app-1");
        Assert.Null(fresh);
        Assert.Equal(2, v2!.Version);

        // Scope: only current reports hold their code against OTHER requests — v1 is superseded.
        await service.IssueDepositAsync(other, "user-1");
        var (_, otherErrors) = await service.RegisterCertificateAsync(other, Certificate("QYM-V1"), "app-2");
        Assert.Null(otherErrors);
    }

    [Fact]
    public void The_deposit_code_is_unique_among_current_copies_and_registrations_race_on_a_row_version()
    {
        using var db = new RealEstateEval.Valuation.Infrastructure.Data.Contexts.ValuationDbContext(
            new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<
                    RealEstateEval.Valuation.Infrastructure.Data.Contexts.ValuationDbContext>()
                .UseNpgsql("Host=localhost;Database=model_only;Username=test;Password=test")
                .Options);
        var entity = db.Model.FindEntityType(typeof(ValuationReportIssuance))!;

        var index = entity.GetIndexes().Single(i =>
            i.GetDatabaseName() == ValuationReportIssuance.DepositCodeKeyCurrentIndex);
        Assert.True(index.IsUnique);
        Assert.Equal([nameof(ValuationReportIssuance.DepositCodeKey)], index.Properties.Select(p => p.Name));
        Assert.Contains("\"SupersededAtUtc\" IS NULL", index.GetFilter());

        var rowVersion = entity.FindProperty("RowVersion")!;
        Assert.True(rowVersion.IsConcurrencyToken);
        Assert.Equal("xmin", rowVersion.GetColumnName());
    }

    private sealed class SteppingClock(DateTimeOffset start) : TimeProvider
    {
        private DateTimeOffset _now = start;
        public void Advance(TimeSpan by) => _now = _now.Add(by);
        public override DateTimeOffset GetUtcNow() => _now;
    }

    private static RegisterDepositCertificateRequest Certificate(string code, string? base64 = null) => new()
    {
        DepositCode = code,
        CertificateFileName = "certificate.pdf",
        CertificateContentType = "application/pdf",
        CertificateContentBase64 = base64 ?? TestPdf.OnePageBase64,
    };

    private static Guid NewRequest(
        RealEstateEval.Valuation.Infrastructure.Data.Contexts.ValuationDbContext db,
        string displayId)
    {
        var id = Guid.NewGuid();
        db.ValuationRequests.Add(ValuationRequest.Create(
            id, displayId, Guid.NewGuid(), "جدة", "فيلا", "مقيم",
            "2026-06-25", DateTime.UtcNow));
        return id;
    }

    private sealed class StubGates(bool allows, IReadOnlyList<string>? reasons = null)
        : IValuationIssuanceGateService
    {
        public Task<ValuationIssuanceGatesDto?> EvaluateAsync(
            Guid valuationRequestId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<ValuationIssuanceGatesDto?>(new ValuationIssuanceGatesDto
            {
                ValuationRequestId = valuationRequestId,
                AllowsIssuance = allows,
                BlockingReasonsAr = reasons ?? [],
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
                ReportDateDisplay = "2026/08/28",
                FinalOpinionDisplay = "1,000,000 ريال",
                Sections =
                [
                    new ValuationReportSectionDto
                    {
                        Number = 30,
                        Key = "closing",
                        TitleAr = "الخاتمة",
                        BodyKind = "fields",
                        Included = true,
                        Fields = new Dictionary<string, string?>
                        {
                            ["report.deposit_code"] = null,
                        },
                    },
                ],
            });
    }
}
