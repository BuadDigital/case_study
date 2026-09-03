using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Application.Rules;

/// <summary>Resolves boundary «النوع» keys to Arabic labels from the admin catalog.</summary>
public static class ValuationBoundaryTypeLabels
{
    public static string Resolve(ValuationListsDto? catalog, string? key)
    {
        var trimmed = key?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
            return "";

        if (catalog?.Lists is not null
            && catalog.Lists.TryGetValue(ValuationListIds.BoundaryTypes, out var rows)
            && rows is not null)
        {
            var row = rows.FirstOrDefault(r =>
                string.Equals(r.Key, trimmed, StringComparison.OrdinalIgnoreCase));
            if (row is not null && !string.IsNullOrWhiteSpace(row.Name))
                return row.Name.Trim();
        }

        return PropertyBoundaryTypes.LabelAr(trimmed);
    }
}
