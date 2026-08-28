using RealEstateEval.Application.Contracts;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Operations.Application.Rules;

/// <summary>
/// Court-visit result normalization and system comment fan-out for operations tasks.
/// </summary>
public static class OperationsTaskCourtVisitRules
{
    private static readonly HashSet<string> ValidCourtVisitKinds =
    [
        "received", "other_party", "none", "other",
    ];

    public static (OperationsTaskCourtVisitResultDto? Result, string? Error) Normalize(
        OperationsTaskCourtVisitResultDto? raw)
    {
        if (raw is null)
            return (null, "نتيجة زيارة المحكمة مطلوبة عند إغلاق مهمة زيارة محكمة");

        var kind = (raw.Kind ?? "").Trim();
        if (!ValidCourtVisitKinds.Contains(kind))
            return (null, "نتيجة زيارة المحكمة غير مدعومة");

        var other = (raw.Other ?? "").Trim();
        if (kind == "other" && other.Length == 0)
            return (null, "يلزم توضيح النتيجة عند اختيار «أخرى»");

        var statement = NullIfBlank(raw.Statement);
        var perDeed = (raw.PerDeed ?? [])
            .Select(p => new OperationsTaskCourtVisitDeedStatementDto
            {
                Deed = (p.Deed ?? "").Trim(),
                Text = (p.Text ?? "").Trim(),
            })
            .Where(p => p.Deed.Length > 0 && p.Text.Length > 0)
            .ToList();

        var contacts = (raw.Contacts ?? [])
            .Select(c => new OperationsTaskCourtVisitContactDto
            {
                Scope = string.IsNullOrWhiteSpace(c.Scope) ? "property" : c.Scope.Trim(),
                Name = (c.Name ?? "").Trim(),
                Role = NullIfBlank(c.Role),
                Phone = NullIfBlank(c.Phone),
                Note = NullIfBlank(c.Note),
            })
            .Where(c => c.Name.Length > 0 || !string.IsNullOrWhiteSpace(c.Phone))
            .ToList();

        if (kind == "other_party" && contacts.Count == 0)
            return (null, "يلزم إدخال جهة اتصال واحدة على الأقل عندما يكون الظرف عند طرف آخر");

        return (new OperationsTaskCourtVisitResultDto
        {
            Kind = kind,
            Other = kind == "other" ? other : null,
            Statement = statement,
            PerDeed = perDeed,
            Contacts = contacts,
        }, null);
    }

    public static void AppendResultComments(
        List<OperationsTaskCommentDto> comments,
        OperationsTaskCourtVisitResultDto result,
        DateTime now)
    {
        var at = now.ToString("O");
        comments.Add(new OperationsTaskCommentDto
        {
            Who = "system",
            At = at,
            Text = "🏛 موقف المفاتيح لدى المحكمة: " + KindLabel(result),
            Kind = "update",
        });
        if (!string.IsNullOrWhiteSpace(result.Statement))
        {
            comments.Add(new OperationsTaskCommentDto
            {
                Who = "system",
                At = at,
                Text = "📄 إفادة عامة للطلب: " + result.Statement.Trim(),
                Kind = "update",
            });
        }
        foreach (var pd in result.PerDeed)
        {
            comments.Add(new OperationsTaskCommentDto
            {
                Who = "system",
                At = at,
                Text = $"📄 إفادة الصك {pd.Deed}: {pd.Text}",
                Kind = "update",
            });
        }
        foreach (var c in result.Contacts)
        {
            var scopeLabel = c.Scope == "property" ? "العقار" : $"صك {c.Scope}";
            var parts = new List<string> { c.Name };
            if (!string.IsNullOrWhiteSpace(c.Role)) parts.Add(c.Role!);
            if (!string.IsNullOrWhiteSpace(c.Phone)) parts.Add(c.Phone!);
            var note = string.IsNullOrWhiteSpace(c.Note) ? "" : $" ({c.Note})";
            comments.Add(new OperationsTaskCommentDto
            {
                Who = "system",
                At = at,
                Text = $"☎ جهة اتصال [{scopeLabel}]: {string.Join(" — ", parts)}{note}",
                Kind = "update",
            });
        }
    }

    public static string KindLabel(OperationsTaskCourtVisitResultDto result) =>
        result.Kind switch
        {
            "received" => "استُلم ظرف مفاتيح",
            "other_party" => "الظرف عند طرف آخر",
            "none" => "لا توجد مفاتيح مسجلة لدى الدائرة",
            "other" => string.IsNullOrWhiteSpace(result.Other)
                ? "أخرى"
                : "أخرى — " + result.Other.Trim(),
            _ => result.Kind,
        };

    private static string? NullIfBlank(string? value) => Texts.NullIfBlank(value);
}
