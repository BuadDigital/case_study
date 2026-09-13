using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// A field the valuation report prints empty goes to the person who supplies it: the assignment
/// specialist on the work order, or the property's field inspector / engineering office. Tasks of
/// any status except cancelled count, so a submitted inspection still has its owner.
/// </summary>
public sealed class FieldGapNotificationService : IFieldGapNotificationService
{
    private readonly IWorkOrderLoader _loader;
    private readonly ITransactionStateRepository _tasks;
    private readonly INotificationRecipientResolver _recipients;
    private readonly INotificationService _notifications;

    public FieldGapNotificationService(
        IWorkOrderLoader loader,
        ITransactionStateRepository tasks,
        INotificationRecipientResolver recipients,
        INotificationService notifications)
    {
        _loader = loader;
        _tasks = tasks;
        _recipients = recipients;
        _notifications = notifications;
    }

    public async Task<(FieldGapSourcesDto? Sources, string? Error)> GetSourcesAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var (order, error) = await LoadAsync(poNumber, propertyId, cancellationToken);
        if (order is null) return (null, error);

        var tasks = await _tasks.ListPropertyTasksAsync(propertyId, cancellationToken);
        var intake = await ResolveAsync(FieldGapNotificationRules.Intake, order, tasks, cancellationToken);
        var inspector = await ResolveAsync(FieldGapNotificationRules.Inspector, order, tasks, cancellationToken);
        var survey = await ResolveAsync(FieldGapNotificationRules.Survey, order, tasks, cancellationToken);
        return (new FieldGapSourcesDto
        {
            Intake = intake.ToDto(),
            Inspector = inspector.ToDto(),
            Survey = survey.ToDto(),
        }, null);
    }

    public async Task<(int NotifiedCount, string RecipientName, string? Error)> NotifyAsync(
        string poNumber,
        Guid propertyId,
        NotifyIntakeFieldGapRequest request,
        string? actorDisplayName,
        CancellationToken cancellationToken)
    {
        var label = (request.FieldLabel ?? "").Trim();
        if (label.Length == 0) return (0, "", "اسم الحقل مطلوب.");

        var source = FieldGapNotificationRules.NormalizeSource(request.Source);
        if (source is null) return (0, "", "مصدر الحقل غير معروف.");

        var (order, error) = await LoadAsync(poNumber, propertyId, cancellationToken);
        if (order is null) return (0, "", error);

        var tasks = await _tasks.ListPropertyTasksAsync(propertyId, cancellationToken);
        var responsible = await ResolveAsync(source, order, tasks, cancellationToken);
        if (responsible.UserId is null)
            return (0, "", FieldGapNotificationRules.NoRecipientsError(source));

        var po = order.PoNumber.Trim();
        var deed = (order.Properties.First(p => p.Id == propertyId).DeedNumber ?? "").Trim();
        var fieldKey = string.IsNullOrWhiteSpace(request.FieldKey)
            ? label
            : request.FieldKey.Trim();
        var actor = string.IsNullOrWhiteSpace(actorDisplayName)
            ? "المقيّم"
            : actorDisplayName.Trim();

        await _notifications.CreateForUserAsync(
            responsible.UserId,
            new CreateUserNotificationRequest
            {
                Title = FieldGapNotificationRules.Title(source),
                Body =
                    $"«{label}» ناقص في تقرير التقييم على الصك {(deed.Length > 0 ? deed : "—")} — أمر العمل {po}. طلب الاستكمال من {actor}.",
                Tone = NotificationContract.Tones.Warn,
                Href = $"/po/{Uri.EscapeDataString(po)}/property/{propertyId:D}",
                Category = NotificationContract.Categories.Workflow,
                EntityType = NotificationContract.EntityTypes.Property,
                EntityId = propertyId.ToString("D"),
                Actor = actor,
                SourceEvent = FieldGapNotificationRules.SourceEvent(source, propertyId, fieldKey),
            },
            cancellationToken);

        return (1, responsible.Name, null);
    }

    private async Task<(WorkOrder? Order, string? Error)> LoadAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var po = (poNumber ?? "").Trim();
        if (po.Length == 0) return (null, "رقم أمر العمل مطلوب.");

        var order = await _loader.LoadAsync(po, cancellationToken, asNoTracking: true);
        if (order is null) return (null, "أمر العمل غير موجود.");

        return order.Properties.Any(p => p.Id == propertyId)
            ? (order, null)
            : (null, "العقار غير موجود على أمر العمل.");
    }

    private async Task<Responsible> ResolveAsync(
        string source,
        WorkOrder order,
        IReadOnlyList<WorkflowTask> tasks,
        CancellationToken cancellationToken)
    {
        var role = FieldGapNotificationRules.RoleLabel(source);
        var kind = FieldGapNotificationRules.TaskKind(source);
        if (kind is not null)
        {
            var task = FieldGapNotificationRules.ResponsibleTask(tasks, kind.Value);
            if (task is null) return new Responsible("", role, null);
            return new Responsible(
                task.AssigneeName.Trim(),
                role,
                await UserForAssigneeAsync(task.AssigneeId, cancellationToken));
        }

        var email = order.AssignmentSpecialistEmail?.Trim() ?? "";
        var specialist = FirstText(order.AssignmentSpecialist, email);
        if (email.Length > 0)
        {
            var userId = await _recipients.ResolveUserIdForEmailAsync(email, cancellationToken);
            if (!string.IsNullOrWhiteSpace(userId)) return new Responsible(specialist, role, userId);
        }

        // Header specialist not linked to a user: the property's case specialist owns the file.
        var parent = FieldGapNotificationRules.ResponsibleTask(tasks, WorkflowTaskKind.CaseStudyProperty);
        var parentUser = await UserForAssigneeAsync(parent?.AssigneeId, cancellationToken);
        return parentUser is not null
            ? new Responsible(FirstText(parent!.AssigneeName, specialist), "أخصائي دراسة الحالة", parentUser)
            : new Responsible(specialist, role, null);
    }

    private async Task<string?> UserForAssigneeAsync(string? assigneeId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(assigneeId)) return null;
        var userId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(
            assigneeId.Trim(),
            cancellationToken);
        return string.IsNullOrWhiteSpace(userId) ? null : userId;
    }

    private static string FirstText(params string?[] values) =>
        values.Select(v => (v ?? "").Trim()).FirstOrDefault(v => v.Length > 0) ?? "";

    private sealed record Responsible(string Name, string RoleLabel, string? UserId)
    {
        public FieldGapResponsibleDto ToDto() => new()
        {
            Name = Name,
            RoleLabel = RoleLabel,
            CanNotify = UserId is not null,
        };
    }
}
