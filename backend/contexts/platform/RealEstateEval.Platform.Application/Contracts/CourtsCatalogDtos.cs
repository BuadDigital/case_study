namespace RealEstateEval.Platform.Application.Contracts;

public class CourtCatalogEntryDto
{
    public Guid Id { get; set; }
    public string City { get; set; } = "";
    public string Court { get; set; } = "";
    public List<string> Circuits { get; set; } = [];
}

public class SaveCourtsCatalogRequest
{
    public List<CourtCatalogEntryDto> Entries { get; set; } = [];
}
