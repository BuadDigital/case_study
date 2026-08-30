using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Domain;

public class WorkOrder
{
    public Guid Id { get; set; }
    public string PoNumber { get; set; } = "";
    public AssignmentType AssignmentType { get; set; }
 /// <summary>Promulgation date from Infath.</summary>
    public DateOnly PromulgationDate { get; set; }
    public DateOnly ReceivedFromEnfathAt { get; set; }
    public string? ReceivedFromEnfathTime { get; set; }
    public string? AssignmentSpecialist { get; set; }
    public string? AssignmentSpecialistEmail { get; set; }
 /// <summary>Property count from Infath at promulgation.</summary>
    public int ExpectedPropertyCount { get; set; } = 1;
    public DateOnly DueDateAt { get; set; }
    public DateTime CreatedAtUtc { get; set; }
 /// <summary>Manual override: cancelled | stopped — otherwise status is computed.</summary>
    public string? LifecycleStatus { get; set; }
 /// <summary>Optional text — properties region.</summary>
    public string? PropertiesRegion { get; set; }
 /// <summary>Optional text — work-order description.</summary>
    public string? WorkOrderDescription { get; set; }

 /// <summary>Transaction client — required.</summary>
    public Guid? ClientId { get; set; }

 /// <summary>JSON array of client ids for report users (0..n) — see <see cref="WorkOrderReportUsers"/>.</summary>
    public string? ReportUserClientIdsJson { get; set; }

    public Client? Client { get; set; }
    public ICollection<WorkOrderProperty> Properties { get; set; } = [];

}

/// <summary>report users (0..n) from the client registry, stored as a JSON id list.</summary>
public static class WorkOrderReportUsers
{
    public static IReadOnlyList<Guid> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<List<Guid>>(json) ?? [];
        }
        catch (System.Text.Json.JsonException)
        {
            return [];
        }
    }

    public static string? Serialize(IEnumerable<Guid>? ids)
    {
        var cleaned = (ids ?? []).Where(id => id != Guid.Empty).Distinct().ToList();
        return cleaned.Count == 0
            ? null
            : System.Text.Json.JsonSerializer.Serialize(cleaned);
    }
}
