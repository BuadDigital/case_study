using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>ق-6: الإصدار ثنائي المرحلة + شهادة الإيداع.</summary>
public interface IValuationReportIssuanceService
{
    Task<ValuationReportIssuanceStateDto?> GetStateAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);

 /// <summary>ق-6-1: عند اكتمال الحواجب — تجميد كامل + توليد نسخة الإيداع (خانة الرمز فارغة).</summary>
    Task<(ValuationReportIssuanceStateDto? Result, Dictionary<string, string>? Errors)>
        IssueDepositAsync(
            Guid valuationRequestId,
            string? issuedByUserId,
            CancellationToken cancellationToken = default);

 /// <summary>ق-6-3/4: تسجيل الشهادة والرمز ثم توليد النسخة النهائية (صفحة الشهادة + الرمز في الميتا).</summary>
    Task<(ValuationReportIssuanceStateDto? Result, Dictionary<string, string>? Errors)>
        RegisterCertificateAsync(
            Guid valuationRequestId,
            RegisterDepositCertificateRequest request,
            string? uploadedByUserId,
            CancellationToken cancellationToken = default);

    Task<byte[]?> GetDepositPdfAsync(Guid valuationRequestId, CancellationToken cancellationToken = default);

    Task<byte[]?> GetFinalPdfAsync(Guid valuationRequestId, CancellationToken cancellationToken = default);
}
