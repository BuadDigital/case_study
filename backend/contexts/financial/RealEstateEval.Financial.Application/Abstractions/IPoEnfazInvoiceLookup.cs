namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Work-order list billed flag. Financial host uses EF; Case Study calls HTTP.
/// </summary>
public interface IPoEnfazInvoiceLookup
{
    Task<IReadOnlyList<string>> ListBilledPoNumbersAsync(
        IReadOnlyList<string> poNumbers,
        CancellationToken cancellationToken = default);
}
