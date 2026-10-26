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

    /// <summary>
    /// Round 2: what the «مبررات التسويات والأوزان اليدوية» gate names — for each ADOPTED comparable,
    /// every included factor with a non-zero percent whose rationale (the comparable's own override,
    /// else the factor-level one — Q-8-1) is under 10 characters, and a manual weight whose rationale
    /// is. «CMP-1: الموقع (+10٪)», «CMP-2: الوزن اليدوي (60٪)».
    /// </summary>
    public static IReadOnlyList<string> UnexplainedAdjustments(ValuationComparableSelectionListDto? list)
    {
        if (list is null) return [];
        var factorRationales = list.FactorRationales
            .GroupBy(r => r.FactorKey.Trim(), StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.Last().RationaleAr, StringComparer.Ordinal);
        var unexplained = new List<string>();
        var index = 0;
        foreach (var item in list.Items)
        {
            index++;
            if (!item.IsAdopted || item.Market is null) continue;
            var reference = string.IsNullOrWhiteSpace(item.Comparable?.ReferenceCode)
                ? $"المقارن {index}"
                : item.Comparable.ReferenceCode.Trim();
            foreach (var line in item.Market.AdjustmentLines.Where(l => l.IsIncluded && l.Percent != 0m))
            {
                var own = line.Rationale;
                var effective = JustificationRules.IsBlank(own)
                    ? factorRationales.GetValueOrDefault(line.FactorKey.Trim())
                    : own;
                if (!JustificationRules.MeetsRequiredMinimum(effective))
                    unexplained.Add($"{reference}: {line.LabelAr} ({SignedPct(line.Percent)}٪)");
            }
            if (item.Market.WeightIsManual
                && !JustificationRules.MeetsRequiredMinimum(item.Market.WeightOverrideRationale))
            {
                unexplained.Add($"{reference}: الوزن اليدوي ({Pct(item.Market.EffectiveWeightPct)}٪)");
            }
        }
        return unexplained;
    }

    private static string SignedPct(decimal value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero)
            .ToString("+0.##;-0.##;0", System.Globalization.CultureInfo.InvariantCulture);

    private static string Pct(decimal value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero)
            .ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);

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
