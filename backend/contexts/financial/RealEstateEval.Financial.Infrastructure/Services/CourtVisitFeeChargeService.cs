using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class CourtVisitFeeChargeService : ICourtVisitFeeChargeService
{
    private readonly FinancialDbContext _financial;
    private readonly TimeProvider _time;

    public CourtVisitFeeChargeService(FinancialDbContext financial, TimeProvider? time = null)
    {
        _financial = financial;
        _time = time ?? TimeProvider.System;
    }

    public Task<bool> ExistsForTaskAsync(
        Guid operationsTaskId,
        CancellationToken cancellationToken = default) =>
        _financial.CourtVisitFeeCharges.AnyAsync(
            c => c.OperationsTaskId == operationsTaskId,
            cancellationToken);

    public async Task AddChargeAsync(
        CreateCourtVisitFeeChargeRequest request,
        CancellationToken cancellationToken = default)
    {
        var now = _time.UtcNow();
        _financial.CourtVisitFeeCharges.Add(new CourtVisitFeeCharge
        {
            Id = Guid.NewGuid(),
            OperationsTaskId = request.OperationsTaskId,
            TaskDisplayId = request.TaskDisplayId,
            PoNumber = string.IsNullOrWhiteSpace(request.PoNumber) ? null : request.PoNumber.Trim(),
            CreditAssigneeId = request.CreditAssigneeId.Trim(),
            CreditAssigneeName = request.CreditAssigneeName.Trim(),
            AmountSar = request.AmountSar,
            PricingTableId = request.PricingTableId,
            Status = CourtVisitFeeStatuses.Open,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await _financial.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CourtVisitFeeReportRowDto>> ListAsync(
        string? creditAssigneeId = null,
        CancellationToken cancellationToken = default)
    {
        var query = _financial.CourtVisitFeeCharges.AsNoTracking();
        var assignee = creditAssigneeId?.Trim();
        if (!string.IsNullOrEmpty(assignee))
            query = query.Where(c => c.CreditAssigneeId == assignee);

        return await query
            .OrderByDescending(c => c.CreatedAtUtc)
            .Select(c => new CourtVisitFeeReportRowDto
            {
                Id = c.Id,
                OperationsTaskId = c.OperationsTaskId,
                TaskDisplayId = c.TaskDisplayId,
                PoNumber = c.PoNumber,
                CreditAssigneeId = c.CreditAssigneeId,
                CreditAssigneeName = c.CreditAssigneeName,
                AmountSar = c.AmountSar,
                Status = c.Status,
                CreatedAtUtc = c.CreatedAtUtc,
            })
            .Take(500)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyDictionary<Guid, decimal?>> GetAmountsByTaskIdsAsync(
        IReadOnlyList<Guid> taskIds,
        CancellationToken cancellationToken = default)
    {
        var ids = taskIds.Distinct().ToList();
        if (ids.Count == 0)
            return new Dictionary<Guid, decimal?>();

        var rows = await _financial.CourtVisitFeeCharges.AsNoTracking()
            .Where(c => ids.Contains(c.OperationsTaskId))
            .Select(c => new { c.OperationsTaskId, c.AmountSar })
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(x => x.OperationsTaskId, x => (decimal?)x.AmountSar);
    }

    public async Task<IReadOnlyList<Guid>> ListChargedTaskIdsAsync(
        CancellationToken cancellationToken = default) =>
        await _financial.CourtVisitFeeCharges.AsNoTracking()
            .Select(c => c.OperationsTaskId)
            .ToListAsync(cancellationToken);
}
