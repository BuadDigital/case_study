namespace RealEstateEval.CaseStudy.Application.Contracts;

/// <summary>The property (the transaction above the deeds) a deed belongs to, as the screens read it.</summary>
public class TransactionDto
{
    public Guid Id { get; init; }

    /// <summary>
    /// The property's number: a single deed's own PR-{YY}-{seq}, a linked property's PR-{YY}-{seq}-L;
    /// null until a deed is numbered (ruling 2026-11-08).
    /// </summary>
    public string? ReferenceNumber { get; init; }

    /// <summary>The number people see: <see cref="ReferenceNumber"/>, or "" while none exists.</summary>
    public string DisplayNumber { get; init; } = "";

    /// <summary>When the number was locked (first approved report / Enfaz handover); null before.</summary>
    public string? ConfirmedAtUtc { get; init; }

    /// <summary>PRC-… derived from the property number, else null.</summary>
    public string? CaseStudyReportNumber { get; init; }

    /// <summary>PRV-… derived from the property number, else null.</summary>
    public string? ValuationReportNumber { get; init; }

    /// <summary>
    /// Why the deeds were merged — one_building («مبنى واحد») or contract
    /// («أعيان بعقد»), with the specialist's reason; null while the transaction holds one deed.
    /// </summary>
    public string? LinkKind { get; init; }

    public string? LinkKindLabelAr { get; init; }

    public string? LinkReason { get; init; }

    /// <summary>Where the transaction stands with review (Omar 2026-11-05): study | handed | approved.</summary>
    public string ReviewState { get; init; } = "study";

    public int DeedCount { get; init; }
}

/// <summary>One deed of a transaction, enough for a switcher row and a link to its page.</summary>
public class TransactionDeedDto
{
    public Guid PropertyId { get; init; }
    public string PoNumber { get; init; } = "";
    /// <summary>«رقم المعاملة» — the deed's own PR number; null while it waits for its initial data.</summary>
    public string? ReferenceNumber { get; init; }
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

    /// <summary>The formal receipt by coordination (ruling 2026-11-02); null while not received.</summary>
    public string? ReceivedAtUtc { get; init; }

    public string? ReceivedByName { get; init; }

    /// <summary>«يعمل عليها الآن»: the last specialist who opened or saved it, and when (information only).</summary>
    public string? WorkingByUserId { get; init; }

    public string? WorkingByName { get; init; }

    public string? WorkingAtUtc { get; init; }
}

/// <summary>One delivery awaited from a party outside the system (Omar 2026-11-08).</summary>
public class TransactionExternalReceiptDto
{
    public string Id { get; init; } = "";
    public string PartyName { get; init; } = "";
    public string Awaited { get; init; } = "";
    /// <summary>pending | received | cancelled.</summary>
    public string Status { get; init; } = "";
    public string CreatedAtUtc { get; init; } = "";
    public string? CreatedByName { get; init; }
    public string? ReceivedAtUtc { get; init; }
    public string? ReceivedByName { get; init; }
    public string? Note { get; init; }
}

/// <summary>«إضافة استلام من طرف خارجي»: who delivers, and what is awaited.</summary>
public class AddTransactionExternalReceiptRequest
{
    public string? PartyName { get; set; }
    public string? Awaited { get; set; }
}

/// <summary>Close an external delivery — received, or no longer awaited — with an optional word.</summary>
public class CloseTransactionExternalReceiptRequest
{
    public string? Note { get; set; }
}

/// <summary>Why a transaction cannot be formally received yet, and whether it was.</summary>
public class TransactionReceiptDto
{
    public bool Received { get; init; }
    public string? ReceivedAtUtc { get; init; }
    public string? ReceivedByName { get; init; }
}
