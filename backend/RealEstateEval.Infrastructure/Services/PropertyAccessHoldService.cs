using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Creates suspension/failure rows via shared DbContext so Operations host
/// does not need CaseStudy FailureService wiring.
/// </summary>
public sealed class PropertyAccessHoldService : IPropertyAccessHoldService
{
    private const string EvictionProblemTypeId = "access-denied";
    private const string KeyUnmatchedProblemTypeId = "key-wont-open";

    private readonly ApplicationDbContext _db;

    public PropertyAccessHoldService(ApplicationDbContext db) => _db = db;

    public async Task EnsureEvictionHoldAsync(
        Guid propertyId,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var property = await _db.WorkOrderProperties
            .Include(p => p.WorkOrder)
            .FirstOrDefaultAsync(p => p.Id == propertyId && !p.IsRemoved, cancellationToken);
        if (property is null) return;

        var po = property.WorkOrder?.PoNumber?.Trim() ?? "";
        var propertyKey = property.Id.ToString();
        var now = DateTime.UtcNow;

        var existing = await _db.PropertyFailures
            .Where(f =>
                f.PoNumber == po
                && f.PropertyId == propertyKey
                && f.Status != PropertyFailureStatus.Resolved)
            .OrderByDescending(f => f.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (existing is not null)
        {
            if (existing.Status != PropertyFailureStatus.Suspended)
            {
                existing.Status = PropertyFailureStatus.Suspended;
                existing.ProblemTypeId = EvictionProblemTypeId;
                existing.Title = "محظر إخلاء — تعليق الدراسة";
                existing.FinalNote = "عُلّقت الدراسة تلقائياً بسبب تسجيل محظر إخلاء.";
                existing.UpdatedAtUtc = now;
                await _db.SaveChangesAsync(cancellationToken);
            }

            await BlockCaseStudyTaskAsync(po, propertyKey, existing.Title, cancellationToken);
            return;
        }

        _db.PropertyFailures.Add(new PropertyFailure
        {
            Id = Guid.NewGuid(),
            PoNumber = po,
            PropertyId = propertyKey,
            DeedNumber = property.DeedNumber,
            Title = "محظر إخلاء — تعليق الدراسة",
            ProblemTypeId = EvictionProblemTypeId,
            Severity = "internal",
            RaisedByRole = DocumentaryWorkflowRules.SystemRaiserRole,
            InternalNote = "تسجيل محظر إخلاء من وحدة الظروف/مسار الدخول.",
            FinalNote = "عُلّقت الدراسة تلقائياً بسبب تسجيل محظر إخلاء.",
            Status = PropertyFailureStatus.Suspended,
            Specialist = await PersonLabelResolver.ResolveAsync(
                _db,
                string.IsNullOrWhiteSpace(actorName)
                    ? DocumentaryWorkflowRules.SystemRaiserRole
                    : actorName,
                cancellationToken),
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await _db.SaveChangesAsync(cancellationToken);
        await BlockCaseStudyTaskAsync(po, propertyKey, "محظر إخلاء — تعليق الدراسة", cancellationToken);
    }

    public async Task EnsureKeyUnmatchedFailureAsync(
        Guid propertyId,
        string deedNumber,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var property = await _db.WorkOrderProperties
            .Include(p => p.WorkOrder)
            .FirstOrDefaultAsync(p => p.Id == propertyId && !p.IsRemoved, cancellationToken);
        if (property is null) return;

        var po = property.WorkOrder?.PoNumber?.Trim() ?? "";
        var propertyKey = property.Id.ToString();
        var active = await _db.PropertyFailures
            .AnyAsync(
                f =>
                    f.PoNumber == po
                    && f.PropertyId == propertyKey
                    && f.Status != PropertyFailureStatus.Resolved,
                cancellationToken);
        if (active) return;

        var now = DateTime.UtcNow;
        _db.PropertyFailures.Add(new PropertyFailure
        {
            Id = Guid.NewGuid(),
            PoNumber = po,
            PropertyId = propertyKey,
            DeedNumber = string.IsNullOrWhiteSpace(deedNumber) ? property.DeedNumber : deedNumber,
            Title = "مفتاح العقار غير مطابق",
            ProblemTypeId = KeyUnmatchedProblemTypeId,
            Severity = "internal",
            RaisedByRole = DocumentaryWorkflowRules.SystemRaiserRole,
            InternalNote = "تأكيد ميداني: المفتاح غير مطابق للصك.",
            Status = PropertyFailureStatus.Internal,
            Specialist = await PersonLabelResolver.ResolveAsync(
                _db,
                string.IsNullOrWhiteSpace(actorName)
                    ? DocumentaryWorkflowRules.SystemRaiserRole
                    : actorName,
                cancellationToken),
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await _db.SaveChangesAsync(cancellationToken);
        await BlockCaseStudyTaskAsync(po, propertyKey, "مفتاح العقار غير مطابق", cancellationToken);
    }

    private async Task BlockCaseStudyTaskAsync(
        string poNumber,
        string propertyIdText,
        string reason,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(propertyIdText, out var propertyId)) return;

        var task = await _db.WorkflowTasks
            .FirstOrDefaultAsync(
                t =>
                    t.Kind == "case-study-property"
                    && t.PoNumber == poNumber
                    && t.PropertyId == propertyId
                    && t.Status != WorkflowTaskStatus.Completed
                    && t.Status != WorkflowTaskStatus.Cancelled,
                cancellationToken);
        if (task is null) return;

        if (task.Status != WorkflowTaskStatus.Blocked)
            task.ObstructionPriorPhase = task.Phase;
        task.Phase = "obstruction";
        task.Status = WorkflowTaskStatus.Blocked;
        task.ObstructionReason = reason;
        task.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }
}