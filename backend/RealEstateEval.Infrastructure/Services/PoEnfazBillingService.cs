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
    private const int MaxOrderRows = 500;
    private const int MaxTrackingRows = 2000;
    private static readonly TimeSpan OverdueAfter = TimeSpan.FromDays(30);
    private readonly ApplicationDbContext _db;
    private readonly IAuditLogWriter _audit;

    public PoEnfazBillingService(ApplicationDbContext db, IAuditLogWriter audit)
    {
        _db = db;
        _audit = audit;
    }

    public async Task<IReadOnlyList<EnfazReadyPoSummaryDto>> ListReadyPoSummariesAsync(
        CancellationToken cancellationToken = default)
    {
        var orders = await _db.WorkOrders.AsNoTracking()
            .Include(w => w.Properties)
            .OrderByDescending(w => w.CreatedAtUtc)
            .ThenBy(w => w.PoNumber)
            .Take(MaxOrderRows)
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
        var entitlements = await LoadKeyEntitlementsByPropertyAsync(
            normalized,
            propertyIds,
            cancellationToken);

        var lines = order.Properties
            .OrderBy(p => p.RequestNumber ?? p.DeedNumber, StringComparer.Ordinal)
            .Select(p =>
            {
                var work = taskStatuses.GetValueOrDefault(p.Id, ("in_progress", "قيد التنفيذ"));
                existing.TryGetValue(p.Id, out var row);
                var label = string.IsNullOrWhiteSpace(p.RequestNumber)
                    ? p.DeedNumber.Trim()
                    : p.RequestNumber.Trim();
                if (!string.IsNullOrWhiteSpace(p.District))
                    label = $"{label} — {p.District.Trim()}";

                var hasEntitlement = entitlements.TryGetValue(p.Id, out var entitlement);
                var envelopeId = row?.KeyEntitlementEnvelopeId
                    ?? (hasEntitlement ? entitlement.EnvelopeId : (Guid?)null);
                IReadOnlyList<string> keyAttachments = hasEntitlement
                    ? entitlement.AttachmentIds
                    : [];
                return new PoEnfazRevenueLineDto
                {
                    Id = row?.Id.ToString() ?? "",
                    PoNumber = normalized,
                    PropertyId = p.Id.ToString(),
                    PropertyLabel = label,
                    WorkStatus = work.Item1,
                    WorkStatusLabel = work.Item2,
                    CaseStudyFeeSar = row?.CaseStudyFeeSar ?? 0m,
                    SurveyFeeSar = row?.SurveyFeeSar ?? 0m,
                    KeyFeeSar = row?.KeyFeeSar ?? 0m,
                    KeyEntitlementEnvelopeId = envelopeId?.ToString(),
                    HasKeyEntitlement = hasEntitlement || row?.KeyEntitlementEnvelopeId is not null,
                    KeyAttachmentIds = keyAttachments,
                    EnfazFeeSar = row?.TotalFeeSar
                        ?? ((row?.CaseStudyFeeSar ?? 0m) + (row?.SurveyFeeSar ?? 0m) + (row?.KeyFeeSar ?? 0m)),
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
            invoice);
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

            row.CaseStudyFeeSar = Math.Max(0m, input.CaseStudyFeeSar);
            row.SurveyFeeSar = Math.Max(0m, input.SurveyFeeSar);
            row.KeyFeeSar = Math.Max(0m, input.KeyFeeSar);
            if (Guid.TryParse(input.KeyEntitlementEnvelopeId, out var envelopeId))
                row.KeyEntitlementEnvelopeId = envelopeId;
            else if (row.KeyFeeSar > 0 && row.KeyEntitlementEnvelopeId is null)
            {
                // Keep link if finance entered a key fee without resending envelope id.
            }
            else if (row.KeyFeeSar <= 0)
                row.KeyEntitlementEnvelopeId = null;
            row.IncludedInBilling = input.IncludedInBilling;
            row.UpdatedAtUtc = now;
        }

        var entitlements = await LoadKeyEntitlementsByPropertyAsync(
            normalized,
            validPropertyIds.ToList(),
            cancellationToken);
        foreach (var row in existingRows.Values)
        {
            if (row.KeyFeeSar > 0
                && row.KeyEntitlementEnvelopeId is null
                && entitlements.TryGetValue(row.PropertyId, out var info))
            {
                row.KeyEntitlementEnvelopeId = info.EnvelopeId;
            }
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

        if (row is null || !row.IncludedInBilling || row.TotalFeeSar <= 0)
        {
            return new PropertyEnfazRevenueDto
            {
                HasEnfazRevenue = false,
                CaseStudyFeeSar = null,
                SurveyFeeSar = null,
                EnfazFeeSar = null,
            };
        }

        return new PropertyEnfazRevenueDto
        {
            HasEnfazRevenue = true,
            CaseStudyFeeSar = row.CaseStudyFeeSar,
            SurveyFeeSar = row.SurveyFeeSar,
            EnfazFeeSar = row.TotalFeeSar,
        };
    }

    public async Task<IReadOnlyList<EnfazTrackingRowDto>> ListTrackingAsync(
        CancellationToken cancellationToken = default)
    {
        var orders = await _db.WorkOrders.AsNoTracking()
            .Include(w => w.Properties)
            .OrderByDescending(w => w.CreatedAtUtc)
            .ThenBy(w => w.PoNumber)
            .Take(MaxOrderRows)
            .ToListAsync(cancellationToken);

        if (orders.Count == 0) return [];

        var poNumbers = orders.Select(o => o.PoNumber.Trim()).ToList();
        var enfazLines = await _db.PoEnfazRevenueLines.AsNoTracking()
            .Where(x => poNumbers.Contains(x.PoNumber))
            .ToListAsync(cancellationToken);
        var enfazByKey = enfazLines.ToDictionary(
            x => (x.PoNumber.Trim(), x.PropertyId),
            x => x);

        var invoicesByPo = await _db.PoEnfazInvoices.AsNoTracking()
            .Where(x => poNumbers.Contains(x.PoNumber))
            .ToDictionaryAsync(x => x.PoNumber.Trim(), StringComparer.Ordinal, cancellationToken);

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
            invoicesByPo.TryGetValue(po, out var invoice);
            var overdue = invoice is not null
                && invoice.Status != PoEnfazInvoiceStatus.Collected
                && DateTime.UtcNow - invoice.IssuedAtUtc > OverdueAfter;

            foreach (var property in order.Properties.OrderBy(p => p.RequestNumber ?? p.DeedNumber, StringComparer.Ordinal))
            {
                var work = taskStatuses.GetValueOrDefault(property.Id, ("in_progress", "قيد التنفيذ"));
                enfazByKey.TryGetValue((po, property.Id), out var enfaz);
                var label = string.IsNullOrWhiteSpace(property.RequestNumber)
                    ? property.DeedNumber.Trim()
                    : property.RequestNumber.Trim();
                if (!string.IsNullOrWhiteSpace(property.District))
                    label = $"{label} — {property.District.Trim()}";

                var filled = enfaz is not null && enfaz.IncludedInBilling && enfaz.TotalFeeSar > 0;
                rows.Add(new EnfazTrackingRowDto
                {
                    PoNumber = po,
                    PropertyId = property.Id.ToString(),
                    PropertyLabel = label,
                    WorkStatus = work.Item1,
                    WorkStatusLabel = work.Item2,
                    EnfazFilled = filled,
                    CaseStudyFeeSar = enfaz?.CaseStudyFeeSar ?? 0m,
                    SurveyFeeSar = enfaz?.SurveyFeeSar ?? 0m,
                    EnfazFeeSar = enfaz?.TotalFeeSar ?? 0m,
                    InvoiceNumber = invoice?.InvoiceNumber,
                    InvoiceStatus = invoice?.Status,
                    CollectedAmountSar = invoice?.CollectedAmountSar ?? 0m,
                    InvoiceIssuedAtUtc = invoice?.IssuedAtUtc,
                    IsOverdue = overdue,
                });
            }
        }

        return rows.Take(MaxTrackingRows).ToList();
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
        var attachmentIdsJson = SerializeAttachmentIds(
            billing.Lines
                .Where(l => l.IncludedInBilling && l.WorkStatus == "done")
                .SelectMany(l => l.KeyAttachmentIds)
                .Concat(billing.AttachmentIds)
                .Distinct(StringComparer.OrdinalIgnoreCase));
        var existing = await _db.PoEnfazInvoices
            .FirstOrDefaultAsync(x => x.PoNumber == normalized, cancellationToken);
        if (existing is null)
        {
            _db.PoEnfazInvoices.Add(new PoEnfazInvoice
            {
                PoNumber = normalized,
                InvoiceNumber = invoiceNumber,
                IssuedAtUtc = now,
                Status = PoEnfazInvoiceStatus.Issued,
                SubtotalSar = billing.SubtotalSar,
                VatSar = billing.VatSar,
                TotalSar = billing.TotalSar,
                CollectedAmountSar = 0m,
                AttachmentIdsJson = attachmentIdsJson,
            });
        }
        else
        {
            existing.InvoiceNumber = invoiceNumber;
            existing.IssuedAtUtc = now;
            existing.Status = PoEnfazInvoiceStatus.Issued;
            existing.SubtotalSar = billing.SubtotalSar;
            existing.VatSar = billing.VatSar;
            existing.TotalSar = billing.TotalSar;
            existing.CollectedAmountSar = 0m;
            existing.CollectedAtUtc = null;
            existing.AttachmentIdsJson = attachmentIdsJson;
        }

        await _db.SaveChangesAsync(cancellationToken);
        return await GetPoBillingAsync(normalized, cancellationToken);
    }

    public async Task<(PoEnfazBillingDto? Billing, string? Error)> CollectInvoiceAsync(
        string poNumber,
        CollectPoEnfazInvoiceRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var normalized = poNumber.Trim();
        var invoice = await _db.PoEnfazInvoices
            .FirstOrDefaultAsync(x => x.PoNumber == normalized, cancellationToken);
        if (invoice is null)
            return (null, "لا توجد فاتورة صادرة لهذا أمر العمل.");

        if (invoice.Status == PoEnfazInvoiceStatus.Collected
            || invoice.CollectedAmountSar + 0.009m >= invoice.TotalSar)
            return (null, "الفاتورة محصّلة بالكامل.");

        var amount = Math.Max(0m, request.AmountSar);
        if (amount <= 0m)
            return (null, "مبلغ التحصيل يجب أن يكون أكبر من صفر.");

        var nextCollected = invoice.CollectedAmountSar + amount;
        if (nextCollected > invoice.TotalSar + 0.01m)
            return (null, "مبلغ التحصيل يتجاوز إجمالي الفاتورة.");

        var previousCollected = invoice.CollectedAmountSar;
        invoice.CollectedAmountSar = nextCollected;
        invoice.CollectedAtUtc = DateTime.UtcNow;
        invoice.Status = nextCollected + 0.009m >= invoice.TotalSar
            ? PoEnfazInvoiceStatus.Collected
            : PoEnfazInvoiceStatus.PartiallyCollected;

        _db.AuditLogs.Add(_audit.Create(
            string.IsNullOrWhiteSpace(actorUserId) ? "system" : actorUserId,
            "ENFAZ_INVOICE_COLLECTED",
            "po_enfaz_invoice",
            normalized,
            new { collectedAmountSar = previousCollected, note = request.Note },
            new
            {
                invoice.CollectedAmountSar,
                invoice.Status,
                invoice.TotalSar,
            }));

        await _db.SaveChangesAsync(cancellationToken);
        return (await GetPoBillingAsync(normalized, cancellationToken), null);
    }

    public async Task<EnfazAgingReportDto> GetAgingReportAsync(
        CancellationToken cancellationToken = default)
    {
        var asOf = DateTime.UtcNow;
        var invoices = await _db.PoEnfazInvoices.AsNoTracking()
            .Where(i => i.Status != PoEnfazInvoiceStatus.Collected
                && i.CollectedAmountSar + 0.009m < i.TotalSar)
            .OrderBy(i => i.IssuedAtUtc)
            .ThenBy(i => i.PoNumber)
            .ToListAsync(cancellationToken);

        var rows = new List<EnfazAgingInvoiceRowDto>(invoices.Count);
        foreach (var invoice in invoices)
        {
            var outstanding = Math.Max(0m, invoice.TotalSar - invoice.CollectedAmountSar);
            if (outstanding <= 0.009m)
                continue;

            var ageDays = Math.Max(0, (int)Math.Floor((asOf - invoice.IssuedAtUtc).TotalDays));
            var (bucketKey, bucketLabel) = ResolveAgingBucket(ageDays);
            rows.Add(new EnfazAgingInvoiceRowDto
            {
                PoNumber = invoice.PoNumber,
                InvoiceNumber = invoice.InvoiceNumber,
                Status = invoice.Status,
                IssuedAtUtc = invoice.IssuedAtUtc,
                AgeDays = ageDays,
                BucketKey = bucketKey,
                BucketLabel = bucketLabel,
                TotalSar = invoice.TotalSar,
                CollectedAmountSar = invoice.CollectedAmountSar,
                OutstandingSar = Math.Round(outstanding, 2, MidpointRounding.AwayFromZero),
            });
        }

        var buckets = new[]
        {
            ("0_30", "0–30 يوماً"),
            ("31_60", "31–60 يوماً"),
            ("61_90", "61–90 يوماً"),
            ("90_plus", "أكثر من 90 يوماً"),
        }.Select(def =>
        {
            var inBucket = rows.Where(r => r.BucketKey == def.Item1).ToList();
            return new EnfazAgingBucketDto
            {
                Key = def.Item1,
                Label = def.Item2,
                InvoiceCount = inBucket.Count,
                OutstandingSar = inBucket.Sum(r => r.OutstandingSar),
            };
        }).ToList();

        return new EnfazAgingReportDto
        {
            AsOfUtc = asOf,
            TotalOutstandingSar = rows.Sum(r => r.OutstandingSar),
            OpenInvoiceCount = rows.Count,
            Buckets = buckets,
            Invoices = rows
                .OrderByDescending(r => r.AgeDays)
                .ThenBy(r => r.PoNumber, StringComparer.Ordinal)
                .ToList(),
        };
    }

    private static (string Key, string Label) ResolveAgingBucket(int ageDays) =>
        ageDays switch
        {
            <= 30 => ("0_30", "0–30 يوماً"),
            <= 60 => ("31_60", "31–60 يوماً"),
            <= 90 => ("61_90", "61–90 يوماً"),
            _ => ("90_plus", "أكثر من 90 يوماً"),
        };

    public async Task<byte[]?> GetInvoicePdfAsync(
        string poNumber,
        CancellationToken cancellationToken = default)
    {
        var billing = await GetPoBillingAsync(poNumber, cancellationToken);
        if (billing is null || string.IsNullOrWhiteSpace(billing.InvoiceNumber))
            return null;

        return EnfazInvoicePdfGenerator.Generate(billing);
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

    private readonly record struct KeyEntitlementInfo(Guid EnvelopeId, IReadOnlyList<string> AttachmentIds);

    private async Task<Dictionary<Guid, KeyEntitlementInfo>> LoadKeyEntitlementsByPropertyAsync(
        string poNumber,
        IReadOnlyList<Guid> propertyIds,
        CancellationToken cancellationToken)
    {
        _ = poNumber;
        if (propertyIds.Count == 0)
            return new Dictionary<Guid, KeyEntitlementInfo>();

        // Entitled court envelopes linked to PO properties via assignments.
        var rows = await (
            from a in _db.KeyEnvelopeAssignments.AsNoTracking()
            join e in _db.KeyEnvelopes.AsNoTracking() on a.EnvelopeId equals e.Id
            where e.RevenueEntitlementAtUtc != null
                  && a.PropertyId != null
                  && propertyIds.Contains(a.PropertyId.Value)
            orderby e.RevenueEntitlementAtUtc
            select new
            {
                EnvelopeId = e.Id,
                PropertyId = a.PropertyId!.Value,
                e.PhotoAttachmentId,
                e.ReceiptAttachmentId,
                e.ThirdPartyLetterAttachmentId,
            })
            .ToListAsync(cancellationToken);

        var map = new Dictionary<Guid, KeyEntitlementInfo>();
        foreach (var row in rows)
        {
            if (map.ContainsKey(row.PropertyId))
                continue;

            var ids = new List<string>(3);
            if (row.PhotoAttachmentId is Guid photo)
                ids.Add(photo.ToString());
            if (row.ReceiptAttachmentId is Guid receipt)
                ids.Add(receipt.ToString());
            if (row.ThirdPartyLetterAttachmentId is Guid letter)
                ids.Add(letter.ToString());

            map[row.PropertyId] = new KeyEntitlementInfo(row.EnvelopeId, ids);
        }

        return map;
    }

    private static PoEnfazBillingDto BuildDto(
        string poNumber,
        bool poReady,
        IReadOnlyList<PoEnfazRevenueLineDto> lines,
        PoEnfazInvoice? invoice = null)
    {
        var subtotal = lines
            .Where(l => l.WorkStatus == "done" && l.IncludedInBilling)
            .Sum(l => l.CaseStudyFeeSar + l.SurveyFeeSar + l.KeyFeeSar);
        var vat = Math.Round(subtotal * VatRate, 2, MidpointRounding.AwayFromZero);
        var total = subtotal + vat;
        var collected = invoice?.CollectedAmountSar ?? 0m;
        var status = invoice?.Status;
        var issuedAt = invoice?.IssuedAtUtc;
        var overdue = invoice is not null
            && status != PoEnfazInvoiceStatus.Collected
            && issuedAt.HasValue
            && DateTime.UtcNow - issuedAt.Value > OverdueAfter;

        var invoiceAttachments = ParseAttachmentIds(invoice?.AttachmentIdsJson);
        var lineAttachments = lines
            .SelectMany(l => l.KeyAttachmentIds)
            .Where(id => !string.IsNullOrWhiteSpace(id));
        var attachmentIds = invoiceAttachments.Count > 0
            ? invoiceAttachments
            : lineAttachments.Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        return new PoEnfazBillingDto
        {
            PoNumber = poNumber,
            PoReadyForBilling = poReady,
            Lines = lines,
            SubtotalSar = invoice?.SubtotalSar > 0 ? invoice.SubtotalSar : subtotal,
            VatSar = invoice?.VatSar > 0 ? invoice.VatSar : vat,
            TotalSar = invoice?.TotalSar > 0 ? invoice.TotalSar : total,
            InvoiceNumber = invoice?.InvoiceNumber,
            InvoiceIssuedAtUtc = issuedAt,
            InvoiceStatus = status,
            CollectedAmountSar = collected,
            CollectedAtUtc = invoice?.CollectedAtUtc,
            IsOverdue = overdue,
            AttachmentIds = attachmentIds,
        };
    }

    private static IReadOnlyList<string> ParseAttachmentIds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return [];

        try
        {
            var ids = System.Text.Json.JsonSerializer.Deserialize<List<string>>(json);
            return ids?
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Select(id => id.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList()
                ?? [];
        }
        catch (System.Text.Json.JsonException)
        {
            return [];
        }
    }

    private static string? SerializeAttachmentIds(IEnumerable<string> ids)
    {
        var list = ids
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        return list.Count == 0
            ? null
            : System.Text.Json.JsonSerializer.Serialize(list);
    }
}
