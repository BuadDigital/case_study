using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class SuspendedTransactionsService : ISuspendedTransactionsService
{
    private readonly IFailureLookup _failureLookup;
    private readonly IUserLabelLookup _labels;

    public SuspendedTransactionsService(FailuresDbContext failures, IdentityDbContext identity)
        : this(new FailureLookup(failures), new UserLabelLookup(identity))
    {
    }

    [ActivatorUtilitiesConstructor]
    public SuspendedTransactionsService(IFailureLookup failureLookup, IUserLabelLookup labels)
    {
        _failureLookup = failureLookup;
        _labels = labels;
    }

    public async Task<IReadOnlyList<SuspendedTransactionDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await _failureLookup.ListSuspendedAsync(cancellationToken);

        var names = await _labels.ResolveManyAsync(
            rows.Select(x => x.Specialist).Concat(rows.Select(x => x.SuspendedByUserId)),
            cancellationToken);

        return rows.Select(x => new SuspendedTransactionDto
        {
            Id = Guid.TryParse(x.Id, out var id) ? id : Guid.Empty,
            PoNumber = x.PoNumber,
            PropertyId = x.PropertyId,
            FailureId = x.Id,
            DeedNumber = x.DeedNumber,
            Title = x.Title,
            InternalNote = x.InternalNote,
            RaisedByRole = PersonLabelResolver.NormalizeSystemLabel(x.RaisedByRole),
            Specialist = PersonLabelResolver.ApplyResolved(x.Specialist, names),
            SupervisorNote = x.FinalNote,
            SuspendedAt = ParseUtc(x.SuspendedAt) ?? ParseUtc(x.UpdatedAt) ?? DateTime.UnixEpoch,
            SuspendedBy = PersonLabelResolver.ApplyResolved(x.SuspendedByUserId, names),
        }).ToList();
    }

    private static DateTime? ParseUtc(string? value)
    {
        if (!DateTime.TryParse(
                value,
                null,
                System.Globalization.DateTimeStyles.RoundtripKind,
                out var parsed))
        {
            return null;
        }

        return parsed.Kind == DateTimeKind.Utc ? parsed : DateTime.SpecifyKind(parsed, DateTimeKind.Unspecified);
    }
}
