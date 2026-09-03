using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Rules;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

public sealed class SuspendedTransactionsService : ISuspendedTransactionsService
{
    private readonly IFailureLookup _failureLookup;
    private readonly IUserLabelLookup _labels;

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
            SuspendedAt = IsoTimestamps.ParseUtc(x.SuspendedAt) ?? IsoTimestamps.ParseUtc(x.UpdatedAt) ?? DateTime.UnixEpoch,
            SuspendedBy = PersonLabelResolver.ApplyResolved(x.SuspendedByUserId, names),
        }).ToList();
    }
}
