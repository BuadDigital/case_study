namespace RealEstateEval.Financial.Domain;

/// <summary>
/// Explicit finance lifecycle flag for an Enfaz tracking row (optional property scope).
/// Design: suspended / excluded when centre or finance marks blocked / final exclusion.
/// </summary>
public class PoEnfazFinanceFlag
{
    public Guid Id { get; set; }
    public string PoNumber { get; set; } = "";
 /// <summary>When null, flag applies to all properties under the PO.</summary>
    public Guid? PropertyId { get; set; }
 /// <summary>stopped | excluded | difficult</summary>
    public string Flag { get; set; } = PoEnfazFinanceFlagKind.Stopped;
    public string? Note { get; set; }
    public string SetByUserId { get; set; } = "";
    public DateTime SetAtUtc { get; set; }
}

public static class PoEnfazFinanceFlagKind
{
    public const string Stopped = "stopped";
    public const string Excluded = "excluded";
    public const string Difficult = "difficult";
}
