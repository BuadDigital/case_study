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

 /// <summary>
 /// تكميلية ق-9 (ر3): بعد رفع إنفاذ — قيد تدقيق بقرار المدير العام وسببه حصراً؛
 /// لا يفتح شيئاً (استرجاع فعلي من إنفاذ يمر عبر ر2 في التقييم).
 /// </summary>
    Task<string?> RecordPostEnfazDecisionAsync(
        Guid workOrderId,
        Guid propertyId,
        PostEnfazDecisionRequest request,
        string? actorId,
        string? actorRole,
        CancellationToken cancellationToken = default);
}
