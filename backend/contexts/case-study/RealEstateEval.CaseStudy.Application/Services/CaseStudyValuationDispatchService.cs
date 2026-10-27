using Microsoft.Extensions.Logging;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Opens the valuation request when the appraisal task is spawned. The report number is no
/// longer reserved here: it is PRV-… derived from the transaction's
/// official reference, stamped on the appraisal package when that reference is confirmed.
/// One valuation per transaction (phase 5) whatever the order: since 2026-10-20 a transaction
/// may be merged before distribution, so a folded deed distributed later folds into the
/// holder's request, and the holder's request, once opened, gathers its siblings.
/// </summary>
public sealed class CaseStudyValuationDispatchService : ICaseStudyValuationDispatchService
{
    private readonly ICaseStudyValuationDispatchRepository _db;
    private readonly IValuationRequestService _valuationRequests;
    private readonly IPropertyTimelineService _timeline;
    private readonly ILogger<CaseStudyValuationDispatchService> _logger;
    private readonly IValuationRequestFolding? _folding;
    private readonly TimeProvider _time;

    public CaseStudyValuationDispatchService(
        ICaseStudyValuationDispatchRepository db,
        IValuationRequestService valuationRequests,
        IPropertyTimelineService timeline,
        ILogger<CaseStudyValuationDispatchService> logger,
        TimeProvider? time = null,
        IValuationRequestFolding? folding = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _valuationRequests = valuationRequests;
        _timeline = timeline;
        _logger = logger;
        _folding = folding;
    }

    /// <summary>
    /// Folds the transaction's requests onto the holder's: a sibling deed's own request (or one
    /// folded before the holder had any) points at the holder's open request. Idempotent.
    /// </summary>
    /// <remarks>
    /// How it works: for the holder deed it folds every sibling; for a folded deed it folds only that
    /// deed; the call goes to IValuationRequestFolding.FoldAsync with the holder deed id.
    /// Edge cases: no folding port or no sibling (an ordinary single-deed property) → no-op; a
    /// failure is logged, never thrown, so the request creation still stands (cancellation is
    /// rethrown). When the holder has no request yet the rows fold with a null target, and the
    /// holder's own dispatch later re-points them (fix 2026-10-21, merge before distribution).
    /// </remarks>
    private async Task FoldTransactionAsync(
        Guid propertyId,
        Guid holderPropertyId,
        IReadOnlyList<Guid> siblingIds,
        CancellationToken cancellationToken)
    {
        if (_folding is null || siblingIds.Count == 0) return;
        var folded = propertyId == holderPropertyId
            ? siblingIds.ToList()
            : [propertyId];
        try
        {
            await _folding.FoldAsync(
                new FoldValuationRequestsRequest { PropertyIds = folded, HolderPropertyId = holderPropertyId },
                cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "CaseStudyValuationDispatch: folding the transaction of {PropertyId} failed", propertyId);
        }
    }

    public async Task TryCreateWhenAppraisalSpawnedAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await CreateWhenAppraisalSpawnedCoreAsync(parentTaskId, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "CaseStudyValuationDispatch: failed for task {TaskId} — preview/ensure will retry",
                parentTaskId);
        }
    }

    /// <summary>Opens the deed's valuation request once its appraisal task exists, folded per transaction.</summary>
    /// <remarks>
    /// How it works: 1) reads the parent task's property, stops when there is none or no appraisal
    /// child; 2) reads the holder deed and the siblings of the deed's transaction; 3) a folded deed
    /// first re-points any request it already has; 4) when an open request already answers for the
    /// deed (its own, or the holder's through MergedIntoRequestId) it stops — the holder gathers its
    /// siblings first; 5) otherwise creates the request (area = city, else district), folds (holder:
    /// gathers siblings; folded deed: joins the holder's) and writes «فتح مسار التقييم» on the timeline.
    /// Edge cases: since 2026-10-20 a merge may come before distribution, so either deed can be
    /// distributed first — a folded deed distributed after the merge used to open its own valuation;
    /// fixed 2026-10-21 by steps 3–5, giving one request whatever the order. A create refused by the
    /// valuation service is logged and skipped. The report number is no longer reserved here
    /// (2026-10-19): PRV is derived from the PR reference when it is confirmed.
    /// </remarks>
    private async Task CreateWhenAppraisalSpawnedCoreAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken)
    {
        var parent = await _db.GetTaskAsync(parentTaskId, cancellationToken);
        if (parent?.PropertyId is not Guid propertyId)
        {
            _logger.LogInformation(
                "CaseStudyValuationDispatch: task {TaskId} has no linked property",
                parentTaskId);
            return;
        }

        var hasAppraisalChild = await _db.HasAppraisalChildAsync(parentTaskId, cancellationToken);
        if (!hasAppraisalChild)
        {
            _logger.LogInformation(
                "CaseStudyValuationDispatch: task {TaskId} has no valuation path",
                parentTaskId);
            return;
        }

        var propertyKey = propertyId.ToString("D");
        var appraisalTask = await _db.GetLatestAppraisalChildAsync(parentTaskId, cancellationToken);
        var (holderPropertyId, siblingIds) = await _db.GetTransactionDeedsAsync(propertyId, cancellationToken);

        // A folded deed first re-points any request it already has (folded before the holder had one).
        if (propertyId != holderPropertyId)
            await FoldTransactionAsync(propertyId, holderPropertyId, siblingIds, cancellationToken);

        var alreadyOpen = await _valuationRequests.GetOpenByPropertyAsync(propertyKey, cancellationToken);
        if (alreadyOpen is not null)
        {
            _logger.LogInformation(
                "CaseStudyValuationDispatch: open valuation request already exists for property {PropertyId}",
                propertyId);
            if (propertyId == holderPropertyId)
                await FoldTransactionAsync(propertyId, holderPropertyId, siblingIds, cancellationToken);
            return;
        }

        var property = await _db.GetPropertyAsync(propertyId, cancellationToken);

        var area = ResolveArea(property);
        var type = string.IsNullOrWhiteSpace(property?.PropertyType)
            ? "—"
            : property.PropertyType.Trim();
        var appraiser = string.IsNullOrWhiteSpace(appraisalTask?.AssigneeName)
            ? "—"
            : appraisalTask.AssigneeName.Trim();

        var (created, error) = await _valuationRequests.CreateAsync(
            new SaveValuationRequestRequest
            {
                PropId = propertyKey,
                Area = area,
                Type = type,
                Appraiser = appraiser,
                Status = ValuationRequestStatuses.Progress,
                Date = RiyadhClock.Today(_time).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture),
            },
            cancellationToken);

        if (created is null)
        {
            _logger.LogInformation(
                "CaseStudyValuationDispatch: skipped for property {PropertyId} ({Error})",
                propertyId,
                error);
            return;
        }

        _logger.LogInformation(
            "CaseStudyValuationDispatch: created {DisplayId} for property {PropertyId} from task {TaskId}",
            created.DisplayId,
            propertyId,
            parentTaskId);

        // Holder: gather the siblings' requests; folded deed: its new request joins the holder's.
        await FoldTransactionAsync(propertyId, holderPropertyId, siblingIds, cancellationToken);

        await _timeline.RecordAsync(
            parent.PoNumber,
            propertyId,
            $"valuation-request:{created.Id}:created",
            "فتح مسار التقييم",
            appraiser,
            PropertyTimelineTones.Done,
            _time.UtcNow(),
            cancellationToken);
    }

    private static string ResolveArea(WorkOrderProperty? property)
    {
        if (property is null) return "—";
        if (!string.IsNullOrWhiteSpace(property.City))
            return property.City.Trim();
        if (!string.IsNullOrWhiteSpace(property.District))
            return property.District.Trim();
        return "—";
    }
}
