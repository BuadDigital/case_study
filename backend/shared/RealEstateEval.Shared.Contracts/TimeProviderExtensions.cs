namespace RealEstateEval.Application;

/// <summary>
/// Testable clock helper. Lives in Shared.Contracts (ADR 0002) so context libraries
/// and Infrastructure do not need the global Application assembly just to call
/// <c>time.UtcNow()</c>.
/// </summary>
public static class TimeProviderExtensions
{
    public static DateTime UtcNow(this TimeProvider time) =>
        time.GetUtcNow().UtcDateTime;
}