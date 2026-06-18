using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Services;

public static class DynamicScreenDefinitionMapper
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public static DynamicScreenDefinitionDto Empty(string code, string ownerRole = "") =>
        new()
        {
            Code = code,
            OwnerRole = ownerRole,
            Status = "مخططة",
            Fields = [],
            Bindings = [],
        };

    public static DynamicScreenDefinitionDto Parse(CustomAssignedScreen screen)
    {
        if (string.IsNullOrWhiteSpace(screen.DefinitionJson) || screen.DefinitionJson == "{}")
        {
            return Empty(
                string.IsNullOrWhiteSpace(screen.Code) ? "SCR-00" : screen.Code,
                screen.OwnerRole);
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<DynamicScreenDefinitionDto>(
                screen.DefinitionJson,
                JsonOptions);
            if (parsed is null)
                return Empty(screen.Code, screen.OwnerRole);

            return new DynamicScreenDefinitionDto
            {
                Code = string.IsNullOrWhiteSpace(parsed.Code) ? screen.Code : parsed.Code,
                OwnerRole = string.IsNullOrWhiteSpace(parsed.OwnerRole)
                    ? screen.OwnerRole
                    : parsed.OwnerRole,
                Status = ResolveStatus(parsed.Bindings.Count, screen.ScreenStatus),
                Fields = parsed.Fields,
                Bindings = parsed.Bindings,
            };
        }
        catch
        {
            return Empty(screen.Code, screen.OwnerRole);
        }
    }

    public static string Serialize(DynamicScreenDefinitionDto definition) =>
        JsonSerializer.Serialize(definition, JsonOptions);

    public static string ResolveStatus(int bindingCount, string? current = null)
    {
        if (bindingCount > 0)
            return "موجودة";
        return string.IsNullOrWhiteSpace(current) ? "مخططة" : current;
    }

    public static async Task<string> NextScreenCodeAsync(
        IQueryable<CustomAssignedScreen> screens,
        CancellationToken cancellationToken)
    {
        var codes = await screens
            .AsNoTracking()
            .Select(s => s.Code)
            .ToListAsync(cancellationToken);

        var max = 0;
        foreach (var code in codes)
        {
            if (string.IsNullOrWhiteSpace(code))
                continue;
            var numeric = int.TryParse(
                new string(code.Where(char.IsDigit).ToArray()),
                out var n)
                ? n
                : 0;
            if (numeric > max)
                max = numeric;
        }

        return $"SCR-{max + 1:D2}";
    }

    public static DynamicScreenSubmissionDto ToSubmissionDto(CustomScreenSubmission row)
    {
        var answers = new Dictionary<string, object?>();
        try
        {
            if (!string.IsNullOrWhiteSpace(row.AnswersJson))
            {
                var parsed = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(
                    row.AnswersJson,
                    JsonOptions);
                if (parsed is not null)
                {
                    foreach (var (key, value) in parsed)
                        answers[key] = JsonSerializer.Deserialize<object?>(value.GetRawText());
                }
            }
        }
        catch
        {
            /* keep empty */
        }

        return new DynamicScreenSubmissionDto
        {
            Id = row.Id,
            ScreenId = row.ScreenId,
            UserId = row.UserId,
            Answers = answers,
            IsDraft = row.IsDraft,
            UpdatedAtUtc = row.UpdatedAtUtc,
            SubmittedAtUtc = row.SubmittedAtUtc,
        };
    }

    public static string SerializeAnswers(IReadOnlyDictionary<string, object?> answers) =>
        JsonSerializer.Serialize(answers ?? new Dictionary<string, object?>(), JsonOptions);
}
