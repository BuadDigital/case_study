using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class CaseStudyValuationDispatchService : ICaseStudyValuationDispatchService
{
    private readonly ApplicationDbContext _db;
    private readonly IValuationRequestService _valuationRequests;
    private readonly IPropertyTimelineService _timeline;
    private readonly ILogger<CaseStudyValuationDispatchService> _logger;

    public CaseStudyValuationDispatchService(
        ApplicationDbContext db,
        IValuationRequestService valuationRequests,
        IPropertyTimelineService timeline,
        ILogger<CaseStudyValuationDispatchService> logger)
    {
        _db = db;
        _valuationRequests = valuationRequests;
        _timeline = timeline;
        _logger = logger;
    }

    public async Task TryCreateFromCaseStudySubmissionAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken = default)
    {
        var parent = await _db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == parentTaskId, cancellationToken);
        if (parent?.PropertyId is not Guid propertyId)
        {
            _logger.LogInformation(
                "CaseStudyValuationDispatch: task {TaskId} has no linked property",
                parentTaskId);
            return;
        }

        var hasAppraisalChild = await _db.WorkflowTasks.AsNoTracking()
            .AnyAsync(
                t => t.ParentTaskId == parentTaskId && t.Kind == "property-appraisal",
                cancellationToken);
        if (!hasAppraisalChild)
        {
            _logger.LogInformation(
                "CaseStudyValuationDispatch: task {TaskId} has no valuation path",
                parentTaskId);
            return;
        }

        var propertyKey = propertyId.ToString();
        var alreadyOpen = await _db.ValuationRequests.AsNoTracking()
            .AnyAsync(
                v => v.PropertyId == propertyKey
                     && v.Status != "done",
                cancellationToken);
        if (alreadyOpen)
        {
            _logger.LogInformation(
                "CaseStudyValuationDispatch: open valuation request already exists for property {PropertyId}",
                propertyId);
            return;
        }

        var property = await _db.WorkOrderProperties.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);

        var appraisalTask = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => t.ParentTaskId == parentTaskId && t.Kind == "property-appraisal")
            .OrderByDescending(t => t.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        var area = ResolveArea(property);
        var type = string.IsNullOrWhiteSpace(property?.PropertyType)
            ? "—"
            : property.PropertyType.Trim();
        var appraiser = string.IsNullOrWhiteSpace(appraisalTask?.AssigneeName)
            ? "—"
            : appraisalTask.AssigneeName.Trim();

        var created = await _valuationRequests.CreateAsync(
            new SaveValuationRequestRequest
            {
                PropId = propertyKey,
                Area = area,
                Type = type,
                Appraiser = appraiser,
                Status = "progress",
                Date = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            },
            cancellationToken);

        _logger.LogInformation(
            "CaseStudyValuationDispatch: created {DisplayId} for property {PropertyId} from task {TaskId}",
            created.DisplayId,
            propertyId,
            parentTaskId);

        await _timeline.RecordAsync(
            parent.PoNumber,
            propertyId,
            $"valuation-request:{created.Id}:created",
            "إرسال طلب التقييم",
            appraiser,
            "done",
            DateTime.UtcNow,
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
