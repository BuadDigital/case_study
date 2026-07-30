namespace RealEstateEval.Infrastructure.Data;

/// <summary>
/// Indexes whose violation is translated into a business error. Naming them here keeps the
/// model configuration and the conflict handling in the services from drifting apart.
/// </summary>
public static class DatabaseIndexNames
{
    public const string ValuationRequestDisplayId = "IX_ValuationRequests_DisplayId";
    public const string ValuationRequestOpenPerProperty = "IX_ValuationRequests_PropertyId_Open";
    public const string UserNotificationUnreadSourceEvent =
        "IX_UserNotifications_UserId_SourceEvent_Unread";
    public const string OutboxPendingByCreatedAt = "IX_OutboxMessages_Pending_CreatedAtUtc";
    public const string PushSubscriptionEndpoint = "IX_PushSubscriptions_Endpoint";
}

/// <summary>PostgreSQL sequences owned by the model.</summary>
public static class DatabaseSequences
{
    /// <summary>Backs the human-readable <c>VR-&lt;n&gt;</c> valuation request identifier.</summary>
    public const string ValuationRequestDisplayId = "ValuationRequestDisplayId";

    /// <summary>
    /// First value handed out. The seeded catalogue occupies VR-441..VR-444, and the
    /// migration pushes the sequence past whatever the retired counter already produced.
    /// </summary>
    public const int ValuationRequestDisplayIdStart = 445;

    public const string QualifiedValuationRequestDisplayId =
        DatabaseSchemas.Valuation + ".\"" + ValuationRequestDisplayId + "\"";

    /// <summary>
    /// Constant so it is not an interpolated string at the call site (EF1002). EF scalar
    /// queries read the column named <c>Value</c>.
    /// </summary>
    public const string NextValuationRequestDisplayIdSql =
        "SELECT nextval('" + QualifiedValuationRequestDisplayId + "') AS \"Value\"";
}
