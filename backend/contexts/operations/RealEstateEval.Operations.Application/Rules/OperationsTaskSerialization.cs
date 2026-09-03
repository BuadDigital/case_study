using RealEstateEval.Application.Rules;
using System.Globalization;
using System.Text.Json;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Rules;

/// <summary>Shared JSON options and DTO mapping for operations tasks.</summary>
public static class OperationsTaskSerialization
{
    public static readonly JsonSerializerOptions JsonOpts = JsonDefaults.CamelCaseInsensitive;

    public static string FormatDueLabel(DateTime dueAtUtc) =>
        dueAtUtc.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture) + " UTC";

    public static string? NullIfBlank(string? value)
    {
        var t = value?.Trim() ?? "";
        return t.Length == 0 ? null : t;
    }

    public static IReadOnlyList<string> DeserializeStrings(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, JsonOpts) ?? [];
        }
        catch
        {
            return [];
        }
    }

    public static IReadOnlyList<OperationsTaskLetterRowDto> DeserializeLetterRows(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<OperationsTaskLetterRowDto>>(json, JsonOpts) ?? [];
        }
        catch
        {
            return [];
        }
    }

    public static IReadOnlyList<OperationsTaskCommentDto> DeserializeComments(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<OperationsTaskCommentDto>>(json, JsonOpts) ?? [];
        }
        catch
        {
            return [];
        }
    }

    public static IReadOnlyList<OperationsTaskReminderDto> DeserializeReminders(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<OperationsTaskReminderDto>>(json, JsonOpts) ?? [];
        }
        catch
        {
            return [];
        }
    }

    public static OperationsTaskCourtVisitResultDto? DeserializeCourtVisitResult(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<OperationsTaskCourtVisitResultDto>(json, JsonOpts);
        }
        catch
        {
            return null;
        }
    }

    public static OperationsTaskDto Map(
        OperationsTask row,
        Guid? linkedEnvelopeId = null,
        decimal? visitFeeAmountSar = null,
        IReadOnlyDictionary<string, string>? peopleNames = null)
    {
        var names = peopleNames
            ?? (IReadOnlyDictionary<string, string>)
                new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        return new()
        {
            Id = row.Id.ToString(),
            DisplayId = row.DisplayId,
            Type = row.Type.ToDbValue(),
            Title = row.Title,
            Description = row.Description,
            Scope = row.Scope.ToDbValue(),
            Deeds = DeserializeStrings(row.DeedsJson),
            PoNumber = row.PoNumber,
            AssigneeId = row.AssigneeId,
            AssigneeName = PersonLabelResolver.ResolveDisplayLabel(
                row.AssigneeName, null, names),
            CreatedBy = row.CreatedBy,
            CreatedByName = PersonLabelResolver.ResolveDisplayLabel(
                row.CreatedByName, row.CreatedBy, names),
            Status = row.Status.ToDbValue(),
            PrevStatus = row.PrevStatus.ToDbValue(),
            Priority = row.Priority.ToDbValue(),
            DueAt = row.DueAtUtc.ToString("O"),
            CreatedAt = row.CreatedAtUtc.ToString("O"),
            UpdatedAt = row.UpdatedAtUtc.ToString("O"),
            Reference = row.Reference,
            LetterRows = DeserializeLetterRows(row.LetterRowsJson),
            Comments = DeserializeComments(row.CommentsJson),
            Reminders = DeserializeReminders(row.RemindersJson),
            CourtVisitResult = DeserializeCourtVisitResult(row.CourtVisitResultJson),
            PauseReason = row.PauseReason,
            PausedAt = row.PausedAtUtc?.ToString("O"),
            OriginalAssigneeId = row.OriginalAssigneeId,
            OriginalAssigneeName = PersonLabelResolver.ResolveDisplayLabel(
                row.OriginalAssigneeName, null, names),
            CreditAssigneeId = row.CreditAssigneeId,
            CreditAssigneeName = PersonLabelResolver.ResolveDisplayLabel(
                row.CreditAssigneeName, null, names),
            ReceiptConfirmedAt = row.ReceiptConfirmedAtUtc?.ToString("O"),
            CancelReason = row.CancelReason,
            LinkedEnvelopeId = linkedEnvelopeId?.ToString(),
            VisitFeeAmountSar = visitFeeAmountSar ?? row.AgreedVisitFeeSar,
        };
    }

    public static DateTime ResolveLastReminderAnchorUtc(OperationsTask entity)
    {
        var reminders = DeserializeReminders(entity.RemindersJson);
        if (reminders.Count == 0) return entity.CreatedAtUtc;

        var lastAt = reminders[^1].At;
        if (!DateTime.TryParse(
                lastAt,
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind,
                out var parsed))
            return entity.CreatedAtUtc;

        return parsed.Kind switch
        {
            DateTimeKind.Utc => parsed,
            DateTimeKind.Local => parsed.ToUniversalTime(),
            _ => DateTime.SpecifyKind(parsed, DateTimeKind.Utc),
        };
    }
}
