using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.CaseStudy.Application.Contracts;

public class NumberedDocumentDto
{
    public Guid Id { get; init; }
 /// <summary>letter | case-study-report.</summary>
    public string Kind { get; init; } = "";
    public string ReferenceNumber { get; init; } = "";
    public string PoNumber { get; init; } = "";
    public Guid? PropertyId { get; init; }
    public string Title { get; init; } = "";
    public DateTime CreatedAtUtc { get; init; }
}

public class AllocateNumberedDocumentRequest
{
    [Required]
    public string Kind { get; set; } = "";

    [MaxLength(64)]
    public string? PoNumber { get; set; }

    public Guid? PropertyId { get; set; }

    [MaxLength(512)]
    public string? Title { get; set; }
}
