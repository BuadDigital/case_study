using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class PoEnfazBillingService : IPoEnfazBillingService
{
    private const decimal VatRate = 0.15m;
    private readonly ApplicationDbContext _db;

    public PoEnfazBillingService(ApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<EnfazReadyPoSummaryDto>> ListReadyPoSummariesAsync(
        CancellationToken cancellationToken = default)
    {
        var orders = await _db.WorkOrders.AsNoTracking()
            .Include(w => w.Properties)
            .OrderBy(w => w.PoNumber)
            .ToListAsync(cancellationToken);

        var poNumbers = orders.Select(o => o.PoNumber.Trim()).Distinct().ToList();
        var tasks = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => poNumbers.Contains(t.PoNumber))
            .ToListAsync(cancellationToken);
        var tasksByPo = tasks.GroupBy(t => t.PoNumber.Trim(), StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.Ordinal);

        var summaries = new List<EnfazReadyPoSummaryDto>();
        foreach (var order in orders)
        {
            var po = order.PoNumber.Trim();
            var poTasks = tasksByPo.GetValueOrDefault(po, []);
            if (!IsPoReadyForEnfazBilling(order, poTasks))
                continue;

            var done = 0;
            var cancelled = 0;
            foreach (var property in order.Properties)
            {
                var propertyTasks = poTasks.Where(t => t.PropertyId == property.Id).ToList();
                if (propertyTasks.Count == 0)
                    continue;

                if (propertyTasks.All(t => t.Status == WorkflowTaskStatus.Cancelled))
                    cancelled += 1;
                else
                    done += 1;
            }

            summaries.Add(new EnfazReadyPoSummaryDto
            {
                PoNumber = po,
                DoneCount = done,
                CancelledCount = cancelled,
            });
        }

        return summaries;
    }

    public async Task<PoEnfazBillingDto?> GetPoBillingAsync(
        string poNumber,
        CancellationToken cancellationToken = default)
    {
        var normalized = poNumber.Trim();
        var order = await _db.WorkOrders.AsNoTracking()
            .Include(w => w.Properties)
            .FirstOrDefaultAsync(w => w.PoNumber == normalized, cancellationToken);
        if (order is null) return null;

        var tasks = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => t.PoNumber == normalized)
            .ToListAsync(cancellationToken);

        var propertyIds = order.Properties.Select(p => p.Id).ToList();
        var existing = await _db.PoEnfazRevenueLines.AsNoTracking()
            .Where(x => x.PoNumber == normalized && propertyIds.Contains(x.PropertyId))
            .ToDictionaryAsync(x => x.PropertyId, cancellationToken);

        var taskStatuses = await LoadPropertyWorkStatusesAsync(normalized, propertyIds, cancellationToken);

        var lines = order.Properties
            .OrderBy(p => p.TaskNumber ?? p.DeedNumber, StringComparer.Ordinal)
            .Select(p =>
            {
                var work = taskStatuses.GetValueOrDefault(p.Id, ("in_progress", "قيد التنفيذ"));
                existing.TryGetValue(p.Id, out var row);
                var label = string.IsNullOrWhiteSpace(p.TaskNumber)
                    ? p.DeedNumber.Trim()
                    : p.TaskNumber.Trim();
                if (!string.IsNullOrWhiteSpace(p.District))
                    label = $"{label} — {p.District.Trim()}";

                return new PoEnfazRevenueLineDto
                {
                    Id = row?.Id.ToString() ?? "",
                    PoNumber = normalized,
                    PropertyId = p.Id.ToString(),
                    PropertyLabel = label,
                    WorkStatus = work.Item1,
                    WorkStatusLabel = work.Item2,
                    EnfazFeeSar = row?.EnfazFeeSar ?? 0m,
                    IncludedInBilling = row?.IncludedInBilling ?? work.Item1 != "cancelled",
                };
            })
            .ToList();

        var invoice = await _db.PoEnfazInvoices.AsNoTracking()
            .FirstOrDefaultAsync(x => x.PoNumber == normalized, cancellationToken);

        return BuildDto(
            normalized,
            IsPoReadyForEnfazBilling(order, tasks),
            lines,
            invoice?.InvoiceNumber,
            invoice?.IssuedAtUtc);
    }

    public async Task<PoEnfazBillingDto?> SavePoBillingAsync(
        string poNumber,
        SavePoEnfazBillingRequest request,
        CancellationToken cancellationToken = default)
    {
        var normalized = poNumber.Trim();
        var order = await _db.WorkOrders.AsNoTracking()
            .Include(w => w.Properties)
            .FirstOrDefaultAsync(w => w.PoNumber == normalized, cancellationToken);
        if (order is null) return null;

        var tasks = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => t.PoNumber == normalized)
            .ToListAsync(cancellationToken);
        if (!IsPoReadyForEnfazBilling(order, tasks))
            return null;

        var validPropertyIds = order.Properties.Select(p => p.Id).ToHashSet();
        var now = DateTime.UtcNow;

        var existingRows = await _db.PoEnfazRevenueLines
            .Where(x => x.PoNumber == normalized && validPropertyIds.Contains(x.PropertyId))
            .ToDictionaryAsync(x => x.PropertyId, cancellationToken);

        foreach (var input in request.Lines)
        {
            if (!Guid.TryParse(input.PropertyId.Trim(), out var propertyId))
                continue;
            if (!validPropertyIds.Contains(propertyId))
                continue;

            if (!existingRows.TryGetValue(propertyId, out var row))
            {
                row = new PoEnfazRevenueLine
                {
                    Id = Guid.NewGuid(),
                    PoNumber = normalized,
                    PropertyId = propertyId,
                };
                _db.PoEnfazRevenueLines.Add(row);
                existingRows[propertyId] = row;
            }

            row.EnfazFeeSar = Math.Max(0m, input.EnfazFeeSar);
            row.IncludedInBilling = input.IncludedInBilling;
            row.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
        return await GetPoBillingAsync(normalized, cancellationToken);
    }

    public async Task<PropertyEnfazRevenueDto?> GetPropertyRevenueAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.PoEnfazRevenueLines.AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.PoNumber == poNumber.Trim() && x.PropertyId == propertyId,
                cancellationToken);

        if (row is null || !row.IncludedInBilling || row.EnfazFeeSar <= 0)
        {
            return new PropertyEnfazRevenueDto { HasEnfazRevenue = false, EnfazFeeSar = null };
        }

        return new PropertyEnfazRevenueDto
        {
            HasEnfazRevenue = true,
            EnfazFeeSar = row.EnfazFeeSar,
        };
    }

    public async Task<IReadOnlyList<EnfazTrackingRowDto>> ListTrackingAsync(
        CancellationToken cancellationToken = default)
    {
        var orders = await _db.WorkOrders.AsNoTracking()
            .Include(w => w.Properties)
            .OrderBy(w => w.PoNumber)
            .ToListAsync(cancellationToken);

        if (orders.Count == 0) return [];

        var poNumbers = orders.Select(o => o.PoNumber.Trim()).ToList();
        var enfazLines = await _db.PoEnfazRevenueLines.AsNoTracking()
            .Where(x => poNumbers.Contains(x.PoNumber))
            .ToListAsync(cancellationToken);
        var enfazByKey = enfazLines.ToDictionary(
            x => (x.PoNumber.Trim(), x.PropertyId),
            x => x);

        var allPropertyIds = orders.SelectMany(o => o.Properties.Select(p => p.Id)).ToList();
        var allTasks = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => poNumbers.Contains(t.PoNumber)
                && t.PropertyId != null
                && allPropertyIds.Contains(t.PropertyId.Value))
            .ToListAsync(cancellationToken);
        var taskStatusesByPo = BuildPropertyWorkStatusesByPo(allTasks);

        var rows = new List<EnfazTrackingRowDto>();
        foreach (var order in orders)
        {
            var po = order.PoNumber.Trim();
            var taskStatuses = taskStatusesByPo.GetValueOrDefault(po, []);

            foreach (var property in order.Properties.OrderBy(p => p.TaskNumber ?? p.DeedNumber, StringComparer.Ordinal))
            {
                var work = taskStatuses.GetValueOrDefault(property.Id, ("in_progress", "قيد التنفيذ"));
                enfazByKey.TryGetValue((po, property.Id), out var enfaz);
                var label = string.IsNullOrWhiteSpace(property.TaskNumber)
                    ? property.DeedNumber.Trim()
                    : property.TaskNumber.Trim();
                if (!string.IsNullOrWhiteSpace(property.District))
                    label = $"{label} — {property.District.Trim()}";

                var filled = enfaz is not null && enfaz.IncludedInBilling && enfaz.EnfazFeeSar > 0;
                rows.Add(new EnfazTrackingRowDto
                {
                    PoNumber = po,
                    PropertyId = property.Id.ToString(),
                    PropertyLabel = label,
                    WorkStatus = work.Item1,
                    WorkStatusLabel = work.Item2,
                    EnfazFilled = filled,
                    EnfazFeeSar = enfaz?.EnfazFeeSar ?? 0m,
                });
            }
        }

        return rows;
    }

    public async Task<PoEnfazBillingDto?> IssueInvoiceAsync(
        string poNumber,
        CancellationToken cancellationToken = default)
    {
        var normalized = poNumber.Trim();
        var billing = await GetPoBillingAsync(normalized, cancellationToken);
        if (billing is null || !billing.PoReadyForBilling || billing.SubtotalSar <= 0)
            return null;

        var invoiceNumber = $"INV-{normalized}-{DateTime.UtcNow:yyyyMMddHHmmss}";
        var now = DateTime.UtcNow;
        var existing = await _db.PoEnfazInvoices
            .FirstOrDefaultAsync(x => x.PoNumber == normalized, cancellationToken);
        if (existing is null)
        {
            _db.PoEnfazInvoices.Add(new PoEnfazInvoice
            {
                PoNumber = normalized,
                InvoiceNumber = invoiceNumber,
                IssuedAtUtc = now,
            });
        }
        else
        {
            existing.InvoiceNumber = invoiceNumber;
            existing.IssuedAtUtc = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
        return await GetPoBillingAsync(normalized, cancellationToken);
    }

    private async Task<Dictionary<Guid, (string Status, string Label)>> LoadPropertyWorkStatusesAsync(
        string poNumber,
        IReadOnlyList<Guid> propertyIds,
        CancellationToken cancellationToken)
    {
        var tasks = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => t.PoNumber == poNumber && t.PropertyId != null && propertyIds.Contains(t.PropertyId.Value))
            .ToListAsync(cancellationToken);

        return ComputePropertyWorkStatuses(propertyIds, tasks);
    }

    private static Dictionary<string, Dictionary<Guid, (string Status, string Label)>> BuildPropertyWorkStatusesByPo(
        IReadOnlyList<WorkflowTask> tasks)
    {
        var byPo = tasks
            .GroupBy(t => t.PoNumber.Trim(), StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.Ordinal);

        var result = new Dictionary<string, Dictionary<Guid, (string, string)>>(StringComparer.Ordinal);
        foreach (var (po, poTasks) in byPo)
        {
            var propertyIds = poTasks
                .Where(t => t.PropertyId.HasValue)
                .Select(t => t.PropertyId!.Value)
                .Distinct()
                .ToList();
            result[po] = ComputePropertyWorkStatuses(propertyIds, poTasks);
        }

        return result;
    }

    private static Dictionary<Guid, (string Status, string Label)> ComputePropertyWorkStatuses(
        IReadOnlyList<Guid> propertyIds,
        IReadOnlyList<WorkflowTask> tasks)
    {
        var result = new Dictionary<Guid, (string, string)>();
        foreach (var propertyId in propertyIds)
        {
            var propertyTasks = tasks.Where(t => t.PropertyId == propertyId).ToList();
            if (propertyTasks.Count == 0)
            {
                result[propertyId] = ("in_progress", InspectorFeeBillingRules.WorkStatusLabel("in_progress"));
                continue;
            }

            if (propertyTasks.All(t => t.Status == WorkflowTaskStatus.Cancelled))
            {
                result[propertyId] = ("cancelled", InspectorFeeBillingRules.WorkStatusLabel("cancelled"));
                continue;
            }

            var active = propertyTasks.Where(t => t.Status != WorkflowTaskStatus.Cancelled).ToList();
            var allDone = active.Count > 0 && active.All(t => t.Status == WorkflowTaskStatus.Completed);
            var status = allDone ? "done" : "in_progress";
            result[propertyId] = (status, InspectorFeeBillingRules.WorkStatusLabel(status));
        }

        return result;
    }

    private static bool IsPoReadyForEnfazBilling(WorkOrder order, IReadOnlyList<WorkflowTask> poTasks)
    {
        if (order.Properties.Count == 0) return false;

        foreach (var property in order.Properties)
        {
            var propertyTasks = poTasks
                .Where(t => t.PropertyId == property.Id)
                .ToList();
            if (propertyTasks.Count == 0)
                return false;

            var active = propertyTasks
                .Where(t => t.Status != WorkflowTaskStatus.Cancelled)
                .ToList();
            if (active.Count == 0)
                continue;

            if (!active.All(t => t.Status == WorkflowTaskStatus.Completed))
                return false;
        }

        return true;
    }

    private static PoEnfazBillingDto BuildDto(
        string poNumber,
        bool poReady,
        IReadOnlyList<PoEnfazRevenueLineDto> lines,
        string? invoiceNumber = null,
        DateTime? invoiceIssuedAtUtc = null)
    {
        var subtotal = lines
            .Where(l => l.WorkStatus == "done" && l.IncludedInBilling)
            .Sum(l => l.EnfazFeeSar);
        var vat = Math.Round(subtotal * VatRate, 2, MidpointRounding.AwayFromZero);

        return new PoEnfazBillingDto
        {
            PoNumber = poNumber,
            PoReadyForBilling = poReady,
            Lines = lines,
            SubtotalSar = subtotal,
            VatSar = vat,
            TotalSar = subtotal + vat,
            InvoiceNumber = invoiceNumber,
            InvoiceIssuedAtUtc = invoiceIssuedAtUtc,
        };
    }
}
