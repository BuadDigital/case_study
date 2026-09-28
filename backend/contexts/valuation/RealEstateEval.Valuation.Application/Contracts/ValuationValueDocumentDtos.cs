using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Valuation.Application.Contracts;

/// <summary>
/// The «مستندات ذات قيمة» of the request's property with the appraiser's decision on each.
/// Only the case specialist, the appraiser and the CDO reach this.
/// </summary>
public sealed class ValuationValueDocumentsDto
{
    public Guid ValuationRequestId { get; init; }
    /// <summary>Approaches the system values itself here — a document indicator cannot use them.</summary>
    public IReadOnlyList<string> InternalApproachKinds { get; init; } = [];
    public IReadOnlyList<ValuationValueDocumentDto> Documents { get; init; } = [];
}

public sealed class ValuationValueDocumentDto
{
    public Guid AttachmentId { get; init; }
    public required string LabelAr { get; init; }
    public string FileName { get; init; } = "";
    public string ContentType { get; init; } = "";
    public DateTime? CreatedAtUtc { get; init; }
    /// <summary>pending / approved / rejected — the case specialist's decision.</summary>
    public string Status { get; init; } = "pending";
    public string? ReviewNote { get; init; }
    /// <summary>The document was used but is no longer on the property (deleted).</summary>
    public bool Missing { get; init; }

    /// <summary>null = no effect; indicator / addition.</summary>
    public string? Effect { get; init; }
    public string? ApproachKey { get; init; }
    public string? MethodName { get; init; }
    public decimal? Value { get; init; }
}

public sealed class SaveValuationValueDocumentsRequest
{
    /// <summary>Documents with an effect; any document left out has no effect.</summary>
    public IReadOnlyList<SaveValuationValueDocumentUseRequest> Uses { get; init; } = [];
}

public sealed class SaveValuationValueDocumentUseRequest
{
    public Guid AttachmentId { get; init; }

    [Required(ErrorMessage = "اختر أثر المستند")]
    [MaxLength(16, ErrorMessage = "أثر المستند غير معروف")]
    public string Effect { get; init; } = "";

    [MaxLength(16, ErrorMessage = "الأسلوب غير معروف")]
    public string? ApproachKey { get; init; }

    [MaxLength(128, ErrorMessage = "اسم الطريقة أطول من المسموح")]
    public string? MethodName { get; init; }

    public decimal Value { get; init; }
}

/// <summary>A valued document on the property as the attachments context reports it.</summary>
public sealed record ValuedDocumentLookupDto(
    Guid AttachmentId,
    string LabelAr,
    string FileName,
    string ContentType,
    DateTime CreatedAtUtc,
    string Status,
    string? ReviewNote);
