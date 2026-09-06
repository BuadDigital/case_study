namespace RealEstateEval.Infrastructure.Data;

/// <summary>
/// Shared column widths so the same kind of value is declared the same way in every context.
/// </summary>
public static class ColumnLengths
{
    /// <summary>
    /// User, actor and assignee identifiers: ASP.NET Identity user ids (36-character Guid
    /// strings), distribution slugs, and "system:…" labels. One width everywhere instead of the
    /// 64 / 128 / 450 mix that grew up around the Identity default.
    /// </summary>
    public const int UserId = 128;
}
