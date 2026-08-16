namespace RealEstateEval.Infrastructure.Data;

/// <summary>PostgreSQL schema-per-service (shared database stepping stone).</summary>
public static class DatabaseSchemas
{
    public const string Identity = "identity";
    public const string CaseStudy = "case_study";
    public const string Platform = "platform";
    public const string Failures = "failures";
    public const string Operations = "operations";
    public const string Valuation = "valuation";
    public const string Attachments = "attachments";
    public const string Financial = "financial";
    public const string Messaging = "messaging";

 /// <summary>
 /// Shared append-only ledger. It holds one table so every writer can be granted INSERT on
 /// that table alone instead of a whole owner's schema.
 /// </summary>
    public const string Audit = "audit";

    public static readonly string[] All =
    [
        Identity,
        CaseStudy,
        Platform,
        Failures,
        Operations,
        Valuation,
        Attachments,
        Financial,
        Messaging,
        Audit,
    ];
}
