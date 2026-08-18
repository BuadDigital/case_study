namespace RealEstateEval.Domain;

public class CourtCatalogEntry
{
    public Guid Id { get; set; }
    public string City { get; set; } = "";
    public string Court { get; set; } = "";
    public string CircuitsJson { get; set; } = "[]";
}
