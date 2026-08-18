namespace RealEstateEval.Application.Contracts;

public class CaseStudyInfoRolesConfigDto
{
    public Dictionary<string, Dictionary<string, string>> Matrix { get; set; } = [];
    public Dictionary<string, string> Notes { get; set; } = [];
    public DateTime UpdatedAt { get; set; }
}

public class SaveCaseStudyInfoRolesRequest
{
    public Dictionary<string, Dictionary<string, string?>> Matrix { get; set; } = [];
    public Dictionary<string, string> Notes { get; set; } = [];
}
