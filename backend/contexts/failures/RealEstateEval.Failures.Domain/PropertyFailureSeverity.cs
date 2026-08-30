namespace RealEstateEval.Failures.Domain;

/// <summary>
/// Failure severity — previously free-text that collided with status constants
/// ("internal" was both a status and a severity). Single source of truth for stored values.
/// </summary>
public static class PropertyFailureSeverity
{
    public const string Suspected = "suspected";
    public const string Internal = "internal";
}
