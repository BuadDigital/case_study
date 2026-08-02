namespace RealEstateEval.Application;

/// <summary>How a <c>PartyFeePricingTable</c> produces an amount.</summary>
public static class PartyFeePricingKinds
{
    /// <summary>Engineering survey — area tiers.</summary>
    public const string Tiered = "tiered";

    /// <summary>Cooperator / government-review party rates (existing columns).</summary>
    public const string PartyRates = "party-rates";

    /// <summary>Employee incentive — single flat amount managed for assignees with compensation.</summary>
    public const string Flat = "flat";

    public static readonly string[] All = [Tiered, PartyRates, Flat];

    public static bool IsValid(string? value) =>
        value is Tiered or PartyRates or Flat;

    public static string Require(string? value) =>
        IsValid(value)
            ? value!
            : throw new ArgumentException(InvalidMessage(value), nameof(value));

    public static string InvalidMessage(string? value) =>
        $"نوع التسعير «{value}» غير معروف. المسموح: {string.Join(" · ", All)}.";

    /// <summary>Default kind for a newly created table of the given category.</summary>
    public static string DefaultForCategory(string category) => category switch
    {
        PartyFeePricingCategories.EngineeringSurvey => Tiered,
        _ => PartyRates,
    };
}

/// <summary>Who may edit the rates on a pricing table.</summary>
public static class PartyFeePricingManagers
{
    public const string SystemAdmin = "system-admin";
    public const string Supervisor = "supervisor";

    public static readonly string[] All = [SystemAdmin, Supervisor];

    public static bool IsValid(string? value) =>
        value is SystemAdmin or Supervisor;

    public static string Require(string? value) =>
        IsValid(value)
            ? value!
            : throw new ArgumentException(InvalidMessage(value), nameof(value));

    public static string InvalidMessage(string? value) =>
        $"مدير التسعير «{value}» غير معروف. المسموح: {string.Join(" · ", All)}.";
}
