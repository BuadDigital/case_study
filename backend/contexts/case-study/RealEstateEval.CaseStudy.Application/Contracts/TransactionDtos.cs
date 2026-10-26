namespace RealEstateEval.CaseStudy.Application.Contracts;

/// <summary>The transaction (المعاملة) a deed belongs to, as the screens read it.</summary>
public class TransactionDto
{
    public Guid Id { get; init; }

    /// <summary>TMP-{YY}-{seq}; shown until the official reference exists.</summary>
    public string DraftNumber { get; init; } = "";

    /// <summary>PR-{YY}-{seq}; null until the first report approval.</summary>
    public string? ReferenceNumber { get; init; }

    /// <summary>The number people see: the official reference once confirmed, else the draft number.</summary>
    public string DisplayNumber { get; init; } = "";

    public string? ConfirmedAtUtc { get; init; }

    /// <summary>PRC-… when confirmed, else null.</summary>
    public string? CaseStudyReportNumber { get; init; }

    /// <summary>PRV-… when confirmed, else null.</summary>
    public string? ValuationReportNumber { get; init; }

    /// <summary>
    /// Decision 2026-10-19: why the deeds were merged — one_building («مبنى واحد») or contract
    /// («أعيان بعقد»), with the specialist's reason; null while the transaction holds one deed.
    /// </summary>
    public string? LinkKind { get; init; }

    public string? LinkKindLabelAr { get; init; }

    public string? LinkReason { get; init; }

    public int DeedCount { get; init; }
}

/// <summary>One deed of a transaction, enough for a switcher row and a link to its page.</summary>
public class TransactionDeedDto
{
    public Guid PropertyId { get; init; }
    public string PoNumber { get; init; } = "";
    public string IdentifierType { get; init; } = "deed";
    public string DeedNumber { get; init; } = "";
    public string? DeedDate { get; init; }
    public string? RealEstateRegNumber { get; init; }
    public string? RealEstateRegDate { get; init; }
    public string? DeedKindLabelAr { get; init; }
    public string City { get; init; } = "";
    public string District { get; init; } = "";
    public string? Area { get; init; }
    public bool IsRemoved { get; init; }
    public string CreatedAtUtc { get; init; } = "";
}

/// <summary>The transaction with its deeds (phase 2 page header, deed switcher, linked tab).</summary>
public class TransactionDetailDto : TransactionDto
{
    public IReadOnlyList<TransactionDeedDto> Deeds { get; init; } = [];

    /// <summary>Phase 4: the deed whose case-study parent task carries the one study.</summary>
    public Guid? StudyHolderPropertyId { get; init; }

    /// <summary>Phase 4: that parent task (the study workspace route), when it exists.</summary>
    public Guid? StudyHolderTaskId { get; init; }
}
