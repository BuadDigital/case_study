namespace RealEstateEval.Domain;

public class ProcServiceProviderProfile
{
    public string UserId { get; set; } = string.Empty;
    public UserProfile Profile { get; set; } = null!;

    public ProcProviderKind ProviderKind { get; set; }
    public string? FullName { get; set; }
    public string? OrganizationName { get; set; }
    public string? CommercialRegistration { get; set; }
    public string? DelegateName { get; set; }
    public string? NationalId { get; set; }
    public string ServiceType { get; set; } = string.Empty;
    public string? Sector { get; set; }
    public string? Address { get; set; }
    public string? Region { get; set; }
    public string? BankName { get; set; }
    public string? Iban { get; set; }
    public string? BillingEmail { get; set; }
    public string? VatRegistration { get; set; }
}
