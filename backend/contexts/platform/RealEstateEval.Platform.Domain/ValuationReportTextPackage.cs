namespace RealEstateEval.Platform.Domain;

/// <summary>
/// Decision 23 (amended by Q-15: "one version for the package"): standard/legal texts are one block
/// in admin and issuance with a single package version number — any edit, even one paragraph, issues a full
/// new text package. Rows are immutable (version history); distinction inside the report stays
/// by position and title; the version number labels the package, not the paragraph.
/// In-progress reports adopt the latest automatically; issued reports are frozen on their texts at issuance
/// (Q-6 snapshot) — no retroactive change. No English copies currently (decision 23-3).
/// </summary>
public class ValuationReportTextPackage
{
    public Guid Id { get; set; }

 /// <summary>Package serial number — "standard texts: package version N".</summary>
    public int Version { get; set; }

 /// <summary>Managed block (the six organization-settings fields) as well-formed JSON.</summary>
    public string TextsJson { get; set; } = "{}";

    public DateTime CreatedAtUtc { get; set; }
    public string? CreatedByUserId { get; set; }
}

/// <summary>First package value — shipped default texts count implicitly as "version 1".</summary>
public static class ReportTextPackageRules
{
    public const int InitialVersion = 1;
}
