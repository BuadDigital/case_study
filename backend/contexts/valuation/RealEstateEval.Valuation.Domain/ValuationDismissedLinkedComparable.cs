namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// A comparable linked to the subject property that the appraiser removed from this valuation's
/// tables. While the row exists, the automatic import of property-linked comparables (on every
/// market read) leaves that comparable out — so a removal sticks.
/// <para>
/// One row per (valuation request, comparable). Written when a property-linked comparable is removed
/// (one by one or dropped by a list replace); deleted when the appraiser adds it back from the bank.
/// A comparable linked to the property later has no row and is still imported.
/// </para>
/// </summary>
public class ValuationDismissedLinkedComparable
{
    public Guid Id { get; set; }
    public Guid ValuationRequestId { get; set; }
    public Guid ComparablePropertyId { get; set; }
    public DateTime DismissedAtUtc { get; set; }
}
