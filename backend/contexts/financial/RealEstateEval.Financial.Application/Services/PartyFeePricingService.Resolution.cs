using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Rules;

namespace RealEstateEval.Financial.Application.Services;

/// <summary>
/// Default-fee resolution: which table prices a party for a task kind, and the fee it yields.
/// </summary>
public sealed partial class PartyFeePricingService
{
    public async Task<ResolvedPartyFee> ResolveDefaultFeeAsync(
        WorkflowTaskKind taskKind,
        string partyType,
        decimal? areaM2 = null,
        string? assigneeId = null,
        CancellationToken cancellationToken = default)
    {
        var category = PartyFeePricingRules.CategoryForTaskKind(taskKind);
        if (category is null) return ResolvedPartyFee.Unresolved;

 // Employee incentives may only come from flat tables. An accidental party-rates assignment
 // (or the cooperator category default) must not silently leave the employee unpriced —
 // and must not price them from cooperator columns.
        var pricing = PartyFeePricingRules.UsesEmployeeIncentiveTable(partyType, taskKind)
            ? await ResolveEmployeeIncentiveTableAsync(category, assigneeId, cancellationToken)
            : await ResolveTableDtoForAssigneeAsync(category, assigneeId, cancellationToken);

        if (pricing is null) return ResolvedPartyFee.Unresolved;

        return PartyFeePricingRules.ResolvedOrUnresolved(
            PartyFeePricingRules.ResolveFromDto(pricing, taskKind, partyType, areaM2),
            pricing.Id);
    }

 /// <summary>
 /// Flat table assigned to the employee, else any flat incentive table for the category.
 /// Never returns the cooperator party-rates default.
 /// </summary>
    private async Task<PartyFeePricingDto?> ResolveEmployeeIncentiveTableAsync(
        string category,
        string? assigneeId,
        CancellationToken cancellationToken)
    {
        await EnsureAllCategoriesSeededAsync(cancellationToken);
        var trimmed = assigneeId?.Trim();

        if (!string.IsNullOrEmpty(trimmed))
        {
            var assignedTableId = await _db.FindAssignedTableIdAsync(
                category, trimmed, cancellationToken);

            if (assignedTableId is Guid tableId)
            {
                var assigned = await LoadTableAsync(tableId, tracking: false, cancellationToken);
                if (PartyFeePricingRules.IsUsableEmployeeIncentiveTable(assigned))
                    return await ToDtoAsync(assigned!, cancellationToken);
            }
        }

        var flat = await _db.FindFlatTableWithAmountAsync(category, cancellationToken);

        return flat is null ? null : await ToDtoAsync(flat, cancellationToken);
    }

    private async Task<PartyFeePricingDto?> ResolveTableDtoForAssigneeAsync(
        string category,
        string? assigneeId,
        CancellationToken cancellationToken)
    {
        await EnsureAllCategoriesSeededAsync(cancellationToken);
        var trimmed = assigneeId?.Trim();

        if (!string.IsNullOrEmpty(trimmed))
        {
            var assignedTableId = await _db.FindAssignedTableIdAsync(
                category, trimmed, cancellationToken);

            if (assignedTableId is Guid tableId)
            {
                var assigned = await LoadTableAsync(tableId, tracking: false, cancellationToken);
                if (assigned is not null)
                    return await ToDtoAsync(assigned, cancellationToken);
            }

            if (!PartyFeePricingRules.AllowsCategoryDefaultFallback(category))
                return null;
        }

        var fallback = await _db.FindActiveTableAsync(category, cancellationToken);
        return fallback is null ? null : await ToDtoAsync(fallback, cancellationToken);
    }
}
