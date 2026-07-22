using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class OperationsTaskServiceTests
{
    [Fact]
    public async Task CreateAsync_writes_system_comment_and_display_id()
    {
        await using var db = CreateDb();
        var service = CreateService(db);

        var (task, error) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "general",
                Title = "مهمة اختبار",
                Scope = "general",
                AssigneeId = "assignee-1",
                AssigneeName = "منفّذ اختبار",
                Priority = "medium",
            },
            "creator-1",
            "منشئ اختبار");

        Assert.Null(error);
        Assert.NotNull(task);
        Assert.StartsWith("T-", task!.DisplayId);
        Assert.Equal("created", task.Status);
        Assert.Contains(task.Comments, c => c.Kind == "update" && c.Text.Contains("إنشاء"));
    }

    [Fact]
    public async Task ReassignAsync_requires_reason()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        var (created, _) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "general",
                Title = "إعادة توجيه",
                Scope = "general",
                AssigneeId = "a1",
                AssigneeName = "أ",
            },
            "creator-1",
            "منشئ");

        var (result, error) = await service.ReassignAsync(
            Guid.Parse(created!.Id),
            new ReassignOperationsTaskRequest
            {
                AssigneeId = "a2",
                AssigneeName = "ب",
                Reason = "   ",
            },
            "creator-1",
            "منشئ",
            "case-specialist");

        Assert.Null(result);
        Assert.Equal("سبب إعادة التوجيه مطلوب", error);
    }

    [Fact]
    public async Task ReassignAsync_updates_assignee_and_logs_comment()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        var (created, _) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "general",
                Title = "إعادة توجيه",
                Scope = "general",
                AssigneeId = "a1",
                AssigneeName = "أحمد",
            },
            "creator-1",
            "منشئ");

        var (result, error) = await service.ReassignAsync(
            Guid.Parse(created!.Id),
            new ReassignOperationsTaskRequest
            {
                AssigneeId = "a2",
                AssigneeName = "سعد",
                Reason = "انشغال المنفّذ السابق",
            },
            "creator-1",
            "منشئ",
            "case-specialist");

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal("a2", result!.AssigneeId);
        Assert.Equal("سعد", result.AssigneeName);
        Assert.Contains(
            result.Comments,
            c => c.Kind == "update" && c.Text.Contains("أُعيد توجيه") && c.Text.Contains("انشغال"));
    }

    [Fact]
    public async Task RemindAsync_appends_reminder_and_comment()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        var (created, _) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "inquiry",
                Title = "تذكير",
                Scope = "general",
                AssigneeId = "a1",
                AssigneeName = "منفّذ",
            },
            "creator-1",
            "منشئ");

        var (result, error) = await service.RemindAsync(
            Guid.Parse(created!.Id),
            auto: false,
            actorName: "منشئ",
            actorRole: "case-specialist");

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.NotEmpty(result!.Reminders);
        Assert.False(result.Reminders[0]!.Auto);
        Assert.Contains(result.Comments, c => c.Kind == "reminder");
    }

    [Fact]
    public async Task PatchAsync_rejects_invalid_status_transition()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        var (created, _) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "general",
                Title = "حالة",
                Scope = "general",
                AssigneeId = "a1",
                AssigneeName = "منفّذ",
            },
            "creator-1",
            "منشئ");

        var (result, error) = await service.PatchAsync(
            Guid.Parse(created!.Id),
            new PatchOperationsTaskRequest { Status = "completed" },
            "a1",
            "منفّذ",
            "government-reviewer",
            "user-a1");

        Assert.Null(result);
        Assert.NotNull(error);
    }

    [Fact]
    public void ReminderCalculator_high_advances_within_workday_riyadh()
    {
        // 07:15 UTC = 10:15 Asia/Riyadh (UTC+3) Monday → next work hour 11:00 Riyadh = 08:00 UTC
        var from = new DateTime(2026, 7, 20, 7, 15, 0, DateTimeKind.Utc);
        var next = OperationsTaskReminderCalculator.NextReminderUtc("high", from);
        Assert.Equal(new DateTime(2026, 7, 20, 8, 0, 0, DateTimeKind.Utc), next);
    }

    [Fact]
    public void ReminderCalculator_medium_uses_noon_or_end_riyadh()
    {
        // 06:00 UTC = 09:00 Riyadh → noon checkpoint 12:00 Riyadh = 09:00 UTC
        var morning = new DateTime(2026, 7, 20, 6, 0, 0, DateTimeKind.Utc);
        var noon = OperationsTaskReminderCalculator.NextReminderUtc("medium", morning);
        Assert.Equal(new DateTime(2026, 7, 20, 9, 0, 0, DateTimeKind.Utc), noon);

        // 10:00 UTC = 13:00 Riyadh → end of day 17:00 Riyadh = 14:00 UTC
        var afternoon = new DateTime(2026, 7, 20, 10, 0, 0, DateTimeKind.Utc);
        var end = OperationsTaskReminderCalculator.NextReminderUtc("medium", afternoon);
        Assert.Equal(new DateTime(2026, 7, 20, 14, 0, 0, DateTimeKind.Utc), end);
    }

    [Fact]
    public async Task RemindAsync_rejects_non_manager()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        var (created, _) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "inquiry",
                Title = "تذكير",
                Scope = "general",
                AssigneeId = "a1",
                AssigneeName = "منفّذ",
            },
            "creator-1",
            "منشئ");

        var (result, error) = await service.RemindAsync(
            Guid.Parse(created!.Id),
            auto: false,
            actorName: "منفّذ",
            actorRole: "government-reviewer");

        Assert.Null(result);
        Assert.Equal("التذكير للمنشئ أو المشرف فقط", error);
    }

    [Fact]
    public async Task PatchAsync_complete_court_visit_requires_outcome()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        var (created, _) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "court_visit",
                Title = "زيارة محكمة",
                Scope = "work_order",
                PoNumber = "PO-1",
                AssigneeId = "a1",
                AssigneeName = "مراجع",
                LetterRows =
                [
                    new OperationsTaskLetterRowDto
                    {
                        Po = "PO-1",
                        Deed = "D-1",
                        Owner = "مالك",
                        Request = "REQ-1",
                        Court = "محكمة",
                        Circuit = "دائرة",
                    },
                ],
            },
            "creator-1",
            "منشئ");

        await service.PatchAsync(
            Guid.Parse(created!.Id),
            new PatchOperationsTaskRequest { Status = "in_progress" },
            "a1",
            "مراجع",
            "government-reviewer",
            "user-1");

        var (failed, error) = await service.PatchAsync(
            Guid.Parse(created.Id),
            new PatchOperationsTaskRequest { Status = "completed" },
            "a1",
            "مراجع",
            "government-reviewer",
            "user-1");

        Assert.Null(failed);
        Assert.Equal("نتيجة زيارة المحكمة مطلوبة عند إغلاق مهمة زيارة محكمة", error);
    }

    [Fact]
    public async Task PatchAsync_complete_court_visit_persists_outcome()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        var (created, _) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "court_visit",
                Title = "زيارة محكمة",
                Scope = "work_order",
                PoNumber = "PO-1",
                AssigneeId = "a1",
                AssigneeName = "مراجع",
                LetterRows =
                [
                    new OperationsTaskLetterRowDto
                    {
                        Po = "PO-1",
                        Deed = "D-1",
                        Owner = "مالك",
                        Request = "REQ-1",
                        Court = "محكمة",
                        Circuit = "دائرة",
                    },
                ],
            },
            "creator-1",
            "منشئ");

        await service.PatchAsync(
            Guid.Parse(created!.Id),
            new PatchOperationsTaskRequest { Status = "in_progress" },
            "a1",
            "مراجع",
            "government-reviewer",
            "user-1");

        var (done, error) = await service.PatchAsync(
            Guid.Parse(created.Id),
            new PatchOperationsTaskRequest
            {
                Status = "completed",
                CourtVisitResult = new OperationsTaskCourtVisitResultDto
                {
                    Kind = "received",
                    Statement = "استُلم الظرف من الدائرة",
                },
            },
            "a1",
            "مراجع",
            "government-reviewer",
            "user-1");

        Assert.Null(error);
        Assert.NotNull(done);
        Assert.Equal("completed", done!.Status);
        Assert.NotNull(done.CourtVisitResult);
        Assert.Equal("received", done.CourtVisitResult!.Kind);
        Assert.Equal("استُلم الظرف من الدائرة", done.CourtVisitResult.Statement);
        Assert.Contains(
            done.Comments,
            c => c.Text.Contains("استُلم ظرف مفاتيح", StringComparison.Ordinal));
    }

    private static ApplicationDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"ops-tasks-{Guid.NewGuid():N}")
            .ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private static OperationsTaskService CreateService(ApplicationDbContext db) =>
        new(db, new NullNotificationService());

    private sealed class NullNotificationService : INotificationService
    {
        public Task<IReadOnlyList<UserNotificationDto>> ListForUserAsync(
            string userId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<UserNotificationDto>>([]);

        public Task<UserNotificationDto> CreateForUserAsync(
            string userId,
            CreateUserNotificationRequest request,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new UserNotificationDto { Title = request.Title });

        public Task<int> CreateForUsersAsync(
            IReadOnlyCollection<string> userIds,
            CreateUserNotificationRequest request,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(0);

        public Task<bool> MarkReadAsync(
            string userId,
            Guid id,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task MarkAllReadAsync(string userId, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task<bool> DeleteAsync(
            string userId,
            Guid id,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task ClearForUserAsync(string userId, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}
