using RealEstateEval.Application.Abstractions;
using RealEstateEval.Operations.Application.Abstractions;

namespace RealEstateEval.Financial.Infrastructure.Services;

/// <summary>
/// Court-visit fee backfill for hosts that reach Operations over HTTP: the Financial host has
/// no Operations DbContext, so it satisfies <see cref="ICourtVisitFeeBackfill"/> through the
/// operations-task client instead of the local visit-fee helper.
/// </summary>
public sealed class RemoteCourtVisitFeeBackfill : ICourtVisitFeeBackfill
{
    private readonly IOperationsTaskService _tasks;

    public RemoteCourtVisitFeeBackfill(IOperationsTaskService tasks) => _tasks = tasks;

    public Task<int> BackfillMissingChargesForCompletedVisitsAsync(
        CancellationToken cancellationToken = default) =>
        _tasks.BackfillMissingCourtVisitChargesAsync(cancellationToken);
}
