using RealEstateEval.Domain;
namespace RealEstateEval.CaseStudy.Domain;

public class PropertyContact : ITrackUpdatedAt
{
    public DateTime UpdatedAtUtc { get; set; }
    public Guid Id { get; set; }
    public Guid PropertyId { get; set; }
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
    public string Phone { get; set; } = "";
    public int SortOrder { get; set; }

    public WorkOrderProperty? Property { get; set; }
}
