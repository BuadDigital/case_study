namespace RealEstateEval.Domain;

public class SurveyOffice
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public int ActiveCount { get; set; }
    public int DoneMonth { get; set; }
    public string AvgDaysLabel { get; set; } = "";
    public string ContractLabel { get; set; } = "";
    public bool StatusBusy { get; set; }
    public int SortOrder { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
