using System.Text.Json;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Application.Rules;

namespace RealEstateEval.Operations.Application.Services;

public sealed partial class OperationsTaskCommands
{
    public async Task<(OperationsTaskDto? Result, string? Error)> AddCommentAsync(
        Guid id,
        AddOperationsTaskCommentRequest request,
        string actorAssigneeId,
        string actorRole,
        string? actorName,
        CancellationToken cancellationToken = default)
    {
        var entity = await _repo.FindAsync(id, cancellationToken);
        if (entity is null) return (null, "المهمة غير موجودة");

        var files = OperationsTaskCommandRules.NormalizeCommentFiles(request.Files);

        if (!OperationsTaskLifecycleRules.IsManager(actorRole)
            && entity.AssigneeId != actorAssigneeId.Trim())
        {
            return (null, "التعليق متاح للمنفّذ المكلّف أو المشرف فقط");
        }

        var text = request.Text?.Trim() ?? "";
        if (text.Length == 0 && files.Count == 0)
            return (null, "أضف تعليقاً أو مرفقاً");

        var who = OperationsTaskCommandRules.CommentAuthor(actorRole, entity.AssigneeId, actorAssigneeId);

        var comments = OperationsTaskSerialization.DeserializeComments(entity.CommentsJson).ToList();
        comments.Add(new OperationsTaskCommentDto
        {
            Who = who,
            At = _time.GetUtcNow().UtcDateTime.ToString("O"),
            Text = OperationsTaskCommandRules.CommentText(actorName, text),
            Kind = request.Kind?.Trim() ?? "comment",
            Files = files,
        });

        entity.ReplaceComments(
            JsonSerializer.Serialize(comments, OperationsTaskSerialization.JsonOpts),
            _time.GetUtcNow().UtcDateTime);
        await _repo.SaveChangesAsync(cancellationToken);

        var kind = request.Kind?.Trim() ?? "comment";
 // Human thread only — system updates / reminders are not counterparty chatter.
        if (OperationsTaskCommandRules.IsHumanCommentKind(kind))
        {
            await _notifier.NotifyCounterpartyOnCommentAsync(
                entity,
                who,
                actorName,
                text,
                cancellationToken);
        }

        return (await _query.MapAsync(entity, cancellationToken), null);
    }
}
