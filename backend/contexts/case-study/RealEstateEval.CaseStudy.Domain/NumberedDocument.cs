namespace RealEstateEval.CaseStudy.Domain;

/// <summary>
/// Register of numbered documents (Decision 25 + numbering workshop): Entities 5–6 — Letters
/// (LT) and case study reports (CS). The row is created the moment the number is assigned when printing/
/// Versioned and not modified afterward — a reference record, not a document store.
/// </summary>
public class NumberedDocument
{
    public Guid Id { get; set; }
 /// <summary>letter | case-study-report.</summary>
    public string Kind { get; set; } = "";
    public string ReferenceNumber { get; set; } = "";
    public string PoNumber { get; set; } = "";
    public Guid? PropertyId { get; set; }
 /// <summary>A descriptive title — such as “Internal Authorization Letter — Court Visit.”</summary>
    public string Title { get; set; } = "";
    public string CreatedByUserId { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
}

public static class NumberedDocumentKinds
{
    public const string Letter = "letter";
    public const string CaseStudyReport = "case-study-report";

    public static bool IsValid(string kind) =>
        kind is Letter or CaseStudyReport;
}
