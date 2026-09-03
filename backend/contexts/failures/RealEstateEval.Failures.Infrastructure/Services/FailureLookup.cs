using RealEstateEval.Application.Rules;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Domain;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Failures.Infrastructure.Services;

public sealed class FailureLookup(FailuresDbContext db) : IFailureLookup
{
    private const int MaxSuspendedRows = 500;

    public Task<bool> HasActiveAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        var property = propertyId.Trim();
        return db.PropertyFailures.AsNoTracking().AnyAsync(
            f => f.PoNumber == po
                && f.PropertyId == property
                && PropertyFailureStatus.Active.Contains(f.Status),
            cancellationToken);
    }

    public Task<bool> HasBlockingAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        var property = propertyId.Trim();
        return db.PropertyFailures.AsNoTracking().AnyAsync(
            f => f.PoNumber == po
                && f.PropertyId == property
                && f.Status != PropertyFailureStatus.Resolved
                && f.Status != PropertyFailureStatus.Suspended,
            cancellationToken);
    }

    public async Task<IReadOnlyList<string>> ListApprovedPropertyKeysAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await db.PropertyFailures.AsNoTracking()
            .Where(f => f.Status == PropertyFailureStatus.Approved)
            .Select(f => new { f.PoNumber, f.PropertyId })
            .ToListAsync(cancellationToken);

        return rows
            .Select(f => $"{f.PoNumber.Trim()}|{f.PropertyId.Trim()}")
            .Distinct(StringComparer.Ordinal)
            .ToList();
    }

    public async Task<IReadOnlyList<FailureRecordDto>> ListForPropertyAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        var property = propertyId.Trim();
        var rows = await db.PropertyFailures.AsNoTracking()
            .Where(f => f.PoNumber == po && f.PropertyId == property)
            .OrderBy(f => f.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        return rows.Select(ToDto).ToList();
    }

    public async Task<IReadOnlyList<FailureRecordDto>> ListSuspendedAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await db.PropertyFailures.AsNoTracking()
            .Where(x => x.Status == PropertyFailureStatus.Suspended)
            .OrderByDescending(x => x.SuspendedAtUtc ?? x.UpdatedAtUtc)
            .Take(MaxSuspendedRows)
            .ToListAsync(cancellationToken);
        return rows.Select(ToDto).ToList();
    }

    public async Task<IReadOnlyList<Guid>> ListActiveIdsByProblemAsync(
        string poNumber,
        string propertyId,
        string problemTypeId,
        string raisedByRole,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        var property = propertyId.Trim();
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

    internal static FailureRecordDto ToDto(PropertyFailure entity) => new()
    {
        Id = entity.Id.ToString(),
        PoNumber = entity.PoNumber,
        PropertyId = entity.PropertyId,
        DeedNumber = entity.DeedNumber,
        Title = entity.Title,
        ProblemTypeId = entity.ProblemTypeId,
        Severity = entity.Severity,
        RaisedByRole = PersonLabelResolver.NormalizeSystemLabel(entity.RaisedByRole),
        InternalNote = entity.InternalNote,
        FinalNote = entity.FinalNote,
        ResolutionReason = entity.ResolutionReason,
        ContinueInstructions = entity.ContinueInstructions,
        Status = entity.Status,
        Specialist = PersonLabelResolver.NormalizeSystemLabel(entity.Specialist),
        CreatedAt = entity.CreatedAtUtc.ToString("O"),
        UpdatedAt = entity.UpdatedAtUtc.ToString("O"),
        SuspendedAt = entity.SuspendedAtUtc?.ToString("O"),
        SuspendedByUserId = entity.SuspendedByUserId,
    };
}
