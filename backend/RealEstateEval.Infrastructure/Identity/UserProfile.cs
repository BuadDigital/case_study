// Identity persistence types retain their historical namespace so existing migrations
// continue to describe the same CLR model while ownership moves to Infrastructure.
namespace RealEstateEval.Domain;

public class UserProfile
{
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;
    public RegistrationSource RegistrationSource { get; set; }
    public ContractType ContractType { get; set; }
 /// <summary>Canonical product role id (for example case-specialist).</summary>
    public string? RoleId { get; set; }
    public string JobTitle { get; set; } = string.Empty;
    public string? Department { get; set; }
    public string? City { get; set; }
    public string? NationalId { get; set; }
    public string? AvatarUrl { get; set; }
 /// <summary>employee | contractor; only meaningful for field-inspector.</summary>
    public string? InspectorType { get; set; }
    public bool HasCompensation { get; set; }
    public decimal? FeeValueSar { get; set; }
    public string? Iban { get; set; }
    public string? TaxNumber { get; set; }
    public string? CommercialRegistration { get; set; }
    public DateOnly? JoinedAt { get; set; }
    public string? DistributionAssigneeId { get; set; }
    public string? ReviewerCityCoverageJson { get; set; }
    public string? PermissionLevel { get; set; }
    public UserStatus Status { get; set; } = UserStatus.Active;
 /// <summary>ورشة الترقيم: الرقم المرجعي الداخلي US-{سنة}-{تسلسل ٥}.</summary>
    public string? ReferenceNumber { get; set; }
 /// <summary>Last successful session issue.</summary>
    public DateTime? LastLoginAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }

    public HrEmployeeProfile? HrEmployee { get; set; }
    public ProcServiceProviderProfile? ProcProvider { get; set; }
}
