namespace RealEstateEval.Application.Abstractions;

public static class CacheKeys
{
    public const string ReportingDashboard = "reporting:dashboard:v5";
    public const string FinancialSummary = "financial:summary:v1";
    public const string SurveyOfficesList = "operations:survey-offices:v1";
    public const string CourtsCatalog = "platform:courts:v1";
    public const string RegionsCatalog = "platform:regions:v1";
    public const string CitiesCatalog = "platform:cities:v1";
}

public static class CacheDurations
{
    public static readonly TimeSpan Reporting = TimeSpan.FromSeconds(60);
    public static readonly TimeSpan Financial = TimeSpan.FromSeconds(60);
    public static readonly TimeSpan SurveyOffices = TimeSpan.FromSeconds(120);
    public static readonly TimeSpan CourtsCatalog = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan RegionsCatalog = TimeSpan.FromMinutes(30);
}
