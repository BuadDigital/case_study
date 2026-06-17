using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Application.Contracts;

public class CustomAssignedScreenUserDto
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public required string Email { get; init; }
    public required string UserName { get; init; }
}

public class CustomAssignedScreenDto
{
    public Guid Id { get; init; }
    public required string Name { get; init; }
    public string? TargetPageId { get; init; }
    public string? IconPath { get; init; }
    public bool IsActive { get; init; }
    public int SortOrder { get; init; }
    public DateTime UpdatedAtUtc { get; init; }
    public IReadOnlyList<string> AssignedUserIds { get; init; } = [];
    public IReadOnlyList<CustomAssignedScreenUserDto> AssignedUsers { get; init; } = [];
}

public class SaveCustomAssignedScreenRequest
{
    [Required]
    [MaxLength(256)]
    public string Name { get; init; } = "";

    [MaxLength(128)]
    public string? TargetPageId { get; init; }

    [MaxLength(512)]
    public string? IconPath { get; init; }

    public bool IsActive { get; init; } = true;

    public int SortOrder { get; init; }

    public IReadOnlyList<string> AssignedUserIds { get; init; } = [];
}
