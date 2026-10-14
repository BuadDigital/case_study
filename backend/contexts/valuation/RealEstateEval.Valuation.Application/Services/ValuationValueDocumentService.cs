using RealEstateEval.Application;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Services;

/// <summary>
/// The appraiser alone decides what each «مستند ذو قيمة» does to the valuation — no effect, an
/// approach indicator (enters reconciliation), or an amount added after the liquidation
/// discount — even before the case specialist approves it; issuance then requires approval.
/// </summary>
public sealed class ValuationValueDocumentService(
    IValuationReconciliationRepository repo,
    IValuationReconciliationService reconciliation,
    IValuationReportFreezeGate freeze,
    IValuationValuedDocumentLookup documents,
    TimeProvider? time = null) : IValuationValueDocumentService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public async Task<ValuationValueDocumentsDto?> GetAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null) return null;

        var onProperty = await documents.ListAsync(vr.PropertyId, cancellationToken);
        var uses = await repo.ListValueDocumentUsesAsync(valuationRequestId, tracked: false, cancellationToken);
        var internalKinds = await reconciliation.GetEnabledApproachKindsAsync(valuationRequestId, cancellationToken);
        return ToDto(valuationRequestId, internalKinds, onProperty, uses);
    }

    public async Task<(ValuationValueDocumentsDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid valuationRequestId,
        SaveValuationValueDocumentsRequest request,
        CancellationToken cancellationToken = default)
    {
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });
        if (vr.Status == ValuationRequestStatus.Done)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم مكتمل" });
        var frozenMessage = await freeze.GetFrozenMessageAsync(vr.Id, vr.PropertyId, cancellationToken);
        if (frozenMessage is not null)
            return (null, new Dictionary<string, string> { ["_"] = frozenMessage });

        var onProperty = await documents.ListAsync(vr.PropertyId, cancellationToken);
        var internalKinds = await reconciliation.GetEnabledApproachKindsAsync(valuationRequestId, cancellationToken);
        var inputs = (request.Uses ?? [])
            .Select(u => new ValueDocumentUseInput(u.AttachmentId, u.Effect, u.ApproachKey, u.MethodName, u.Value))
            .ToList();
        var errors = ValueDocumentUseRules.Validate(
            inputs,
            internalKinds,
            onProperty.Select(d => new ValuedDocumentRef(d.AttachmentId, d.LabelAr, d.Status)).ToList());
        if (errors.Count > 0) return (null, errors);

        var labels = onProperty.ToDictionary(d => d.AttachmentId, d => d.LabelAr);
        var existing = (await repo.ListValueDocumentUsesAsync(valuationRequestId, tracked: true, cancellationToken))
            .ToDictionary(u => u.AttachmentId);
        var now = _time.UtcNow();
        var keep = new HashSet<Guid>();
        for (var i = 0; i < inputs.Count; i++)
        {
            var input = inputs[i];
            var effect = input.Effect!.Trim().ToLowerInvariant();
            var indicator = effect == ValueDocumentEffects.Indicator;
            if (!existing.TryGetValue(input.AttachmentId, out var use))
            {
                use = new ValuationValueDocumentUse
                {
                    Id = Guid.NewGuid(),
                    ValuationRequestId = valuationRequestId,
                    AttachmentId = input.AttachmentId,
                };
                await repo.AddValueDocumentUseAsync(use, cancellationToken);
            }

            use.DocumentLabel = Truncate(labels[input.AttachmentId], ValueDocumentUseRules.DocumentLabelMaxLength);
            use.Effect = effect;
            use.ApproachKey = indicator ? input.ApproachKey!.Trim().ToLowerInvariant() : null;
            use.MethodName = indicator ? input.MethodName!.Trim() : null;
            use.Value = input.Value;
            use.SortOrder = i;
            use.UpdatedAtUtc = now;
            keep.Add(input.AttachmentId);
        }

        await repo.RemoveValueDocumentUsesAsync(
            existing.Values.Where(u => !keep.Contains(u.AttachmentId)).ToList(),
            cancellationToken);
        await SyncReconciliationLinesAsync(valuationRequestId, inputs, cancellationToken);
        await repo.SaveChangesAsync(cancellationToken);

        return (await GetAsync(valuationRequestId, cancellationToken), null);
    }

    /// <summary>
    /// Weighting lines follow the documents: a document that is no longer an indicator loses its
    /// line, and a changed indicator value refreshes the snapshot the request list reads.
    /// </summary>
    private async Task SyncReconciliationLinesAsync(
        Guid valuationRequestId,
        IReadOnlyList<ValueDocumentUseInput> inputs,
        CancellationToken cancellationToken)
    {
        var recon = await repo.FindWithMethodsAsync(valuationRequestId, cancellationToken);
        if (recon is null) return;

        var indicatorValues = inputs
            .Where(u => string.Equals(u.Effect?.Trim(), ValueDocumentEffects.Indicator, StringComparison.OrdinalIgnoreCase))
            .ToDictionary(u => ValueDocumentUseRules.ReconciliationKind(u.AttachmentId), u => u.Value, StringComparer.OrdinalIgnoreCase);
        var stale = new List<ValuationReconciliationMethodLine>();
        foreach (var line in recon.Methods.Where(m => ValueDocumentUseRules.IsDocumentKind(m.ApproachKind)))
        {
            if (indicatorValues.TryGetValue(line.ApproachKind, out var value)) line.ApproachValue = value;
            else stale.Add(line);
        }

        await repo.RemoveMethodLinesAsync(stale, cancellationToken);
    }

    private static ValuationValueDocumentsDto ToDto(
        Guid valuationRequestId,
        IReadOnlyList<string> internalKinds,
        IReadOnlyList<ValuedDocumentLookupDto> onProperty,
        IReadOnlyList<ValuationValueDocumentUse> uses)
    {
        var usesByDocument = uses.ToDictionary(u => u.AttachmentId);
        var rows = onProperty
            .Select(d =>
            {
                usesByDocument.TryGetValue(d.AttachmentId, out var use);
                return new ValuationValueDocumentDto
                {
                    AttachmentId = d.AttachmentId,
                    LabelAr = d.LabelAr,
                    FileName = d.FileName,
                    ContentType = d.ContentType,
                    CreatedAtUtc = d.CreatedAtUtc,
                    Status = d.Status,
                    ReviewNote = d.ReviewNote,
                    Effect = use?.Effect,
                    ApproachKey = use?.ApproachKey,
                    MethodName = use?.MethodName,
                    Value = use?.Value,
                };
            })
            .ToList();

        // A used document deleted from the property still shows, so the appraiser can clear it.
        var present = onProperty.Select(d => d.AttachmentId).ToHashSet();
        rows.AddRange(uses
            .Where(u => !present.Contains(u.AttachmentId))
            .Select(u => new ValuationValueDocumentDto
            {
                AttachmentId = u.AttachmentId,
                LabelAr = u.DocumentLabel,
                Status = "",
                Missing = true,
                Effect = u.Effect,
                ApproachKey = u.ApproachKey,
                MethodName = u.MethodName,
                Value = u.Value,
            }));

        return new ValuationValueDocumentsDto
        {
            ValuationRequestId = valuationRequestId,
            InternalApproachKinds = internalKinds,
            Documents = rows,
        };
    }

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..max];
}
