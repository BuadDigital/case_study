namespace RealEstateEval.Application.Contracts;

public class PermissionsDto
{
    public required string UserId { get; init; }
    public IReadOnlyList<string> IdentityRoles { get; init; } = [];
    public string? PrototypeRole { get; init; }
    public string? DisplayName { get; init; }
    public string? DistributionAssigneeId { get; init; }
    public IReadOnlyList<string> Pages { get; init; } = [];
    public IReadOnlyList<string> Capabilities { get; init; } = [];
}

public class MeDto
{
    public required string Id { get; init; }
    public required string Email { get; init; }
    public required string DisplayName { get; init; }
    public PermissionsDto? Permissions { get; init; }
}
