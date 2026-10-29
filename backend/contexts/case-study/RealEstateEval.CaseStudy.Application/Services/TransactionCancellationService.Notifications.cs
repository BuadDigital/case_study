using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.CaseStudy.Application.Services;

public sealed partial class TransactionCancellationService
{
    private const string SupervisorRole = "section-supervisor";

    /// <summary>The task kinds whose assignees hear that a transaction was cancelled or reactivated.</summary>
    private static readonly WorkflowTaskKind[] TransactionPeopleKinds =
    [
        WorkflowTaskKind.CaseStudyProperty,
        WorkflowTaskKind.FieldInspection,
        WorkflowTaskKind.EngineeringSurvey,
        WorkflowTaskKind.PropertyAppraisal,
        WorkflowTaskKind.GovernmentReview,
    ];

    /// <summary>Everyone holding a live task on the deeds — the case specialists and the parties.</summary>
    /// <remarks>
    /// How it works: unions the resolver's answer per deed. Edge cases: the resolver skips cancelled
    /// tasks, so the approval calls this before cancelling and the reactivation after restoring.
    /// </remarks>
    private async Task<IReadOnlyList<string>> ResolveDeedPeopleAsync(
        IReadOnlyList<WorkOrderProperty> deeds,
        CancellationToken cancellationToken)
    {
        var userIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var deed in deeds)
        {
            try
            {
                userIds.UnionWith(await recipients.ResolveAssigneeUserIdsForPropertyAsync(
                    deed.Id,
                    TransactionPeopleKinds,
                    cancellationToken));
            }
            catch
            {
                // Recipients are best effort: the cancellation itself must not fail on a lookup.
            }
        }
        return userIds.ToList();
    }

    private Task NotifySupervisorsOfRequestAsync(
        TransactionCancellation entity,
        IReadOnlyList<TransactionCancellationDeedDto> deeds,
        CancellationToken cancellationToken) =>
        BestEffortAsync(async () =>
        {
            var supervisors = await recipients.ResolveUserIdsWithPrototypeRoleAsync(SupervisorRole, cancellationToken);
            await NotifyUsersAsync(
                supervisors,
                entity,
                "طلب إلغاء معاملة بانتظار اعتمادك",
                $"طلب {entity.RequestedByName} إلغاء {deeds.Count} صك في أمر العمل {entity.PoNumber}: {TransactionCancellationRules.ReasonLine(entity)}",
                NotificationContract.Tones.Warn,
                "requested",
                cancellationToken,
                deeds.Count > 0 ? deeds[0].PropertyId : null);
        });

    private Task NotifyRequesterAsync(
        TransactionCancellation entity,
        string title,
        string body,
        string tone,
        CancellationToken cancellationToken) =>
        NotifyUsersAsync(
            string.IsNullOrWhiteSpace(entity.RequestedByUserId) ? [] : [entity.RequestedByUserId],
            entity,
            title,
            body,
            tone,
            $"decided-{entity.Status}",
            cancellationToken);

    /// <summary>One notice to each user, pointing at the first deed's page (or the work order).</summary>
    /// <remarks>
    /// How it works: drops blanks and duplicates, builds one request and sends it to all. Edge cases:
    /// best effort — a notification failure never undoes the cancellation; the source event carries the
    /// request id and the step, so each step notifies once.
    /// </remarks>
    private Task NotifyUsersAsync(
        IEnumerable<string> userIds,
        TransactionCancellation entity,
        string title,
        string body,
        string tone,
        string step,
        CancellationToken cancellationToken,
        Guid? propertyId = null) =>
        BestEffortAsync(async () =>
        {
            var to = userIds.Where(u => !string.IsNullOrWhiteSpace(u)).Distinct(StringComparer.Ordinal).ToList();
            if (to.Count == 0) return;

            var firstDeed = propertyId
                ?? TransactionCancellationRules.ParseDeedIds(entity.DeedIdsJson).FirstOrDefault();
            var po = Uri.EscapeDataString(entity.PoNumber);
            await notifications.CreateForUsersAsync(
                to,
                new CreateUserNotificationRequest
                {
                    Title = title,
                    Body = body,
                    Tone = tone,
                    Href = firstDeed == Guid.Empty ? $"/po/{po}/property" : $"/po/{po}/property/{firstDeed:D}",
                    Category = NotificationContract.Categories.Workflow,
                    EntityType = NotificationContract.EntityTypes.WorkOrder,
                    EntityId = entity.PoNumber,
                    SourceEvent = $"transaction-cancellation-{step}:{entity.Id:N}",
                },
                cancellationToken);
        });

    /// <summary>One timeline line on every deed; best effort, keyed so a retry writes it once.</summary>
    private async Task RecordTimelineAsync(
        IReadOnlyList<WorkOrderProperty> deeds,
        string eventKey,
        string title,
        string detail,
        string tone,
        DateTime at,
        CancellationToken cancellationToken)
    {
        foreach (var deed in deeds)
        {
            await BestEffortAsync(() => timeline.RecordAsync(
                deed.WorkOrder?.PoNumber ?? "",
                deed.Id,
                eventKey,
                title,
                detail,
                tone,
                at,
                cancellationToken));
        }
    }

    private Task AppendAuditAsync(
        TransactionCancellationActor actor,
        string action,
        TransactionCancellation entity,
        CancellationToken cancellationToken) =>
        BestEffortAsync(() => auditLog.AppendAsync(
            audit.Create(
                actorId: string.IsNullOrWhiteSpace(actor.UserId) ? "unknown" : actor.UserId.Trim(),
                action: action,
                entityType: "TransactionCancellation",
                entityId: entity.Id.ToString("D"),
                before: null,
                after: new
                {
                    entity.Status,
                    entity.Scope,
                    entity.ScopeRef,
                    entity.PoNumber,
                    entity.ReasonCode,
                    entity.Note,
                    deedIds = TransactionCancellationRules.ParseDeedIds(entity.DeedIdsJson),
                    entity.DecisionNote,
                    entity.ReactivationNote,
                }),
            cancellationToken));

    /// <summary>Runs a side effect after the save; a failure is swallowed because the cancellation already stands.</summary>
    private static async Task BestEffortAsync(Func<Task> action)
    {
        try
        {
            await action();
        }
        catch
        {
            // The cancellation is saved; a side effect that fails is not a reason to report it as failed.
        }
    }
}
