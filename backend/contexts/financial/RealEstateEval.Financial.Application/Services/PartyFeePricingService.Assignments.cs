using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Services;

/// <summary>
/// Assignee links: which parties a table prices. Replacing a table's assignees takes those
/// parties off every other table of the category in the same unit of work.
/// </summary>
public sealed partial class PartyFeePricingService
{
    public async Task<IReadOnlyList<string>> ListAssignmentsAsync(
        Guid tableId,
        CancellationToken cancellationToken = default)
    {
        return await _db.ListAssigneeIdsForTableAsync(tableId, cancellationToken);
    }

    public async Task<PartyFeePricingDto> SetAssignmentsAsync(
        Guid tableId,
        IReadOnlyList<string> assigneeIds,
        CancellationToken cancellationToken = default,
        string actorId = "system")
    {
        await EnsureAllCategoriesSeededAsync(cancellationToken);
        var table = await LoadTableAsync(tableId, tracking: true, cancellationToken)
            ?? throw new KeyNotFoundException($"Pricing table {tableId} was not found.");

        var normalized = PartyFeePricingRules.NormalizeAssigneeIds(assigneeIds);
        var categoryBefore = await _db.ListAssignmentSnapshotsByCategoryAsync(
            table.Category, cancellationToken);

        var now = _time.UtcNow();

        var conflicting = await _db.ListConflictingAssignmentsAsync(
            table.Category, tableId, normalized, cancellationToken);
        if (conflicting.Count > 0)
            _db.RemoveAssignments(conflicting);

        var existing = await _db.ListAssignmentsForTableAsync(tableId, cancellationToken);
        _db.RemoveAssignments(existing);

        foreach (var assigneeId in normalized)
        {
            _db.AddAssignment(PartyFeePricingLifecycleRules.NewAssignment(
                tableId,
                table.Category,
                assigneeId,
                now));
        }

        table.UpdatedAtUtc = now;
        var categoryAfter = PartyFeePricingRules.AssignmentsAfterReplace(
            categoryBefore,
            tableId,
            normalized);
        AddAudit(
            actorId,
            "PRICING_ASSIGNMENTS_REPLACED",
            nameof(PartyFeePricingAssignment),
            table.Id,
            categoryBefore,
            categoryAfter);
        await _db.SaveChangesAsync(cancellationToken);

        var reloaded = await LoadTableAsync(tableId, tracking: false, cancellationToken)
            ?? throw new KeyNotFoundException($"Pricing table {tableId} was not found after assign.");
        return await ToDtoAsync(reloaded, cancellationToken);
    }
}
