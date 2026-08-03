using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Creates suspension/failure rows without wiring Case Study's full FailureService: case-study
/// tables on the legacy context, <c>PropertyFailures</c> on <see cref="FailuresDbContext"/>.
/// </summary>
public sealed class PropertyAccessHoldService : IPropertyAccessHoldService
{
    private const string EvictionProblemTypeId = "access-denied";
    private const string KeyUnmatchedProblemTypeId = "key-wont-open";

    private readonly ApplicationDbContext _cs;
    private readonly FailuresDbContext _failures;

    public PropertyAccessHoldService(ApplicationDbContext cs, FailuresDbContext failures)
    {
        _cs = cs;
        _failures = failures;
    }

    public async Task EnsureEvictionHoldAsync(
        Guid propertyId,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var property = await _cs.WorkOrderProperties
            .Include(p => p.WorkOrder)
            .FirstOrDefaultAsync(p => p.Id == propertyId && !p.IsRemoved, cancellationToken);
        if (property is null) return;

        var po = property.WorkOrder?.PoNumber?.Trim() ?? "";
        var propertyKey = property.Id.ToString();
        var now = DateTime.UtcNow;

        var existing = await _failures.PropertyFailures
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
                await _failures.SaveChangesAsync(cancellationToken);
            }

            await BlockCaseStudyTaskAsync(po, propertyKey, existing.Title, cancellationToken);
            return;
        }

        _failures.PropertyFailures.Add(new PropertyFailure
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
                _cs,
                string.IsNullOrWhiteSpace(actorName)
                    ? DocumentaryWorkflowRules.SystemRaiserRole
                    : actorName,
                cancellationToken),
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await _failures.SaveChangesAsync(cancellationToken);
        await BlockCaseStudyTaskAsync(po, propertyKey, "محظر إخلاء — تعليق الدراسة", cancellationToken);
    }

    public async Task ResolveEvictionHoldAsync(
        Guid propertyId,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var property = await _cs.WorkOrderProperties
            .Include(p => p.WorkOrder)
            .FirstOrDefaultAsync(p => p.Id == propertyId && !p.IsRemoved, cancellationToken);
        if (property is null) return;

        var po = property.WorkOrder?.PoNumber?.Trim() ?? "";
        var propertyKey = property.Id.ToString();
        var now = DateTime.UtcNow;

        var active = await _failures.PropertyFailures
            .Where(f =>
                f.PoNumber == po
                && f.PropertyId == propertyKey
                && f.ProblemTypeId == EvictionProblemTypeId
                && f.Status != PropertyFailureStatus.Resolved
                && f.Status != PropertyFailureStatus.Approved)
            .ToListAsync(cancellationToken);

        if (active.Count == 0)
        {
            await UnblockCaseStudyTaskAsync(po, propertyKey, cancellationToken);
            return;
        }

        var actor = string.IsNullOrWhiteSpace(actorName)
            ? DocumentaryWorkflowRules.SystemRaiserRole
            : actorName.Trim();

        foreach (var failure in active)
        {
            failure.Status = PropertyFailureStatus.Resolved;
            failure.ResolutionReason = "رفع محظر الإخلاء من وحدة الظروف";
            failure.ContinueInstructions = "أُزيل محظر الإخلاء — استئناف مسار الدراسة.";
            failure.FinalNote = string.IsNullOrWhiteSpace(failure.FinalNote)
                ? $"رُفع التعليق بواسطة {actor}."
                : failure.FinalNote;
            failure.UpdatedAtUtc = now;
        }

        await _failures.SaveChangesAsync(cancellationToken);
        await UnblockCaseStudyTaskAsync(po, propertyKey, cancellationToken);
    }

    public async Task EnsureKeyUnmatchedFailureAsync(
        Guid propertyId,
        string deedNumber,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var property = await _cs.WorkOrderProperties
            .Include(p => p.WorkOrder)
            .FirstOrDefaultAsync(p => p.Id == propertyId && !p.IsRemoved, cancellationToken);
        if (property is null) return;

        var po = property.WorkOrder?.PoNumber?.Trim() ?? "";
        var propertyKey = property.Id.ToString();
        var active = await _failures.PropertyFailures
            .AnyAsync(
                f =>
                    f.PoNumber == po
                    && f.PropertyId == propertyKey
                    && f.Status != PropertyFailureStatus.Resolved,
                cancellationToken);
        if (active) return;

        var now = DateTime.UtcNow;
        _failures.PropertyFailures.Add(new PropertyFailure
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
                _cs,
                string.IsNullOrWhiteSpace(actorName)
                    ? DocumentaryWorkflowRules.SystemRaiserRole
                    : actorName,
                cancellationToken),
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await _failures.SaveChangesAsync(cancellationToken);
        await BlockCaseStudyTaskAsync(po, propertyKey, "مفتاح العقار غير مطابق", cancellationToken);
    }

    private async Task BlockCaseStudyTaskAsync(
        string poNumber,
        string propertyIdText,
        string reason,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(propertyIdText, out var propertyId)) return;

        var task = await _cs.WorkflowTasks
            .FirstOrDefaultAsync(
                t =>
                    t.Kind == WorkflowTaskKind.CaseStudyProperty
                    && t.PoNumber == poNumber
                    && t.PropertyId == propertyId
                    && t.Status != WorkflowTaskStatus.Completed
                    && t.Status != WorkflowTaskStatus.Cancelled,
                cancellationToken);
        if (task is null) return;

        task.Block(reason, DateTime.UtcNow);
        await _cs.SaveChangesAsync(cancellationToken);
    }

    private async Task UnblockCaseStudyTaskAsync(
        string poNumber,
        string propertyIdText,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(propertyIdText, out var propertyId)) return;

        var task = await _cs.WorkflowTasks
            .FirstOrDefaultAsync(
                t =>
                    t.Kind == WorkflowTaskKind.CaseStudyProperty
                    && t.PoNumber == poNumber
                    && t.PropertyId == propertyId
                    && t.Status == WorkflowTaskStatus.Blocked
                    && t.Phase == WorkflowTaskPhase.Obstruction,
                cancellationToken);
        if (task is null) return;

        // The property is linked here, so a row with no remembered phase resumes at bourse.
        task.Unblock(DateTime.UtcNow, WorkflowTaskPhase.Bourse);
        await _cs.SaveChangesAsync(cancellationToken);
    }
}
