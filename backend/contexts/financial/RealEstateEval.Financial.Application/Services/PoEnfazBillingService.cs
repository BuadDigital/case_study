using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Financial.Application.Services;

/// <summary>
/// Enfaz PO billing use case: readiness, revenue lines, invoice issue and collection, aging,
/// finance flags, and follow-ups. Persistence is <see cref="IPoEnfazBillingRepository"/>, so
/// this class never opens EF.
/// </summary>
public sealed partial class PoEnfazBillingService : IPoEnfazBillingService
{
    private const int MaxOrderRows = 500;
    private const int MaxTrackingRows = 2000;
    private const int MaxFollowupRows = 100;
    private readonly IPoEnfazBillingRepository _db;
    private readonly ICaseStudyLookup _lookup;
    private readonly IPropertyKeyEntitlementLookup _keyEntitlements;
    private readonly IEnfazInvoicePdfRenderer _pdf;
    private readonly IAuditLogWriter _audit;
    private readonly TimeProvider _time;

    [ActivatorUtilitiesConstructor]
    public PoEnfazBillingService(
        IPoEnfazBillingRepository db,
        ICaseStudyLookup lookup,
        IPropertyKeyEntitlementLookup keyEntitlements,
        IEnfazInvoicePdfRenderer pdf,
        IAuditLogWriter audit,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _lookup = lookup;
        _keyEntitlements = keyEntitlements;
        _pdf = pdf;
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
            var summary = PoEnfazRevenueRules.ReadySummary(
                po,
                order.Properties,
                tasksByPo.GetValueOrDefault(po, []));
            if (summary is not null)
                summaries.Add(summary);
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
        var existing = (await _db.ListRevenueLinesAsync(
                normalized, propertyIds, track: false, cancellationToken))
            .ToDictionary(x => x.PropertyId);

        var taskStatuses = await LoadPropertyWorkStatusesAsync(normalized, propertyIds, cancellationToken);
        var entitlements = await LoadKeyEntitlementsByPropertyAsync(
            normalized,
            propertyIds,
            cancellationToken);

        var lines = order.Properties
            .OrderBy(p => p.RequestNumber ?? p.DeedNumber, StringComparer.Ordinal)
            .Select(p => PoEnfazRevenueRules.ToRevenueLineDto(
                normalized,
                p,
                PoEnfazRevenueRules.WorkOrInProgress(taskStatuses, p.Id),
                existing.GetValueOrDefault(p.Id),
                entitlements.GetValueOrDefault(p.Id)))
            .ToList();

        var invoice = await _db.FindInvoiceAsync(normalized, track: false, cancellationToken);

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

        var existingRows = (await _db.ListRevenueLinesAsync(
                normalized, validPropertyIds.ToList(), track: true, cancellationToken))
            .ToDictionary(x => x.PropertyId);

        foreach (var input in request.Lines)
        {
            if (!PoEnfazRevenueRules.TryParseLineProperty(input, validPropertyIds, out var propertyId))
                continue;

            if (!existingRows.TryGetValue(propertyId, out var row))
            {
                row = new PoEnfazRevenueLine
                {
                    Id = Guid.NewGuid(),
                    PoNumber = normalized,
                    PropertyId = propertyId,
                };
                _db.AddRevenueLine(row);
                existingRows[propertyId] = row;
            }

            PoEnfazRevenueRules.ApplyLineInput(row, input, now);
        }

        var entitlements = await LoadKeyEntitlementsByPropertyAsync(
            normalized,
            validPropertyIds.ToList(),
            cancellationToken);
        PoEnfazRevenueRules.LinkMissingEnvelopes(existingRows.Values, entitlements);

        await _db.SaveChangesAsync(cancellationToken);
        return await GetPoBillingAsync(normalized, cancellationToken);
    }

    public async Task<PropertyEnfazRevenueDto?> GetPropertyRevenueAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.FindRevenueLineAsync(
            poNumber.Trim(), propertyId, cancellationToken);

        return PoEnfazRevenueRules.PropertyRevenue(row);
    }

    public async Task<PoEnfazBillingDto?> IssueInvoiceAsync(
        string poNumber,
        CancellationToken cancellationToken = default)
    {
        var normalized = poNumber.Trim();
        var billing = await GetPoBillingAsync(normalized, cancellationToken);
        if (billing is null || !billing.PoReadyForBilling || billing.SubtotalSar <= 0)
            return null;

        var invoiceNumber = PoEnfazInvoiceRules.InvoiceNumber(normalized, _time.UtcNow());
        var now = _time.UtcNow();
        var attachmentIdsJson = PoEnfazBillingDtoBuilder.SerializeAttachmentIds(
            PoEnfazInvoiceRules.IssueAttachmentIds(billing));
        var existing = await _db.FindInvoiceAsync(normalized, track: true, cancellationToken);
        var invoice = existing ?? new PoEnfazInvoice { PoNumber = normalized };
        PoEnfazInvoiceRules.ApplyIssue(invoice, billing, invoiceNumber, now, attachmentIdsJson);
        if (existing is null)
            _db.AddInvoice(invoice);

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
        var invoice = await _db.FindInvoiceAsync(normalized, track: true, cancellationToken);
        if (invoice is null)
            return (null, "لا توجد فاتورة صادرة لهذا أمر العمل.");

        var check = PoEnfazInvoiceRules.ValidateCollection(invoice, request.AmountSar);
        if (check.Error is not null)
            return (null, check.Error);

        var previousCollected = invoice.CollectedAmountSar;
        invoice.CollectedAmountSar = check.NextCollected;
        invoice.CollectedAtUtc = _time.UtcNow();
        invoice.Status = PoEnfazInvoiceRules.StatusAfterCollection(check.NextCollected, invoice.TotalSar);

        _db.AddAuditLog(_audit.Create(
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

    public async Task<byte[]?> GetInvoicePdfAsync(
        string poNumber,
        CancellationToken cancellationToken = default)
    {
        var billing = await GetPoBillingAsync(poNumber, cancellationToken);
        if (billing is null || string.IsNullOrWhiteSpace(billing.InvoiceNumber))
            return null;

        return _pdf.Render(billing);
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

    private async Task<Dictionary<Guid, PropertyKeyEntitlement>> LoadKeyEntitlementsByPropertyAsync(
        string poNumber,
        IReadOnlyList<Guid> propertyIds,
        CancellationToken cancellationToken)
    {
        if (propertyIds.Count == 0)
            return new Dictionary<Guid, PropertyKeyEntitlement>();

        var rows = await _keyEntitlements.ListByPropertyIdsAsync(propertyIds, cancellationToken);
        return PoEnfazRevenueRules.FirstEntitlementPerProperty(rows);
    }
}
