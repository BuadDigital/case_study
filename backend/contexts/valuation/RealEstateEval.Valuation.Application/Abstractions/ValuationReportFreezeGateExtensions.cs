using RealEstateEval.Domain;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Abstractions;

public static class ValuationReportFreezeGateExtensions
{
    /// <summary>
    /// Null when the appraiser may still edit the request; otherwise the Arabic reason to return as
    /// the field error: <paramref name="doneMessage"/> once the request is done, else the freeze
    /// gate's answer (after the deposit copy only the code and certificate stay recordable).
    /// </summary>
    public static async Task<string?> GetWriteBlockedMessageAsync(
        this IValuationReportFreezeGate freeze,
        ValuationRequest vr,
        string doneMessage,
        CancellationToken cancellationToken = default)
    {
        if (vr.Status == ValuationRequestStatus.Done) return doneMessage;
        return await freeze.GetFrozenMessageAsync(vr.Id, vr.PropertyId, cancellationToken);
    }
}
