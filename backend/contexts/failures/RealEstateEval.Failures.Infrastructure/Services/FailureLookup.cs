using System.Linq.Expressions;
using RealEstateEval.Application.Rules;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Application.Rules;
using RealEstateEval.Failures.Domain;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Failures.Infrastructure.Services;

public sealed class FailureLookup(FailuresDbContext db) : IFailureLookup
{
    private const int MaxSuspendedRows = 500;

    public Task<bool> HasActiveAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken = default) =>
        AnyOnPropertyAsync(
            poNumber,
            propertyId,
            f => PropertyFailureStatus.Active.Contains(f.Status),
            cancellationToken);

    public Task<bool> HasSurveyFreezingAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken = default) =>
        AnyOnPropertyAsync(
            poNumber,
            propertyId,
            f => PropertyFailureStatus.Active.Contains(f.Status)
                && f.SurveyFreezeLiftedAtUtc == null,
            cancellationToken);

    public Task<bool> HasBlockingAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken = default) =>
        AnyOnPropertyAsync(
            poNumber,
            propertyId,
            f => f.Status != PropertyFailureStatus.Resolved
                && f.Status != PropertyFailureStatus.Suspended,
            cancellationToken);

    public Task<IReadOnlyList<string>> ListApprovedPropertyKeysAsync(
        CancellationToken cancellationToken = default) =>
        ListPropertyKeysAsync(f => f.Status == PropertyFailureStatus.Approved, cancellationToken);

    public Task<IReadOnlyList<string>> ListBlockingPropertyKeysAsync(
        CancellationToken cancellationToken = default) =>
        ListPropertyKeysAsync(
            f => f.Status != PropertyFailureStatus.Resolved
                && f.Status != PropertyFailureStatus.Suspended,
            cancellationToken);

    public async Task<IReadOnlyList<FailureRecordDto>> ListForPropertyAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (!FailureRules.TryParsePropertyId(propertyId, out var property)) return [];
        var rows = await db.PropertyFailures.AsNoTracking()
            .Where(f => f.PoNumber == po && f.PropertyId == property)
            .OrderBy(f => f.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        return rows.Select(f => FailureRecordRules.ToDto(f)).ToList();
    }

    public async Task<IReadOnlyList<FailureRecordDto>> ListSuspendedAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await db.PropertyFailures.AsNoTracking()
            .Where(x => x.Status == PropertyFailureStatus.Suspended)
            .OrderByDescending(x => x.SuspendedAtUtc ?? x.UpdatedAtUtc)
            .Take(MaxSuspendedRows)
            .ToListAsync(cancellationToken);
        return rows.Select(f => FailureRecordRules.ToDto(f)).ToList();
    }

    public async Task<IReadOnlyList<Guid>> ListActiveIdsByProblemAsync(
        string poNumber,
        string propertyId,
        string problemTypeId,
        string raisedByRole,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (!FailureRules.TryParsePropertyId(propertyId, out var property)) return [];
        var problem = problemTypeId.Trim();
        var role = raisedByRole.Trim();
        return await db.PropertyFailures.AsNoTracking()
            .Where(f =>
                f.PoNumber == po
                && f.PropertyId == property
                && f.ProblemTypeId == problem
                && f.RaisedByRole == role
                && PropertyFailureStatus.Active.Contains(f.Status))
            .Select(f => f.Id)
            .ToListAsync(cancellationToken);
    }

    /// <summary>Whether a failure on the PO's property matches; false for an unparsable property id.</summary>
    private Task<bool> AnyOnPropertyAsync(
        string poNumber,
        string propertyId,
        Expression<Func<PropertyFailure, bool>> predicate,
        CancellationToken cancellationToken)
    {
        var po = poNumber.Trim();
        if (!FailureRules.TryParsePropertyId(propertyId, out var property)) return Task.FromResult(false);
        return db.PropertyFailures.AsNoTracking()
            .Where(f => f.PoNumber == po && f.PropertyId == property)
            .AnyAsync(predicate, cancellationToken);
    }

    /// <summary>Distinct <c>PO|propertyId</c> keys of the properties with a matching failure.</summary>
    private async Task<IReadOnlyList<string>> ListPropertyKeysAsync(
        Expression<Func<PropertyFailure, bool>> predicate,
        CancellationToken cancellationToken)
    {
        var rows = await db.PropertyFailures.AsNoTracking()
            .Where(predicate)
            .Select(f => new { f.PoNumber, f.PropertyId })
            .ToListAsync(cancellationToken);

        return rows
            .Select(f => $"{f.PoNumber.Trim()}|{f.PropertyId:D}")
            .Distinct(StringComparer.Ordinal)
            .ToList();
    }
}
