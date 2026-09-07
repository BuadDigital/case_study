using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Rules;

/// <summary>
/// Finance flag input rules for Enfaz tracking rows: the accepted flag kinds, the optional
/// property scope, the note cap, which stored flag a request lands on, and what a clear removes.
/// Pure — the service loads the PO's flags and saves.
/// </summary>
public static class PoEnfazFinanceFlagRules
{
    public const int MaxNoteLength = 1000;

    /// <summary>The flag kind, lower-cased; null when it is not one of the three known kinds.</summary>
    public static string? NormalizeFlag(string? raw)
    {
        var flag = (raw ?? "").Trim().ToLowerInvariant();
        return flag is
            PoEnfazFinanceFlagKind.Stopped
            or PoEnfazFinanceFlagKind.Excluded
            or PoEnfazFinanceFlagKind.Difficult
            ? flag
            : null;
    }

    /// <summary>A property id narrows the flag to one property; anything unparsable means the whole PO.</summary>
    public static Guid? ParsePropertyId(string? raw) =>
        !string.IsNullOrWhiteSpace(raw) && Guid.TryParse(raw.Trim(), out var parsed)
            ? parsed
            : null;

    /// <summary>Notes are trimmed, capped, and null when blank.</summary>
    public static string? NormalizeNote(string? raw)
    {
        var note = string.IsNullOrWhiteSpace(raw) ? null : raw.Trim();
        if (note is { Length: > MaxNoteLength }) note = note[..MaxNoteLength];
        return note;
    }

    /// <summary>The stored flag a set request updates: same scope, else the PO-wide one for a PO-wide request.</summary>
    public static PoEnfazFinanceFlag? MatchFlag(
        IEnumerable<PoEnfazFinanceFlag> existing,
        Guid? propertyId) =>
        existing.FirstOrDefault(f => f.PropertyId == propertyId)
        ?? existing.FirstOrDefault(f => propertyId is null && f.PropertyId is null);

    /// <summary>A clear removes the flags of exactly the requested scope.</summary>
    public static List<PoEnfazFinanceFlag> FlagsToClear(
        IEnumerable<PoEnfazFinanceFlag> existing,
        Guid? propertyId) =>
        existing.Where(f =>
            propertyId is null
                ? f.PropertyId is null
                : f.PropertyId == propertyId).ToList();

    public static PoEnfazFinanceFlag NewFlag(
        string poNumber,
        Guid? propertyId,
        string flag,
        string? note,
        string actorUserId,
        DateTime nowUtc) => new()
        {
            Id = Guid.NewGuid(),
            PoNumber = poNumber,
            PropertyId = propertyId,
            Flag = flag,
            Note = note,
            SetByUserId = actorUserId ?? "",
            SetAtUtc = nowUtc,
        };

    public static void ApplyFlag(
        PoEnfazFinanceFlag match,
        string flag,
        string? note,
        string actorUserId,
        DateTime nowUtc)
    {
        match.Flag = flag;
        match.Note = note;
        match.SetByUserId = actorUserId ?? "";
        match.SetAtUtc = nowUtc;
    }
}
