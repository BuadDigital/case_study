using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Domain;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Application.Abstractions;

namespace RealEstateEval.Financial.Infrastructure.Services;

public sealed class PoEnfazBillingService : IPoEnfazBillingService
{
    private const int MaxOrderRows = 500;
    private const int MaxTrackingRows = 2000;
    private readonly FinancialDbContext _db;
    private readonly ICaseStudyLookup _lookup;
    private readonly IKeyEntitlementLookup _keyEntitlements;
    private readonly IAuditLogWriter _audit;
    private readonly TimeProvider _time;

    [ActivatorUtilitiesConstructor]
    public PoEnfazBillingService(
        FinancialDbContext db,
        ICaseStudyLookup lookup,
        IKeyEntitlementLookup keyEntitlements,
        IAuditLogWriter audit,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _lookup = lookup;
        _keyEntitlements = keyEntitlements;
        _audit = audit;
    }

    public async Task<IReadOnlyList<EnfazReadyPoSummaryDto>> ListReadyPoSummariesAsync(
        CancellationToken cancellationToken = default)
    {
        var orders = await _lookup.ListWorkOrdersForBillingAsync(MaxOrderRows, cancellationToken);
        var poNumbers = orders.Select(o => o.PoNumber.Trim()).Distinct().ToList();
        var taskSnapshots = await _lookup.ListWorkflowTasksByPoNumbersAsync(poNumbers, cancellationToken);
        var tasks = taskSnapshots.Select(s => s.ToWorkflowTask()).ToList();
        var tasksByPo = tasks.GroupBy(t => t.PoNumber.Trim(), StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.Ordinal);

        var summaries = new List<EnfazReadyPoSummaryDto>();
        foreach (var order in orders)
        {
            var po = order.PoNumber.Trim();
            var poTasks = tasksByPo.GetValueOrDefault(po, []);
            if (!PoEnfazWorkStatusRules.IsPoReadyForEnfazBilling(order.Properties, poTasks))
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
        var order = await _lookup.GetWorkOrderForBillingAsync(normalized, cancellationToken);
        if (order is null) return null;

        var tasks = (await _lookup.ListWorkflowTasksByPoNumbersAsync([normalized], cancellationToken))
            .Select(s => s.ToWorkflowTask())
            .ToList();

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
                var work = taskStatuses.GetValueOrDefault(
                    p.Id,
                    (InspectorFeeWorkStatuses.InProgress, InspectorFeeBillingRules.WorkStatusLabel(InspectorFeeWorkStatuses.InProgress)));
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
                    IncludedInBilling = row?.IncludedInBilling ?? work.Item1 != InspectorFeeWorkStatuses.Cancelled,
                };
            })
            .ToList();

        var invoice = await _db.PoEnfazInvoices.AsNoTracking()
            .FirstOrDefaultAsync(x => x.PoNumber == normalized, cancellationToken);

        return PoEnfazBillingDtoBuilder.BuildDto(
            normalized,
            PoEnfazWorkStatusRules.IsPoReadyForEnfazBilling(order.Properties, tasks),
            lines,
            invoice,
            _time.UtcNow());
    }

    public async Task<PoEnfazBillingDto?> SavePoBillingAsync(
        string poNumber,
        SavePoEnfazBillingRequest request,
        CancellationToken cancellationToken = default)
    {
        var normalized = poNumber.Trim();
        var order = await _lookup.GetWorkOrderForBillingAsync(normalized, cancellationToken);
        if (order is null) return null;

        var tasks = (await _lookup.ListWorkflowTasksByPoNumbersAsync([normalized], cancellationToken))
            .Select(s => s.ToWorkflowTask())
            .ToList();
        if (!PoEnfazWorkStatusRules.IsPoReadyForEnfazBilling(order.Properties, tasks))
            return null;

        var validPropertyIds = order.Properties.Select(p => p.Id).ToHashSet();
        var now = _time.UtcNow();

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
        var orders = await _lookup.ListWorkOrdersForBillingAsync(MaxOrderRows, cancellationToken);

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

        var flags = await _db.PoEnfazFinanceFlags.AsNoTracking()
            .Where(f => poNumbers.Contains(f.PoNumber))
            .ToListAsync(cancellationToken);
        var followupCounts = await _db.PoEnfazFollowups.AsNoTracking()
            .Where(f => poNumbers.Contains(f.PoNumber))
            .GroupBy(f => f.PoNumber)
            .Select(g => new { PoNumber = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);
        var followupCountByPo = followupCounts.ToDictionary(
            x => x.PoNumber.Trim(),
            x => x.Count,
            StringComparer.Ordinal);

        var allPropertyIds = orders.SelectMany(o => o.Properties.Select(p => p.Id)).ToList();
        var allTasks = (await _lookup.ListWorkflowTasksByPoNumbersAsync(poNumbers, cancellationToken))
            .Select(s => s.ToWorkflowTask())
            .Where(t => t.PropertyId != null && allPropertyIds.Contains(t.PropertyId.Value))
            .ToList();
        var taskStatusesByPo = PoEnfazWorkStatusRules.BuildPropertyWorkStatusesByPo(allTasks);
        var completedAtByProperty = PoEnfazWorkStatusRules.BuildPropertyCompletedAtById(allTasks);

        var rows = new List<EnfazTrackingRowDto>();
        foreach (var order in orders)
        {
            var po = order.PoNumber.Trim();
            var taskStatuses = taskStatusesByPo.GetValueOrDefault(po, []);
            invoicesByPo.TryGetValue(po, out var invoice);
            var overdue = invoice is not null
                && invoice.Status != PoEnfazInvoiceStatus.Collected
                && _time.UtcNow() - invoice.IssuedAtUtc > PoEnfazBillingDtoBuilder.OverdueAfter;
            var followupCount = followupCountByPo.GetValueOrDefault(po, 0);
            var poFlags = flags.Where(f =>
                string.Equals(f.PoNumber.Trim(), po, StringComparison.Ordinal)).ToList();

            foreach (var property in order.Properties.OrderBy(
                p => string.IsNullOrWhiteSpace(p.RequestNumber) ? p.DeedNumber : p.RequestNumber,
                StringComparer.Ordinal))
            {
                var work = taskStatuses.GetValueOrDefault(
                    property.Id,
                    (InspectorFeeWorkStatuses.InProgress, InspectorFeeBillingRules.WorkStatusLabel(InspectorFeeWorkStatuses.InProgress)));
                enfazByKey.TryGetValue((po, property.Id), out var enfaz);
                var label = string.IsNullOrWhiteSpace(property.RequestNumber)
                    ? (property.DeedNumber ?? "").Trim()
                    : property.RequestNumber.Trim();
                if (!string.IsNullOrWhiteSpace(property.District))
                    label = $"{label} — {property.District.Trim()}";

                var filled = enfaz is not null && enfaz.IncludedInBilling && enfaz.TotalFeeSar > 0;
                completedAtByProperty.TryGetValue(property.Id, out var taskCompletedAt);
                var completedAt = property.BourseCompletedAtUtc ?? taskCompletedAt;
                if (work.Item1 != InspectorFeeWorkStatuses.Done)
                    completedAt = null;

                var deed = (property.DeedNumber ?? string.Empty).Trim();
                var city = (property.City ?? string.Empty).Trim();
                var landArea = (property.Area ?? string.Empty).Trim();
                var flag = PoEnfazWorkStatusRules.ResolveFinanceFlag(poFlags, property.Id);

                rows.Add(new EnfazTrackingRowDto
                {
                    PoNumber = po,
                    PropertyId = property.Id.ToString(),
                    PropertyLabel = label,
                    DeedNumber = deed,
                    City = city,
                    LandArea = landArea,
                    CompletedAtUtc = completedAt,
                    WorkStatus = work.Item1,
                    WorkStatusLabel = work.Item2,
                    EnfazFilled = filled,
                    CaseStudyFeeSar = enfaz?.CaseStudyFeeSar ?? 0m,
                    SurveyFeeSar = enfaz?.SurveyFeeSar ?? 0m,
                    KeyFeeSar = enfaz?.KeyFeeSar ?? 0m,
                    EnfazFeeSar = enfaz?.TotalFeeSar ?? 0m,
                    InvoiceNumber = invoice?.InvoiceNumber,
                    InvoiceStatus = invoice?.Status,
                    CollectedAmountSar = invoice?.CollectedAmountSar ?? 0m,
                    InvoiceIssuedAtUtc = invoice?.IssuedAtUtc,
                    IsOverdue = overdue,
                    FinanceFlag = flag?.Flag,
                    FinanceFlagNote = flag?.Note,
                    FollowupCount = followupCount,
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

        var invoiceNumber = $"INV-{normalized}-{_time.UtcNow():yyyyMMddHHmmss}";
        var now = _time.UtcNow();
        var attachmentIdsJson = PoEnfazBillingDtoBuilder.SerializeAttachmentIds(
            billing.Lines
                .Where(l => l.IncludedInBilling && l.WorkStatus == InspectorFeeWorkStatuses.Done)
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
        invoice.CollectedAtUtc = _time.UtcNow();
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
        var asOf = _time.UtcNow();
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
            var (bucketKey, bucketLabel) = PoEnfazFollowupRules.ResolveAgingBucket(ageDays);
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
        var tasks = (await _lookup.ListWorkflowTasksByPoNumbersAsync([poNumber], cancellationToken))
            .Select(s => s.ToWorkflowTask())
            .Where(t => t.PropertyId != null && propertyIds.Contains(t.PropertyId.Value))
            .ToList();

        return PoEnfazWorkStatusRules.ComputePropertyWorkStatuses(propertyIds, tasks);
    }

    private readonly record struct KeyEntitlementInfo(Guid EnvelopeId, IReadOnlyList<string> AttachmentIds);

    private async Task<Dictionary<Guid, KeyEntitlementInfo>> LoadKeyEntitlementsByPropertyAsync(
        string poNumber,
        IReadOnlyList<Guid> propertyIds,
        CancellationToken cancellationToken)
    {
        if (propertyIds.Count == 0)
            return new Dictionary<Guid, KeyEntitlementInfo>();

        var rows = await _keyEntitlements.ListByPropertyIdsAsync(propertyIds, cancellationToken);
        var map = new Dictionary<Guid, KeyEntitlementInfo>();
        foreach (var row in rows)
        {
            if (map.ContainsKey(row.PropertyId))
                continue;

            map[row.PropertyId] = new KeyEntitlementInfo(row.EnvelopeId, row.AttachmentIds);
        }

        return map;
    }

    public async Task<IReadOnlyList<EnfazFollowupDto>> ListFollowupsAsync(
        string poNumber,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (string.IsNullOrEmpty(po)) return [];

        var rows = await _db.PoEnfazFollowups.AsNoTracking()
            .Where(f => f.PoNumber == po)
            .OrderByDescending(f => f.FollowedAtUtc)
            .ThenByDescending(f => f.CreatedAtUtc)
            .Take(100)
            .ToListAsync(cancellationToken);

        return rows.Select(PoEnfazFollowupRules.ToFollowupDto).ToList();
    }

    public async Task<(EnfazFollowupDto? Followup, string? Error)> AddFollowupAsync(
        string poNumber,
        AddEnfazFollowupRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        var notes = (request.Notes ?? "").Trim();
        if (string.IsNullOrEmpty(po))
            return (null, "رقم أمر العمل مطلوب.");
        if (string.IsNullOrEmpty(notes))
            return (null, "ملاحظات المتابعة إلزامية.");

        var channel = PoEnfazFollowupRules.NormalizeChannel(request.Channel);
        var now = _time.UtcNow();
        var followedAt = request.FollowedAtUtc?.ToUniversalTime() ?? now;
        var entity = new PoEnfazFollowup
        {
            Id = Guid.NewGuid(),
            PoNumber = po,
            FollowedAtUtc = followedAt,
            Channel = channel,
            Notes = notes.Length > 2000 ? notes[..2000] : notes,
            CreatedByUserId = actorUserId ?? "",
            CreatedAtUtc = now,
        };
        _db.PoEnfazFollowups.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);
        return (PoEnfazFollowupRules.ToFollowupDto(entity), null);
    }

    public async Task<(bool Ok, string? Error)> SetFinanceFlagAsync(
        string poNumber,
        SetEnfazFinanceFlagRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (string.IsNullOrEmpty(po))
            return (false, "رقم أمر العمل مطلوب.");

        var flag = (request.Flag ?? "").Trim().ToLowerInvariant();
        if (flag is not (
            PoEnfazFinanceFlagKind.Stopped
            or PoEnfazFinanceFlagKind.Excluded
            or PoEnfazFinanceFlagKind.Difficult))
            return (false, "علامة غير معروفة. استخدم stopped أو excluded أو difficult.");

        Guid? propertyId = null;
        if (!string.IsNullOrWhiteSpace(request.PropertyId)
            && Guid.TryParse(request.PropertyId.Trim(), out var parsed))
            propertyId = parsed;

        var existing = await _db.PoEnfazFinanceFlags
            .Where(f => f.PoNumber == po)
            .ToListAsync(cancellationToken);

        var match = existing.FirstOrDefault(f => f.PropertyId == propertyId)
            ?? existing.FirstOrDefault(f => propertyId is null && f.PropertyId is null);

        var now = _time.UtcNow();
        var note = string.IsNullOrWhiteSpace(request.Note)
            ? null
            : request.Note.Trim();
        if (note is { Length: > 1000 }) note = note[..1000];

        if (match is null)
        {
            _db.PoEnfazFinanceFlags.Add(new PoEnfazFinanceFlag
            {
                Id = Guid.NewGuid(),
                PoNumber = po,
                PropertyId = propertyId,
                Flag = flag,
                Note = note,
                SetByUserId = actorUserId ?? "",
                SetAtUtc = now,
            });
        }
        else
        {
            match.Flag = flag;
            match.Note = note;
            match.SetByUserId = actorUserId ?? "";
            match.SetAtUtc = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> ClearFinanceFlagAsync(
        string poNumber,
        string? propertyId,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (string.IsNullOrEmpty(po))
            return (false, "رقم أمر العمل مطلوب.");

        Guid? propGuid = null;
        if (!string.IsNullOrWhiteSpace(propertyId)
            && Guid.TryParse(propertyId.Trim(), out var parsed))
            propGuid = parsed;

        var q = _db.PoEnfazFinanceFlags.Where(f => f.PoNumber == po);
        var list = await q.ToListAsync(cancellationToken);
        var toRemove = list.Where(f =>
            propGuid is null
                ? f.PropertyId is null
                : f.PropertyId == propGuid).ToList();

        if (toRemove.Count == 0)
            return (true, null);

        _db.PoEnfazFinanceFlags.RemoveRange(toRemove);
        await _db.SaveChangesAsync(cancellationToken);
        return (true, null);
    }
}

