using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Financial.Infrastructure.Services;

public sealed class InspectorFeeLedgerResolver : IInspectorFeeLedgerResolver
{
    private readonly ICaseStudyLookup _lookup;
    private readonly IIdentityDirectory _identity;

    [ActivatorUtilitiesConstructor]
    public InspectorFeeLedgerResolver(ICaseStudyLookup lookup, IIdentityDirectory identity)
    {
        _lookup = lookup;
        _identity = identity;
    }

 /// <summary>
 /// Property-linked task → one deed. PO-level task → one deed per work-order property.
 /// Orphan task with no properties → legacy stand-in (task id).
 /// </summary>
    public async Task<IReadOnlyList<InspectorFeeDeedTarget>> ResolveDeedTargetsAsync(
        WorkflowTask task,
        CancellationToken cancellationToken = default)
    {
        if (task.PropertyId is Guid linked)
            return [new InspectorFeeDeedTarget(linked, linked)];

        var po = task.PoNumber.Trim();
        if (string.IsNullOrEmpty(po))
            return [new InspectorFeeDeedTarget(task.Id, null)];

        var workOrderId = await _lookup.GetWorkOrderIdByPoNumberAsync(po, cancellationToken);
        if (workOrderId is null)
            return [new InspectorFeeDeedTarget(task.Id, null)];

        var properties = await _lookup.ListPropertiesByPoNumbersAsync([po], cancellationToken);
        var propertyIds = properties
            .Where(p => p.WorkOrderId == workOrderId.Value)
            .OrderBy(p => p.Id)
            .Select(p => p.Id)
            .ToList();
        if (propertyIds.Count == 0)
            return [new InspectorFeeDeedTarget(task.Id, null)];

        return propertyIds.Select(id => new InspectorFeeDeedTarget(id, id)).ToList();
    }

    public async Task<(Guid TransactionId, Guid DeedId, string UserId)> ResolveLedgerIdentityAsync(
        WorkflowTask task,
        CancellationToken cancellationToken = default,
        Guid? deedIdOverride = null)
    {
        var po = task.PoNumber.Trim();
        var workOrderId = string.IsNullOrEmpty(po)
            ? null
            : await _lookup.GetWorkOrderIdByPoNumberAsync(po, cancellationToken);

 // Orphan PO strings still need a stable transaction key for the unique index.
        var transactionId = workOrderId ?? StableGuidFromKey($"tx:{po}");
        var deedId = deedIdOverride ?? task.PropertyId ?? task.Id;
        var userId = task.AssigneeId?.Trim() ?? "";
        return (transactionId, deedId, userId);
    }

    public async Task<decimal?> ResolvePropertyAreaM2Async(
        WorkflowTask task,
        CancellationToken cancellationToken = default,
        Guid? propertyIdOverride = null)
    {
        var propertyId = propertyIdOverride ?? task.PropertyId;
        if (propertyId is Guid linkedId)
        {
            var linked = (await _lookup.ListPropertiesByIdsAsync([linkedId], cancellationToken))
                .FirstOrDefault();
            if (EngineeringSurveyFeeRules.TryParseAreaM2(linked?.Area, out var linkedArea))
                return linkedArea;
            return null;
        }

 // Legacy fallback for unsplit rows only — prefer per-deed ResolveDeedTargetsAsync.
        var po = task.PoNumber.Trim();
        if (string.IsNullOrEmpty(po)) return null;

        var properties = await _lookup.ListPropertiesByPoNumbersAsync([po], cancellationToken);
        if (properties.Count == 0) return null;

        var parsed = properties
            .Select(p => EngineeringSurveyFeeRules.TryParseAreaM2(p.Area, out var m2) ? m2 : (decimal?)null)
            .Where(m => m is > 0m)
            .Select(m => m!.Value)
            .ToList();
        if (parsed.Count == 0) return null;
        if (parsed.Count == 1) return parsed[0];
        return parsed.Max();
    }

    public async Task<string> ResolvePartyTypeAsync(
        WorkflowTask task,
        CancellationToken cancellationToken = default)
    {
 // Product rules: engineering office is always an external entity;
 // government reviewers follow employee vs cooperator from the staff profile.
        if (task.Kind == WorkflowTaskKind.EngineeringSurvey)
            return EngineeringSurveyFeeRules.OfficePartyType;

        if (string.IsNullOrWhiteSpace(task.AssigneeId))
            return InspectorFeeRules.TypeEmployee;

        var aid = task.AssigneeId.Trim();
        var profile = await _identity.GetCompensationByAssigneeAsync(aid, cancellationToken);

        if (task.Kind == WorkflowTaskKind.GovernmentReview)
        {
            return CourtVisitFeeRules.ResolveReviewerType(
                profile?.ContractType,
                profile?.ProviderKind,
                profile?.EmploymentType,
                aid);
        }

        if (profile is not null)
        {
            if (profile.ContractType == ContractType.ServiceProvider
                || profile.ProviderKind == ProcProviderKind.Organization)
            {
                return InspectorFeeRules.TypeCooperatorOrganization;
            }

            if (profile.ContractType == ContractType.Freelance
                || profile.ProviderKind == ProcProviderKind.Individual
                || profile.EmploymentType?.Contains("متعاون", StringComparison.Ordinal) == true)
            {
                return InspectorFeeRules.TypeCooperatorIndividual;
            }

            return InspectorFeeRules.TypeEmployee;
        }

        return InspectorFeeRules.ResolveInspectorType(aid);
    }

    public async Task<bool> AssigneeHasCompensationAsync(
        string? assigneeId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(assigneeId)) return false;
        var aid = assigneeId.Trim();
        var profile = await _identity.GetCompensationByAssigneeAsync(aid, cancellationToken);
        return profile?.HasCompensation == true;
    }

    public static Guid StableGuidFromKey(string key)
    {
        var hash = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(key));
        Span<byte> bytes = stackalloc byte[16];
        hash.AsSpan(0, 16).CopyTo(bytes);
        return new Guid(bytes);
    }
}
