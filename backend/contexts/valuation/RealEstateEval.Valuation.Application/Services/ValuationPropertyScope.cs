using RealEstateEval.Application.Abstractions;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Services;

/// <summary>What the approach rules need from the work-order property behind a valuation request.</summary>
internal static class ValuationPropertyScope
{
 /// <summary>
 /// The scoping answer "are there structures to value?" and the effective property type; a request
 /// with no property, or one Case Study cannot find, keeps no structures and its own type.
 /// </summary>
    public static async Task<(bool HasStructures, string EffectivePropertyType)> ReadAsync(
        ICaseStudyLookup caseStudy,
        ValuationRequest vr,
        CancellationToken cancellationToken)
    {
        if (vr.PropertyId == Guid.Empty)
            return (false, vr.PropertyType);

        var context = await caseStudy.GetValuationPropertyContextAsync(vr.PropertyId, cancellationToken);
        return (
            context?.HasStructures() ?? false,
            context?.EffectivePropertyType() ?? vr.PropertyType);
    }
}
