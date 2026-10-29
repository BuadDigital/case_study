// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Split  New file — the non-methodology gate reads (value documents check, required attachments) moved
//           here unchanged from ValuationIssuanceGateService.cs.
// Round 2 (1b19bedc)
//  • Required attachments are also looked up under the engineering-survey task ids
//          (ValuationIssuanceGateRules.AttachmentScopeKeys) — a vacant-land survey stored under the task no
//          longer blocks approval.
// ──────────────────────────────────────────────────────────────────────────────────────────────

using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Attachments.Domain;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// The issuance-gate reads that are not methodology: value documents and the required attachments.
/// </summary>
public sealed partial class ValuationIssuanceGateService
{
    /// <summary>
    /// Every «مستند ذو قيمة» with an effect must be approved by the case specialist; an indicator
    /// must not duplicate an approach the system now values internally.
    /// </summary>
    private async Task<ValuationIssuanceGateCheck> ValueDocumentsCheckAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken)
    {
        var docs = await valueDocuments.GetAsync(valuationRequestId, cancellationToken);
        var used = (docs?.Documents ?? []).Where(d => d.Effect is not null).ToList();
        var notApproved = used
            .Where(d => d.Missing || !string.Equals(d.Status, ValueDocumentStatuses.Approved, StringComparison.Ordinal))
            .Select(d => d.LabelAr)
            .ToList();
        var conflicting = used
            .Where(d => d.Effect == ValueDocumentEffects.Indicator
                && (docs?.InternalApproachKinds ?? []).Contains(d.ApproachKey ?? "", StringComparer.OrdinalIgnoreCase))
            .Select(d => d.LabelAr)
            .ToList();
        return ValuationIssuanceGateRules.ValueDocuments(notApproved, conflicting);
    }

 /// <summary>
 /// For every active dictionary type marked required (and matching the property
 /// type, when linked), at least one classified upload of that type — or of a type
 /// that counts as it, e.g. the bourse deed image for the deed — must exist.
 /// Unlisted documents never satisfy a requirement.
 /// </summary>
    private async Task<IReadOnlyList<string>> FindMissingRequiredAttachmentLabelsAsync(
        string propertyId,
        string? poNumber,
        IReadOnlyList<Guid> surveyTaskIds,
        string propertyType,
        bool propertyRequiresSurvey,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(propertyId)) return [];

        var dictionary = await printDictionary.GetAsync(cancellationToken);
        var required = ValuationIssuanceGateRules.RequiredAttachmentsForProperty(
            dictionary.Types
                .Where(t => t.IsActive && t.IsRequired)
                .Where(t => AppliesToPropertyType(t.PropertyTypeKeys, propertyType)),
            t => t.Key,
            propertyRequiresSurvey);
        if (required.Count == 0) return [];

        var needles = ValuationIssuanceGateRules.AttachmentScopeKeys(propertyId, poNumber, surveyTaskIds);

        var presentKeys = new HashSet<string>(StringComparer.Ordinal);
        var seen = new HashSet<Guid>();
        foreach (var needle in needles)
        {
            foreach (var a in await attachments.ListForPropertyAsync(needle, actor: null, cancellationToken))
            {
                if (!seen.Add(a.Id)) continue;
                var type = PropertyDocumentTypes.Resolve(a.DocumentTypeKey, a.Scope, a.ScopeKey);
                if (type is null || type.Key == PropertyDocumentTypes.UnlistedKey) continue;
                presentKeys.Add(type.Key);
                presentKeys.Add(type.RequirementKey);
            }
        }

        return required
            .Where(t => !presentKeys.Contains(t.Key.Trim().ToLowerInvariant()))
            .Select(t => t.LabelAr)
            .ToList();
    }

    private static bool AppliesToPropertyType(IReadOnlyList<string> propertyTypeKeys, string propertyType)
    {
        return PropertyDocumentTypes.AppliesToType(
            PropertyDocumentTypes.NormalizePropertyTypeKeys(propertyTypeKeys),
            propertyType);
    }
}
