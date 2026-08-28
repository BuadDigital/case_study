using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>ق-6: الإصدار ثنائي المرحلة + شهادة الإيداع.</summary>
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

        // المرحلة 1: نسخة الإيداع — تجميد + PDF وخانة الرمز فارغة.
        var (deposit, depositErrors) = await service.IssueDepositAsync(id, "user-1");
        Assert.Null(depositErrors);
        Assert.Equal(ReportIssuanceStages.DepositIssued, deposit!.Stage);
        Assert.True(deposit.HasDepositPdf);
        Assert.False(deposit.HasFinalPdf);

        // التكرار مرفوض — التقرير مجمّد.
        var (_, dupErrors) = await service.IssueDepositAsync(id, "user-1");
        Assert.Contains("مجمّد", dupErrors!["_"]);

        // ق-6: حارس التجميد يمنع تحرير التسويات بعد نسخة الإيداع.
        Assert.True(await ValuationReportFreeze.IsFrozenAsync(db, id));

        var depositPdf = await service.GetDepositPdfAsync(id);
        Assert.NotNull(depositPdf);
        Assert.True(depositPdf!.Length > 0);

        // المرحلة 2: تسجيل الشهادة والرمز — النسخة النهائية بصفحة الشهادة والرمز.
        var (final, finalErrors) = await service.RegisterCertificateAsync(
            id,
            new RegisterDepositCertificateRequest
            {
                DepositCode = "QYM-2026-001234",
                CertificateFileName = "certificate.png",
                CertificateContentType = "image/png",
                CertificateContentBase64 = Convert.ToBase64String(TinyPng),
            },
            "user-2");
        Assert.Null(finalErrors);
        Assert.Equal(ReportIssuanceStages.FinalIssued, final!.Stage);
        Assert.Equal("QYM-2026-001234", final.DepositCode);
        Assert.True(final.HasFinalPdf);

        var finalPdf = await service.GetFinalPdfAsync(id);
        Assert.NotNull(finalPdf);
        Assert.True(finalPdf!.Length > 0);

        // «نفس التقرير المجمّد حرفياً» — نسخة الإيداع لا تتغير بعد النهائية.
        var depositPdfAfter = await service.GetDepositPdfAsync(id);
        Assert.Equal(depositPdf, depositPdfAfter);

        // الرمز تعبّأ في حقله داخل اللقطة المجمّدة للنسخة النهائية.
        var row = db.ValuationReportIssuances.Single();
        Assert.Contains("report.deposit_code", row.DocumentJson);

        // اكتمال الخطوة المهنية — الطلب يصبح مكتملاً.
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

    private static Guid NewRequest(
        RealEstateEval.Valuation.Infrastructure.Data.Contexts.ValuationDbContext db,
        string displayId)
    {
        var id = Guid.NewGuid();
        db.ValuationRequests.Add(ValuationRequest.Create(
            id, displayId, Guid.NewGuid().ToString(), "جدة", "فيلا", "مقيم",
            "2026-06-25", DateTime.UtcNow));
        return id;
    }

 // أصغر PNG صالح (1×1) لاختبار تضمين صفحة الشهادة.
    private static readonly byte[] TinyPng = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");

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

        public Task<byte[]?> GetPreviewPdfAsync(
            Guid valuationRequestId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<byte[]?>(null);
    }
}
