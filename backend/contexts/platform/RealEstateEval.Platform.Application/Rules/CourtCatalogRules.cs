using RealEstateEval.Domain;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Platform.Application.Rules;

/// <summary>
/// Admin-side decisions for the courts catalog: request validation and the audit change sets
/// written for create / update. Pure — the service supplies the entities and persists.
/// </summary>
public static class CourtCatalogRules
{
    public static string? ValidateCourt(string name, string region, string city)
    {
        if (name.Length is < 2 or > 150) return "اسم المحكمة مطلوب";
        if (string.IsNullOrWhiteSpace(region)) return "المنطقة غير صحيحة";
        if (string.IsNullOrWhiteSpace(city)) return "المدينة غير صحيحة";
        return null;
    }

    public static string? ValidateCircuitNo(string circuitNo) =>
        circuitNo.Length is < 1 or > 50 ? "رقم الدائرة مطلوب" : null;

    /// <summary>Blank circuit names are stored as null; everything else is trimmed.</summary>
    public static string? NormalizeCircuitName(string? circuitName) =>
        string.IsNullOrWhiteSpace(circuitName) ? null : circuitName.Trim();

    public static Dictionary<string, AuditValueChange> CourtCreated(Court entity) => new()
    {
        ["name"] = Diff(null, entity.Name),
        ["region"] = Diff(null, entity.Region),
        ["city"] = Diff(null, entity.City),
        ["isActive"] = Diff(null, entity.IsActive),
    };

    public static Dictionary<string, AuditValueChange> CircuitCreated(CourtCircuit entity) => new()
    {
        ["courtId"] = Diff(null, entity.CourtId),
        ["circuitNo"] = Diff(null, entity.CircuitNo),
        ["circuitName"] = Diff(null, entity.CircuitName),
        ["isActive"] = Diff(null, entity.IsActive),
    };

    /// <summary>Only the fields whose value actually changed are audited.</summary>
    public static Dictionary<string, AuditValueChange> CourtUpdated(
        (string Name, string Region, string City, bool IsActive) before,
        Court after)
    {
        var changes = new Dictionary<string, AuditValueChange>();
        if (!string.Equals(before.Name, after.Name, StringComparison.Ordinal))
            changes["name"] = Diff(before.Name, after.Name);
        if (!string.Equals(before.Region, after.Region, StringComparison.Ordinal))
            changes["region"] = Diff(before.Region, after.Region);
        if (!string.Equals(before.City, after.City, StringComparison.Ordinal))
            changes["city"] = Diff(before.City, after.City);
        if (before.IsActive != after.IsActive)
            changes["isActive"] = Diff(before.IsActive, after.IsActive);
        return changes;
    }

    public static Dictionary<string, AuditValueChange> CircuitUpdated(
        (string CircuitNo, string? CircuitName, bool IsActive) before,
        CourtCircuit after)
    {
        var changes = new Dictionary<string, AuditValueChange>();
        if (!string.Equals(before.CircuitNo, after.CircuitNo, StringComparison.Ordinal))
            changes["circuitNo"] = Diff(before.CircuitNo, after.CircuitNo);
        if (!string.Equals(before.CircuitName, after.CircuitName, StringComparison.Ordinal))
            changes["circuitName"] = Diff(before.CircuitName, after.CircuitName);
        if (before.IsActive != after.IsActive)
            changes["isActive"] = Diff(before.IsActive, after.IsActive);
        return changes;
    }

    public static Dictionary<string, AuditValueChange> StatusChanged(bool before, bool after) =>
        new() { ["isActive"] = Diff(before, after) };

    private static AuditValueChange Diff(object? before, object? after) => new(before, after);
}
