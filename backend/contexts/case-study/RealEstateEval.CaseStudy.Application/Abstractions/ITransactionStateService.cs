using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>ق-9: آلة حالات المعاملة — الاشتقاق من حالات الأطراف + رفع إنفاذ الشامل.</summary>
public interface ITransactionStateService
{
    Task<TransactionStateDto?> GetStateAsync(
        Guid workOrderId,
        Guid propertyId,
        CancellationToken cancellationToken = default);

 /// <summary>الختام الثاني: تسليم شامل بعد شهادة الإيداع واكتمال الأطراف.</summary>
    Task<(TransactionStateDto? Result, string? Error)> RecordEnfazHandoverAsync(
        Guid workOrderId,
        Guid propertyId,
        string? recordedByUserId,
        CancellationToken cancellationToken = default);
}
