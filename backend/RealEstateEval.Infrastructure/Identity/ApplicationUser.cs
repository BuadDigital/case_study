using Microsoft.AspNetCore.Identity;

// Keep the historical CLR name so the existing EF migration metadata remains stable.
// The type is compiled into Infrastructure; Domain has no Identity dependency.
namespace RealEstateEval.Domain;

public class ApplicationUser : IdentityUser
{
    public string DisplayName { get; set; } = string.Empty;
}
