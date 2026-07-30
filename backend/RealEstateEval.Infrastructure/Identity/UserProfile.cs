// Identity persistence types retain their historical namespace so existing migrations
// continue to describe the same CLR model while ownership moves to Infrastructure.
namespace RealEstateEval.Domain;

public class UserProfile
{
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;

    public RegistrationSource RegistrationSource { get; set; }
    public ContractType ContractType { get; set; }
    public string JobTitle { get; set; } = string.Empty;
    public string? DistributionAssigneeId { get; set; }
    public string? ReviewerCityCoverageJson { get; set; }
    public string? PermissionLevel { get; set; }
    public UserStatus Status { get; set; } = UserStatus.Active;
    public DateTime CreatedAtUtc { get; set; }

    public HrEmployeeProfile? HrEmployee { get; set; }
    public ProcServiceProviderProfile? ProcProvider { get; set; }
}
