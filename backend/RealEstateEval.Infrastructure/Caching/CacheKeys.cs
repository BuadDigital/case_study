namespace RealEstateEval.Infrastructure.Caching;

public static class CacheKeys
{
    public const string ReportingDashboard = "reporting:dashboard:v4";
    public const string FinancialSummary = "financial:summary:v1";
    public const string SurveyOfficesList = "operations:survey-offices:v1";
    public const string CourtsCatalog = "platform:courts:v1";
}

public static class CacheDurations
{
    public static readonly TimeSpan Reporting = TimeSpan.FromSeconds(60);
    public static readonly TimeSpan Financial = TimeSpan.FromSeconds(60);
    public static readonly TimeSpan SurveyOffices = TimeSpan.FromSeconds(120);
    public static readonly TimeSpan CourtsCatalog = TimeSpan.FromMinutes(5);
}
