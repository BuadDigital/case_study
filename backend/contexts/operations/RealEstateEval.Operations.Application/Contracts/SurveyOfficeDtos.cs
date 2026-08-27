namespace RealEstateEval.Operations.Application.Contracts;

public class SurveyOfficeDto
{
    public Guid Id { get; init; }
    public required string Name { get; init; }
    public int Active { get; init; }
    public int DoneMonth { get; init; }
    public required string AvgDays { get; init; }
    public required string Contract { get; init; }
    public bool StatusBusy { get; init; }
    public int SortOrder { get; init; }
}

public class PropertyKeyRecordDto
{
    public Guid Id { get; init; }
    public required string IdProp { get; init; }
    public required string Po { get; init; }
    public required string Area { get; init; }
    public required string Type { get; init; }
    public bool Key { get; init; }
    public required string Specialist { get; init; }
    public required string Status { get; init; }
    public string DeedStatus { get; init; } = "";
}

public class UpdatePropertyKeyRequest
{
    public bool? Key { get; init; }
    [System.ComponentModel.DataAnnotations.MaxLength(32)]
    public string? Status { get; init; }
}
