using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Infrastructure.Services;

public static class PartyFeePricingRules
{
    public static decimal? ResolveFromDto(
        PartyFeePricingDto pricing,
        WorkflowTaskKind taskKind,
        string partyType,
        decimal? areaM2 = null)
    {
        if (taskKind == WorkflowTaskKind.EngineeringSurvey)
        {
            if (areaM2 is not > 0m) return null;
            var tiers = (pricing.AreaTiers ?? [])
                .OrderBy(t => t.SortOrder)
                .Select(t => new EngineeringSurveyFeeRules.AreaFeeTier(t.MaxAreaM2, t.FeeSar))
                .ToList();
            return EngineeringSurveyFeeRules.ResolveFeeFromTiers(areaM2.Value, tiers);
        }

 // Employee incentives only come from flat tables. A party-rates default must not silently
 // price them, and a flat table must not price cooperators out of cooperator columns.
        if (pricing.PricingKind == PartyFeePricingKinds.Flat)
        {
            return InspectorFeeRules.IsEmployee(partyType)
                ? Configured(pricing.FlatAmountSar)
                : null;
        }

        if (InspectorFeeRules.IsEmployee(partyType))
            return null;

        if (taskKind == WorkflowTaskKind.GovernmentReview)
            return Configured(pricing.CourtVisitFeeSar);

        return partyType switch
        {
            InspectorFeeRules.TypeCooperatorOrganization =>
                Configured(pricing.FieldInspectorOrganizationFeeSar),
            InspectorFeeRules.TypeCooperatorIndividual
                or InspectorFeeRules.TypeCooperatorLegacy =>
                Configured(pricing.FieldInspectorIndividualFeeSar),
            _ => null,
        };
    }

 /// <summary>
 /// An amount of zero means nobody set a rate, which is a different answer from "the rate is
 /// zero" — callers must treat it as unresolved and refuse to bill.
 /// </summary>
    internal static decimal? Configured(decimal amount) => amount > 0m ? amount : null;

    internal static string? CategoryForTaskKind(WorkflowTaskKind taskKind) => taskKind switch
    {
        WorkflowTaskKind.EngineeringSurvey => PartyFeePricingCategories.EngineeringSurvey,
        WorkflowTaskKind.GovernmentReview => PartyFeePricingCategories.CourtVisit,
        WorkflowTaskKind.FieldInspection => PartyFeePricingCategories.FieldInspector,
        _ => null,
    };

    internal static IReadOnlyList<EngineeringSurveyFeeRules.AreaFeeTier> NormalizeRequestedTiers(
        PartyFeePricingDto request)
    {
        var incoming = (request.AreaTiers ?? [])
            .OrderBy(t => t.SortOrder)
            .Select(t => new EngineeringSurveyFeeRules.AreaFeeTier(t.MaxAreaM2, t.FeeSar))
            .ToList();
        if (!EngineeringSurveyFeeRules.HasTiers(incoming))
        {
            throw new InvalidOperationException(
                "جدول الرفع المساحي يجب أن يحتوي شريحة واحدة على الأقل.");
        }

        return EngineeringSurveyFeeRules.NormalizeTiers(incoming);
    }

    internal static void ApplyTiersInMemory(
        PartyFeePricingTable table,
        IReadOnlyList<EngineeringSurveyFeeRules.AreaFeeTier> tiers)
    {
        var normalized = EngineeringSurveyFeeRules.NormalizeTiers(tiers);
        for (var i = 0; i < normalized.Count; i++)
        {
            table.AreaTiers.Add(new PartyFeePricingTier
            {
                Id = Guid.NewGuid(),
                TableId = table.Id,
                SortOrder = i,
                MaxAreaM2 = normalized[i].MaxAreaM2,
                FeeSar = normalized[i].FeeSar,
            });
        }
    }

    internal static void ValidateKindManagerPair(string pricingKind, string managedBy, string category)
    {
        if (pricingKind == PartyFeePricingKinds.Tiered
            && category != PartyFeePricingCategories.EngineeringSurvey)
        {
            throw new InvalidOperationException(
                "التسعير بالشرائح متاح لتصنيف الرفع المساحي فقط.");
        }

        if (pricingKind == PartyFeePricingKinds.Flat
            && category == PartyFeePricingCategories.EngineeringSurvey)
        {
            throw new InvalidOperationException(
                "حوافز المقطوع لا تُنشأ تحت تصنيف الرفع المساحي.");
        }

        if (managedBy == PartyFeePricingManagers.Supervisor
            && pricingKind != PartyFeePricingKinds.Flat)
        {
            throw new InvalidOperationException(
                "إدارة المشرف متاحة لجداول الحوافز المقطوعة فقط.");
        }
    }

    internal static string NormalizeActor(string? actorId) =>
        string.IsNullOrWhiteSpace(actorId) ? "system" : actorId.Trim();

    internal static string NormalizeName(string? name, string category)
    {
        var trimmed = (name ?? "").Trim();
        if (!string.IsNullOrEmpty(trimmed))
            return trimmed[..Math.Min(trimmed.Length, 128)];

        return "افتراضي";
    }
}
