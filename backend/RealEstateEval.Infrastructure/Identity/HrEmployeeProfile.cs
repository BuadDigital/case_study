namespace RealEstateEval.Domain;

public class HrEmployeeProfile
{
    public string UserId { get; set; } = string.Empty;
    public UserProfile Profile { get; set; } = null!;

    public string EmploymentType { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string? Section { get; set; }
    public string? NationalId { get; set; }
    public string? EmployeeNumber { get; set; }
    public DateOnly? JoinDate { get; set; }
}
