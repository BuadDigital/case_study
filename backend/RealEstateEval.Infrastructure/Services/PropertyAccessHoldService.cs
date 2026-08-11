using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Creates suspension/failure rows without wiring Case Study's full FailureService: case-study
/// tables on <see cref="CaseStudyDbContext"/>, <c>PropertyFailures</c> on
/// <see cref="FailuresDbContext"/>. Identity labels resolve person names.
/// </summary>
public sealed class PropertyAccessHoldService : IPropertyAccessHoldService
{
    private const string EvictionProblemTypeId = "access-denied";
    private const string KeyUnmatchedProblemTypeId = "key-wont-open";

    private readonly CaseStudyDbContext _cs;
    private readonly FailuresDbContext _failures;
    private readonly IdentityDbContext _identity;
    private readonly INotificationService _notifications;
    private readonly NotificationRecipientResolver _recipients;

    public PropertyAccessHoldService(
        CaseStudyDbContext cs,
        FailuresDbContext failures,
        IdentityDbContext identity,
        INotificationService notifications,
        NotificationRecipientResolver recipients)
    {
        _cs = cs;
        _failures = failures;
        _identity = identity;
        _notifications = notifications;
        _recipients = recipients;
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
                existing.TryForceSuspend(
                    "عُلّقت الدراسة تلقائياً بسبب تسجيل محظر إخلاء.",
                    now);
                existing.RefreshOpenHold(
                    EvictionProblemTypeId,
                    "محظر إخلاء — تعليق الدراسة",
                    "عُلّقت الدراسة تلقائياً بسبب تسجيل محظر إخلاء.",
                    now);
                await _failures.SaveChangesAsync(cancellationToken);
            }

            await BlockCaseStudyTaskAsync(po, propertyKey, existing.Title, cancellationToken);
            return;
        }

        var specialist = await PersonLabelResolver.ResolveAsync(
            _identity,
            string.IsNullOrWhiteSpace(actorName)
                ? DocumentaryWorkflowRules.SystemRaiserRole
                : actorName,
            cancellationToken);
        _failures.PropertyFailures.Add(PropertyFailure.Reconstitute(
            Guid.NewGuid(),
            po,
            propertyKey,
            property.DeedNumber,
            "محظر إخلاء — تعليق الدراسة",
            EvictionProblemTypeId,
            "internal",
            DocumentaryWorkflowRules.SystemRaiserRole,
            "تسجيل محظر إخلاء من وحدة الظروف/مسار الدخول.",
            "عُلّقت الدراسة تلقائياً بسبب تسجيل محظر إخلاء.",
            PropertyFailureStatus.Suspended,
            specialist,
            now,
            now,
            suspendedAtUtc: now));
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
            failure.TrySystemResolve(
                "رفع محظر الإخلاء من وحدة الظروف",
                "أُزيل محظر الإخلاء — استئناف مسار الدراسة.",
                now,
                finalNoteIfEmpty: $"رُفع التعليق بواسطة {actor}.");
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
        var specialist = await PersonLabelResolver.ResolveAsync(
            _identity,
            string.IsNullOrWhiteSpace(actorName)
                ? DocumentaryWorkflowRules.SystemRaiserRole
                : actorName,
            cancellationToken);
        _failures.PropertyFailures.Add(PropertyFailure.Create(
            Guid.NewGuid(),
            po,
            propertyKey,
            string.IsNullOrWhiteSpace(deedNumber) ? property.DeedNumber : deedNumber,
            "مفتاح العقار غير مطابق",
            KeyUnmatchedProblemTypeId,
            "internal",
            DocumentaryWorkflowRules.SystemRaiserRole,
            "تأكيد ميداني: المفتاح غير مطابق للصك.",
            specialist,
            now));
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
        await NotifySpecialistAsync(
            task.Id,
            task.AssigneeId,
            "تعليق دراسة الحالة",
            reason,
            "warn",
            $"case-study-blocked:{task.Id}",
            cancellationToken);
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
        await NotifySpecialistAsync(
            task.Id,
            task.AssigneeId,
            "استئناف دراسة الحالة",
            "زال سبب التعليق — استؤنفت المعاملة.",
            "success",
            $"case-study-unblocked:{task.Id}",
            cancellationToken);
    }

    private async Task NotifySpecialistAsync(
        Guid taskId,
        string? assigneeId,
        string title,
        string body,
        string tone,
        string sourceEvent,
        CancellationToken cancellationToken)
    {
        var trimmedAssigneeId = assigneeId?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedAssigneeId)) return;

        var userId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(
            trimmedAssigneeId,
            cancellationToken);
        if (string.IsNullOrWhiteSpace(userId)) return;

        await _notifications.CreateForUserAsync(
            userId,
            new CreateUserNotificationRequest
            {
                Title = title,
                Body = body,
                Tone = tone,
                Href = $"/case-study/{Uri.EscapeDataString(taskId.ToString())}",
                Category = "workflow",
                EntityType = "task",
                EntityId = taskId.ToString(),
                SourceEvent = sourceEvent,
            },
            cancellationToken);
    }
}
