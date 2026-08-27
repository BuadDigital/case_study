namespace RealEstateEval.Financial.Domain;

/// <summary>Singleton financial dashboard payload (JSON).</summary>
public class FinancialReportConfig
{
    public Guid Id { get; set; }
    public string ReportJson { get; set; } = "{}";
    public DateTime UpdatedAtUtc { get; set; }
}
