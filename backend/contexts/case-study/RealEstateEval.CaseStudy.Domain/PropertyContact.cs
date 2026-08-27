namespace RealEstateEval.Domain;

public class PropertyContact
{
    public Guid Id { get; set; }
    public Guid PropertyId { get; set; }
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
    public string Phone { get; set; } = "";
    public int SortOrder { get; set; }

    public WorkOrderProperty? Property { get; set; }
}
