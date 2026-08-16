using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Application.Contracts;

public class AttachmentPrintTypeDto
{
    public required string Id { get; init; }
    public required string Key { get; init; }
    public required string LabelAr { get; init; }
    /// <summary>Empty = applies to all property types.</summary>
    public IReadOnlyList<string> PropertyTypeKeys { get; init; } = [];
    public bool IsRequired { get; init; }
    public bool IsSystemDefault { get; init; }
    public int SortOrder { get; init; }
    public bool IsActive { get; init; } = true;
}

public class AttachmentPrintDictionaryDto
{
    public IReadOnlyList<AttachmentPrintTypeDto> Types { get; init; } = [];
    public DateTime UpdatedAtUtc { get; init; }
}

public class SaveAttachmentPrintDictionaryRequest
{
    public IReadOnlyList<AttachmentPrintTypeDto>? Types { get; init; }
}

public class ClassifyAttachmentRequest
{
    /// <summary>Dictionary type key; empty clears classification.</summary>
    [MaxLength(64)]
    public string? DictionaryTypeKey { get; init; }

    public bool? PrintInReport { get; init; }
}
