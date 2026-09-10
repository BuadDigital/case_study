namespace RealEstateEval.Application.Contracts;

/// <summary>
/// The organization's uploaded logos — public, for the login page and the app shell. Null
/// means no custom logo was uploaded and the built-in mark is used.
/// </summary>
public sealed class OrganizationBrandLogosDto
{
    public string? LogoColorUrl { get; init; }
    public string? LogoWhiteUrl { get; init; }
    public string? UpdatedAt { get; init; }
}
