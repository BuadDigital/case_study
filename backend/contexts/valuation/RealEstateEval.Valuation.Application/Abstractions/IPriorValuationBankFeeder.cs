namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>
// / the shared bank includes prior transactions: a completed valuation's
/// subject enters the bank as a «تقييم سابق» comparable (source card: من معاملات سابقة).
/// </summary>
public interface IPriorValuationBankFeeder
{
 /// <summary>Best-effort, idempotent — returns true when a bank row was created.</summary>
    Task<bool> FeedAsync(Guid valuationRequestId, CancellationToken cancellationToken = default);
}
