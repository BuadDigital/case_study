namespace RealEstateEval.Shared.Web;

/// <summary>Per-service connection string keys (same DB in dev; separate in prod).</summary>
public static class ServiceDatabaseNames
{
    public const string Identity = "Identity";
    public const string CaseStudy = "CaseStudy";
    public const string Operations = "Operations";
    public const string Reporting = "Reporting";
    public const string Financial = "Financial";
    public const string Valuation = "Valuation";
    public const string Failures = "Failures";
    public const string Platform = "Platform";
    public const string Attachments = "Attachments";
}
