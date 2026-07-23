namespace RealEstateEval.Domain;

public class UserProfile
{
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;

    public RegistrationSource RegistrationSource { get; set; }
    public ContractType ContractType { get; set; }
    public string JobTitle { get; set; } = string.Empty;
    /// <summary>Stable id used in workflow task distribution (e.g. fi-ahmed).</summary>
    public string? DistributionAssigneeId { get; set; }
    /// <summary>JSON array of city names for government reviewer scope (e.g. ["الرياض","الطائف"]).</summary>
    public string? ReviewerCityCoverageJson { get; set; }
    public string? PermissionLevel { get; set; }
    public UserStatus Status { get; set; } = UserStatus.Active;
    public DateTime CreatedAtUtc { get; set; }

    public HrEmployeeProfile? HrEmployee { get; set; }
    public ProcServiceProviderProfile? ProcProvider { get; set; }
}
