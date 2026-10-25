using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// Inputs the issuance-gate service hands to the methodology alerts and the credential gate:
/// one adopted comparable as alert input (D4/D6/D8/D10) and the people on this report (D13).
/// </summary>
public static class ValuationIssuanceGateInputRules
{
    /// <summary>Alert input for one adopted market comparable (D4 gross, D6 rate, D8 date, D10 type).</summary>
    public static ValuationMethodologyAlertComparableInput ToAlertComparable(
        ValuationComparableSelectionDto item,
        string? adjustmentBasis)
    {
        var basis = MarketAdjustmentBasisKeys.Normalize(adjustmentBasis);
        DateOnly? dealDate = DateOnly.TryParseExact(
            item.Comparable.TransactionDate,
            "yyyy-MM-dd",
            System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.None,
            out var parsed)
            ? parsed
            : null;
        return new ValuationMethodologyAlertComparableInput(
            item.Comparable.ComparablePropertyType,
            item.Market?.ExceedsLargeAdjustmentThreshold ?? false,
            item.Market?.SumIncludedPct ?? 0m,
            AdjustedUnitRate: item.Market is null
                ? null
                : ValuationComparableListBuilder.AdjustedUnitRate(
                    item.Market,
                    basis,
                    item.EffectiveAreaSqm > 0m ? item.EffectiveAreaSqm : item.Comparable.AreaSqm),
            TransactionDate: dealDate,
            Usage: item.Comparable.Usage,
            ReferenceCode: item.Comparable.ReferenceCode,
            GrossAdjustmentPct: item.Market?.GrossAdjustmentPct() ?? 0m);
    }

    private static readonly HashSet<string> StandingReportRoles =
        new(StringComparer.OrdinalIgnoreCase) { "reviewer", "assistant" };

    /// <summary>
    /// D13: the people whose credentials this report depends on — the report's standing
    /// reviewers / assistants, the signing certified valuer's roster row, and the appraiser
    /// assigned to this property (by staff account, else by name). Other working valuers on the
    /// roster are not on this report and never block it.
    /// </summary>
    public static IReadOnlyList<OrganizationValuerRosterEntryDto> ReportParticipants(
        IEnumerable<OrganizationValuerRosterEntryDto> roster,
        string? signingValuerName,
        string? assignedAppraiserId,
        string? assignedAppraiserName)
    {
        var assigneeId = (assignedAppraiserId ?? "").Trim();
        return roster
            .Where(v => v.IsActive)
            .Where(v =>
                StandingReportRoles.Contains((v.Role ?? "").Trim())
                || (string.Equals((v.Role ?? "").Trim(), "certified", StringComparison.OrdinalIgnoreCase)
                    && SamePerson(v.NameAr, signingValuerName))
                || (assigneeId.Length > 0
                    && string.Equals((v.StaffUserId ?? "").Trim(), assigneeId, StringComparison.OrdinalIgnoreCase))
                || SamePerson(v.NameAr, assignedAppraiserName))
            .ToList();
    }

    private static bool SamePerson(string? a, string? b)
    {
        static string Norm(string? s) => string.Join(
            " ",
            (s ?? "")
                .Replace('أ', 'ا').Replace('إ', 'ا').Replace('آ', 'ا').Replace('ة', 'ه').Replace('ى', 'ي')
                .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        var left = Norm(a);
        var right = Norm(b);
        return left.Length > 0 && right.Length > 0 && left == right;
    }

}
