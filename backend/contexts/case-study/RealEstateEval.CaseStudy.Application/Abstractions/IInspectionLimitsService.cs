using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

public interface IInspectionLimitsService
{
    Task<InspectionLimitsDto?> GetAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken = default);

    Task<(InspectionLimitsDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        string poNumber,
        Guid propertyId,
        SaveInspectionLimitsRequest request,
        CancellationToken cancellationToken = default);

 /// <summary>ق-7 — اعتماد المقيّم المعتمد لنطاق «مكتبية عن بُعد» (مسجَّل بالتدقيق).</summary>
    Task<(InspectionLimitsDto? Result, string? Error)> ApproveRemoteAsync(
        string poNumber,
        Guid propertyId,
        string actorId,
        CancellationToken cancellationToken = default);
}
