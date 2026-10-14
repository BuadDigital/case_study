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
/// Deed kind governing spatial confidence and the match gate (valuation spec b-4).
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
        if (n is RegisteredTitle or "registered" or "RegisteredTitle"
            or "عينية" or "سجل عيني")
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

    public static string Normalize(string? value) =>
        (value ?? "").Trim().ToLowerInvariant();

    /// <summary>
    /// Vocabulary check for draft saves — <see cref="Unset"/> (empty) is allowed.
    /// Unknown tokens are rejected. Prefer <see cref="IsChosen"/> for submit / valuation gates.
    /// </summary>
    public static bool IsKnown(string? value)
    {
        var n = Normalize(value);
        return n is Unset or Matched or Differences or Impediment;
    }

    /// <summary>
    /// Specialist chose a concrete outcome. Empty is not chosen — used by FE submit
    /// and valuation issuance for traditional deeds.
    /// </summary>
    public static bool IsChosen(string? value)
    {
        var n = Normalize(value);
        return n is Matched or Differences or Impediment;
    }

    public static bool RequiresNotes(string? value)
    {
        var n = Normalize(value);
        return n is Differences or Impediment;
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
    /// <summary>Every property is ready for the Enfaz handover (report issued, deposit done, parties complete) and at least one is not handed over yet.</summary>
    public const string ReadyForEnfaz = "ready_for_enfaz";
    public const string Cancelled = "cancelled";
    public const string Stopped = "stopped";
    /// <summary>Every property is handed over to Enfaz (delivered to the client).</summary>
    public const string Completed = "completed";
    public const string PartiallyBilled = "partially_billed";
    public const string FullyBilled = "fully_billed";

 /// <summary>
 /// The study status alone — what everyone outside Finance sees. Delivery is the Enfaz handover:
 /// a work order is <c>completed</c> only when every live property carries the handover stamp.
 /// </summary>
 /// <param name="expectedPropertyCount">Properties promised by Enfaz at intake.</param>
 /// <param name="registeredCount">Properties on the PO that are not removed.</param>
 /// <param name="readyCount">Live properties whose tasks are all complete or that are already closed.</param>
 /// <param name="closedCount">Live properties handed over to Enfaz, or whose tasks are all cancelled.</param>
    public static string ResolveStudy(
        string? lifecycleStatus,
        int expectedPropertyCount,
        int registeredCount,
        int readyCount,
        int closedCount)
    {
        var lifecycle = lifecycleStatus?.Trim();
        if (lifecycle == WorkOrderLifecycleStatus.Cancelled) return Cancelled;
        if (lifecycle == WorkOrderLifecycleStatus.Stopped) return Stopped;

        var expected = Math.Max(1, expectedPropertyCount);
        var registered = registeredCount;
        if (registered <= 0) return New;

        var allRegistered = registered >= expected;
        if (allRegistered && closedCount >= registered) return Completed;
        if (allRegistered && readyCount >= registered) return ReadyForEnfaz;
        return UnderStudy;
    }

 /// <summary>
 /// The billing-aware status Finance and management see: an issued Enfaz invoice relabels the
 /// study status as <c>fully_billed</c> (delivered) or <c>partially_billed</c> (not yet).
 /// </summary>
 /// <param name="hasEnfazInvoice">True when an Enfaz invoice was issued for this PO.</param>
    public static string Resolve(
        string? lifecycleStatus,
        int expectedPropertyCount,
        int registeredCount,
        int readyCount,
        int closedCount,
        bool hasEnfazInvoice = false)
    {
        var study = ResolveStudy(
            lifecycleStatus,
            expectedPropertyCount,
            registeredCount,
            readyCount,
            closedCount);
        if (study is Cancelled or Stopped) return study;

        // Billing labels only when finance actually issued an invoice.
        if (hasEnfazInvoice)
            return study == Completed ? FullyBilled : PartiallyBilled;

        return study;
    }
}
