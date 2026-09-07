using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Application.Rules;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Application.Tests;

public class OperationsTaskCommandRulesTests
{
    private static readonly DateTime Now = new(2026, 9, 1, 8, 30, 0, DateTimeKind.Utc);

    [Fact]
    public void SystemComment_StampsSystemAuthorRoundtripTimeAndKind()
    {
        var comment = OperationsTaskCommandRules.SystemComment("نص", Now);

        Assert.Equal("system", comment.Who);
        Assert.Equal(Now.ToString("O"), comment.At);
        Assert.Equal("نص", comment.Text);
        Assert.Equal("update", comment.Kind);
        Assert.Empty(comment.Files);

        Assert.Equal("reminder", OperationsTaskCommandRules.SystemComment("x", Now, kind: "reminder").Kind);
    }

    [Fact]
    public void NormalizeDeeds_TrimsDropsBlanksAndDedupesOrdinal()
    {
        var deeds = OperationsTaskCommandRules.NormalizeDeeds([" 100 ", "", "100", "  ", "200", "abc", "ABC"]);

        Assert.Equal(new[] { "100", "200", "abc", "ABC" }, deeds);
        Assert.Empty(OperationsTaskCommandRules.NormalizeDeeds(null));
    }

    [Fact]
    public void ScheduleChangeText_JoinsChangedPartsWithWaw()
    {
        var due = new DateTime(2026, 9, 3, 14, 0, 0, DateTimeKind.Utc);

        Assert.Equal(
            "⚑ تحديث: الأولوية إلى «عالية».",
            OperationsTaskCommandRules.ScheduleChangeText(
                OperationsTaskPriority.High, due, priorityChanged: true, dueChanged: false));
        Assert.Equal(
            "⚑ تحديث: موعد الاستحقاق إلى 2026-09-03 14:00 UTC.",
            OperationsTaskCommandRules.ScheduleChangeText(
                OperationsTaskPriority.High, due, priorityChanged: false, dueChanged: true));
        Assert.Equal(
            "⚑ تحديث: الأولوية إلى «منخفضة» و موعد الاستحقاق إلى 2026-09-03 14:00 UTC.",
            OperationsTaskCommandRules.ScheduleChangeText(
                OperationsTaskPriority.Low, due, priorityChanged: true, dueChanged: true));
    }

    [Fact]
    public void AssigneeLabel_FallsBackToIdWhenNameBlank()
    {
        Assert.Equal("a1", OperationsTaskCommandRules.AssigneeLabel("a1", null));
        Assert.Equal("a1", OperationsTaskCommandRules.AssigneeLabel("a1", "   "));
        Assert.Equal("أحمد", OperationsTaskCommandRules.AssigneeLabel("a1", " أحمد "));
    }

    [Fact]
    public void ReassignText_MentionsDueOnlyWhenItChanged()
    {
        var due = new DateTime(2026, 9, 5, 9, 0, 0, DateTimeKind.Utc);

        Assert.Equal(
            "➤ أُعيد توجيه المهمة من «سعد» إلى «خالد» — السبب: إجازة",
            OperationsTaskCommandRules.ReassignText("سعد", "خالد", "إجازة", null));
        Assert.Equal(
            "➤ أُعيد توجيه المهمة من «سعد» إلى «خالد» — موعد التسليم 2026-09-05 09:00 UTC — السبب: إجازة",
            OperationsTaskCommandRules.ReassignText("سعد", "خالد", "إجازة", due));
    }

    [Fact]
    public void NormalizeCommentFiles_TrimsDefaultsSizeDropsUnnamedAndCapsAtTwenty()
    {
        var files = Enumerable.Range(1, 25)
            .Select(i => new OperationsTaskCommentFileDto
            {
                Name = i == 3 ? "  " : $" f{i}.pdf ",
                Size = i == 1 ? "" : "1 KB",
                AttachmentId = i == 1 ? " att-1 " : "",
                ContentType = i == 1 ? " application/pdf " : null,
            })
            .ToList();

        var normalized = OperationsTaskCommandRules.NormalizeCommentFiles(files);

        Assert.Equal(20, normalized.Count);
        Assert.DoesNotContain(normalized, f => f.Name.Length == 0);
        Assert.Equal("f1.pdf", normalized[0].Name);
        Assert.Equal("—", normalized[0].Size);
        Assert.Equal("att-1", normalized[0].AttachmentId);
        Assert.Equal("application/pdf", normalized[0].ContentType);
        Assert.Equal("1 KB", normalized[1].Size);
        Assert.Null(normalized[1].AttachmentId);
        Assert.Null(normalized[1].ContentType);
        Assert.Empty(OperationsTaskCommandRules.NormalizeCommentFiles(null));
    }

    [Theory]
    [InlineData("case-specialist", "a1", "a1", "creator")]
    [InlineData("section-supervisor", "a1", "zz", "creator")]
    [InlineData("cdo", "a1", "a1", "creator")]
    [InlineData("general-manager", "a1", "a1", "creator")]
    [InlineData("field-inspector", "a1", " a1 ", "assignee")]
    [InlineData("field-inspector", "a1", "a2", "creator")]
    public void CommentAuthor_ManagersAreCreatorOtherwiseAssigneeMatch(
        string role, string entityAssignee, string actor, string expected) =>
        Assert.Equal(expected, OperationsTaskCommandRules.CommentAuthor(role, entityAssignee, actor));

    [Fact]
    public void CommentText_PrefixesActorNameOnlyForNonEmptyText()
    {
        Assert.Equal("", OperationsTaskCommandRules.CommentText("أحمد", ""));
        Assert.Equal("مرحبا", OperationsTaskCommandRules.CommentText(null, "مرحبا"));
        Assert.Equal("مرحبا", OperationsTaskCommandRules.CommentText("", "مرحبا"));
        Assert.Equal("أحمد: مرحبا", OperationsTaskCommandRules.CommentText("أحمد", "مرحبا"));
    }

    [Theory]
    [InlineData("comment", true)]
    [InlineData("close", true)]
    [InlineData("", true)]
    [InlineData("update", false)]
    [InlineData("reminder", false)]
    public void IsHumanCommentKind_OnlyCommentCloseOrBlank(string kind, bool expected) =>
        Assert.Equal(expected, OperationsTaskCommandRules.IsHumanCommentKind(kind));

    [Fact]
    public void ReminderCommentText_DistinguishesAutoFromManual()
    {
        Assert.Equal(
            "⏰ تذكير تلقائي ضمن ساعات العمل (المنفّذ والمنشئ).",
            OperationsTaskCommandRules.ReminderCommentText(auto: true));
        Assert.Equal(
            "🔔 تم إرسال تذكير فوري إلى المنفّذ.",
            OperationsTaskCommandRules.ReminderCommentText(auto: false));
    }

    [Fact]
    public void Numbering_PadsSequenceAndReferencesOnlyCourtVisits()
    {
        Assert.Equal("T-2026-0007", OperationsTaskCommandRules.DisplayId(2026, 7));
        Assert.Equal("T-2026-12345", OperationsTaskCommandRules.DisplayId(2026, 12345));
        Assert.Equal("خ.ت-2026-0007", OperationsTaskCommandRules.Reference(2026, 7, courtVisit: true));
        Assert.Null(OperationsTaskCommandRules.Reference(2026, 7, courtVisit: false));
    }
}
