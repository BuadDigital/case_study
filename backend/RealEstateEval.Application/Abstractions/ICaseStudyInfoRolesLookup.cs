namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Case Study's read of the configured «مصفوفة أدوار المعلومات» (which party answers which
/// case-study question). The matrix is owned by the Platform context; this port exposes only
/// what the 100% completeness rule needs — question key → ids of the parties holding a real role
/// (anything but «none») — so the use case never compiles against Platform contracts.
/// </summary>
public interface ICaseStudyInfoRolesLookup
{
    /// <summary>
    /// The live matrix, keyed by question key (<c>deed_0</c>, <c>survey_3</c>, …). A question with
    /// no party in its row is present with an empty collection. Returns null when the matrix cannot
    /// be read (upstream down) — the caller must then fail closed, never treat it as «no questions».
    /// </summary>
    Task<IReadOnlyDictionary<string, IReadOnlyCollection<string>>?> GetQuestionRolesAsync(
        CancellationToken cancellationToken = default);
}
