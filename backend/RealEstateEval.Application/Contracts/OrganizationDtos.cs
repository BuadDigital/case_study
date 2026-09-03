namespace RealEstateEval.Application.Contracts;

public class OrgPersonDto
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public required string Email { get; init; }
    public required string JobTitle { get; init; }
    public required string SystemRole { get; init; }
}

public class OrgDepartmentDto
{
    public required string Code { get; init; }
    public required string Title { get; init; }
    public required string Description { get; init; }
    public bool IsActive { get; init; }
}

public class OrganizationOverviewDto
{
    public OrgPersonDto? Cdo { get; init; }
    public required IReadOnlyList<OrgDepartmentDto> Departments { get; init; }
}
