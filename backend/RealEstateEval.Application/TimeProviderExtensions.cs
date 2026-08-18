namespace RealEstateEval.Application;

public static class TimeProviderExtensions
{
    public static DateTime UtcNow(this TimeProvider time) =>
        time.GetUtcNow().UtcDateTime;
}
