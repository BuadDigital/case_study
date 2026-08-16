namespace RealEstateEval.Domain;

public enum AssignmentType
{
    Execution = 0,
    Estates = 1,
    PrivateSector = 2,
}

public enum PropertyIdentifierType
{
    Deed = 0,
    RealEstateRegistration = 1,
    BourseInquiry = 2,
}

/// <summary>
/// Deed kind governing spatial confidence and the match gate (valuation spec §1.3 / §8b-4).
/// Registered title → definitive spatial data, no survey match; traditional → case-study match.
/// </summary>
public enum DeedKind
{
    /// <summary>Traditional deed — deed/nature match gate required before calc.</summary>
    Traditional = 0,
    /// <summary>Registered title — deed data definitive; survey match stage dropped.</summary>
    RegisteredTitle = 1,
}

public static class DeedKindLabels
{
    public const string Traditional = "traditional";
    public const string RegisteredTitle = "registered_title";

    public static string ToApiValue(DeedKind kind) => kind switch
    {
        DeedKind.RegisteredTitle => RegisteredTitle,
        _ => Traditional,
    };

    public static bool TryParseApiValue(string? value, out DeedKind kind)
    {
        var n = value?.Trim() ?? "";
        if (n is RegisteredTitle or "registered" or "عينية" or "سجل عيني")
        {
            kind = DeedKind.RegisteredTitle;
            return true;
        }

        kind = DeedKind.Traditional;
        return n is Traditional or "تقليدي" or "" || string.Equals(n, "traditional", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Initial suggestion from identifier type — real-estate registration → registered title.</summary>
    public static DeedKind SuggestFromIdentifier(PropertyIdentifierType identifier) =>
        identifier == PropertyIdentifierType.RealEstateRegistration
            ? DeedKind.RegisteredTitle
            : DeedKind.Traditional;

    public static string LabelAr(DeedKind kind) =>
        kind == DeedKind.RegisteredTitle ? "سجل عيني" : "صك تقليدي";
}

/// <summary>Deed↔nature match outcome — case-study gate before calc.</summary>
public static class DeedNatureMatchOutcomes
{
    public const string Unset = "";
    public const string Matched = "matched";
    public const string Differences = "differences";
    public const string Impediment = "impediment";
    public static bool IsKnown(string? value)
    {
        var n = value?.Trim() ?? "";
        return n is Unset or Matched or Differences or Impediment;
    }
}

public static class AssignmentTypeLabels
{
    public const string Execution = "تنفيذ";
    public const string Estates = "تركات";
    public const string PrivateSector = "قطاع خاص";

    public static string ToLabel(AssignmentType type) => type switch
    {
        AssignmentType.Execution => Execution,
        AssignmentType.Estates => Estates,
        AssignmentType.PrivateSector => PrivateSector,
        _ => Execution,
    };

    public static bool TryParseLabel(string? label, out AssignmentType type)
    {
        var n = label?.Trim() ?? "";
        if (n == Execution) { type = AssignmentType.Execution; return true; }
        if (n == Estates) { type = AssignmentType.Estates; return true; }
        if (n == PrivateSector) { type = AssignmentType.PrivateSector; return true; }
        type = AssignmentType.Execution;
        return false;
    }
}

public static class PropertyIdentifierTypeLabels {
    public const string Deed = "deed";
    public const string RealEstateReg = "real_estate_reg";
    public const string BourseInquiry = "bourse_inquiry";

    public static string ToApiValue(PropertyIdentifierType type) => type switch
    {
        PropertyIdentifierType.RealEstateRegistration => RealEstateReg,
        PropertyIdentifierType.BourseInquiry => BourseInquiry,
        _ => Deed,
    };

    public static bool TryParseApiValue(string? value, out PropertyIdentifierType type)
    {
        var n = value?.Trim() ?? "";
        if (n == RealEstateReg)
        {
            type = PropertyIdentifierType.RealEstateRegistration;
            return true;
        }
        if (n == BourseInquiry)
        {
            type = PropertyIdentifierType.BourseInquiry;
            return true;
        }
        type = PropertyIdentifierType.Deed;
        return n == Deed || string.IsNullOrEmpty(n);
    }
}

/// <summary>Manual PO lifecycle overrides set from the PO list menu.</summary>
public static class WorkOrderLifecycleStatus
{
    public const string Cancelled = "cancelled";
    public const string Stopped = "stopped";
}

/// <summary>PO list status returned to the shell.</summary>
public static class WorkOrderListStatus
{
    public const string New = "new";
    public const string UnderStudy = "under_study";
    public const string Cancelled = "cancelled";
    public const string Stopped = "stopped";
    public const string Completed = "completed";
    public const string PartiallyBilled = "partially_billed";
    public const string FullyBilled = "fully_billed";

    /// <param name="studiedCount">Properties whose case-study parent task is completed.</param>
    /// <param name="hasEnfazInvoice">True when an Enfaz invoice was issued for this PO.</param>
    public static string Resolve(
        WorkOrder order,
        int studiedCount,
        bool hasEnfazInvoice = false)
    {
        var lifecycle = order.LifecycleStatus?.Trim();
        if (lifecycle == WorkOrderLifecycleStatus.Cancelled) return Cancelled;
        if (lifecycle == WorkOrderLifecycleStatus.Stopped) return Stopped;

        var expected = Math.Max(1, order.ExpectedPropertyCount);
        var registered = order.Properties.Count(p => !p.IsRemoved);
        var allRegistered = registered > 0 && registered >= expected;
        var allStudied = allRegistered && studiedCount >= registered;

        // Billing labels only when finance actually issued an invoice.
        if (hasEnfazInvoice)
            return allStudied ? FullyBilled : PartiallyBilled;

        if (allStudied)
            return Completed;

        if (studiedCount > 0 || registered > 0)
            return UnderStudy;

        return New;
    }
}
