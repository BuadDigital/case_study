namespace RealEstateEval.CaseStudy.Application.Contracts;

/// <summary>ق-9: حالة المعاملة المشتقة — شبكة المراحل والأطراف و«من ينتظر من».</summary>
public class TransactionStageStateDto
{
    public required string Key { get; init; }
    public required string LabelAr { get; init; }
    public required string Status { get; init; }
    public required string StatusLabelAr { get; init; }
}

public class TransactionPartyStateDto
{
    public required string Key { get; init; }
    public required string LabelAr { get; init; }
    public required string Status { get; init; }
    public required string StatusLabelAr { get; init; }
    public IReadOnlyList<string> WaitingOn { get; init; } = [];
    public IReadOnlyList<string> WaitingOnLabelsAr { get; init; } = [];
}

public class TransactionStateDto
{
    public Guid WorkOrderId { get; init; }
    public Guid PropertyId { get; init; }
    public IReadOnlyList<TransactionStageStateDto> Stages { get; init; } = [];
    public IReadOnlyList<TransactionPartyStateDto> Parties { get; init; } = [];
    public required string OverallStatus { get; init; }
    public required string OverallStatusLabelAr { get; init; }
    public string WaitingSummaryAr { get; init; } = "";

 /// <summary>الختام الثاني جاهز: شهادة الإيداع صادرة وكل الأطراف مكتملة.</summary>
    public bool AllowsEnfazHandover { get; init; }
    public string? EnfazHandoverAtUtc { get; init; }
 /// <summary>حزمة رفع إنفاذ (ق-9/ق-14).</summary>
    public IReadOnlyList<string> HandoverPackageAr { get; init; } = [];
}

/// <summary>
/// تكميلية ق-9 (ر3): بعد رفع إنفاذ لا يفتح النظام شيئاً آلياً — المدير العام يسجّل
/// قراره (قناة إنفاذ الرسمية) قيدَ تدقيق فقط؛ استرجاع فعلي من إنفاذ يمر عبر ر2.
/// </summary>
public class PostEnfazDecisionRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(256)]
    public string Decision { get; init; } = "";

    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(1024)]
    public string Reason { get; init; } = "";
}
