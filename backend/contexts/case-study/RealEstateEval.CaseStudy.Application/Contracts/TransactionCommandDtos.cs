using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.CaseStudy.Application.Contracts;

/// <summary>
/// Merge (decision 2026-10-19): the case-study specialist (once every deed finished intake — rule 2026-10-21) joins other
/// deeds' transactions into this one. A selected deed brings its whole transaction along.
/// </summary>
public class MergeTransactionsRequest
{
    /// <summary>Deeds whose transactions join this one (one per transaction is enough).</summary>
    [Required]
    public List<Guid> PropertyIds { get; init; } = [];

    /// <summary>one_building | contract.</summary>
    [Required, MaxLength(32)]
    public string LinkKind { get; init; } = "";

    [Required, MaxLength(2000)]
    public string Reason { get; init; } = "";
}

/// <summary>Takes one deed out of the transaction into a new draft transaction of its own.</summary>
public class UnmergeTransactionDeedRequest
{
    [Required]
    public Guid PropertyId { get; init; }

    [Required, MaxLength(2000)]
    public string Reason { get; init; } = "";
}

/// <summary>A deed found for the merge dialog, with why it cannot be merged when it cannot.</summary>
public class TransactionDeedSearchHitDto
{
    public Guid PropertyId { get; init; }
    public string PoNumber { get; init; } = "";
    public string IdentifierType { get; init; } = "deed";
    public string DeedNumber { get; init; } = "";
    public string? RealEstateRegNumber { get; init; }
    public string City { get; init; } = "";
    public string District { get; init; } = "";
    public string? OwnerName { get; init; }
    public Guid TransactionId { get; init; }
    public string TransactionNumber { get; init; } = "";
    public int TransactionDeedCount { get; init; }
    /// <summary>Arabic reason the deed cannot join; null when it can.</summary>
    public string? BlockedReasonAr { get; init; }
}
