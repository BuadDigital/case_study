namespace RealEstateEval.CaseStudy.Domain;

/// <summary>
/// «يعمل عليها الآن»: the last specialist who opened or saved a transaction, shown to the others as
/// information only (ruling 2026-11-02 — shared queues, no lock). One row per transaction, upserted;
/// kept apart from <see cref="Transaction"/> so a frequent heartbeat never races its other writes.
/// </summary>
public class TransactionWorkMarker
{
    public Guid TransactionId { get; set; }

    public string UserId { get; set; } = "";

    public string DisplayName { get; set; } = "";

    public DateTime AtUtc { get; set; }
}
