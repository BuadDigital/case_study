using RealEstateEval.Operations.Application.Rules;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;
using RealEstateEval.Platform.Infrastructure.Services;
using RealEstateEval.Operations.Infrastructure.Services;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Identity.Infrastructure.Services;
using RealEstateEval.Financial.Application.Services;
using RealEstateEval.Financial.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Auto reminders repeat on the work-hours cadence, but the activity feed must not fill up with
/// duplicate "task reminder" rows: while the previous reminder notification is still unread, a
/// re-emit refreshes it in place (stable SourceEvent + the unread source-event index probe in
/// NotificationService). A fresh row may only appear after the user read the previous one.
/// </summary>
public sealed class OperationsTaskReminderDedupTests
{
    private const string ReminderTitle = "تذكير بمهمة";
    private const string AssigneeUserId = "user-a";
    private const string CreatorUserId = "creator-1";

 // Sunday 2026-08-09 06:00 UTC = 09:00 Asia/Riyadh — a Saudi workday morning.
    private static readonly DateTimeOffset SundayMorningUtc =
        new(2026, 8, 9, 6, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Auto_reminder_sweeps_refresh_unread_notification_instead_of_duplicating()
    {
        var fixture = await FixtureAsync();

 // Create Sunday 09:00 Riyadh, medium priority → first checkpoint is noon Riyadh (09:00 UTC).
        var task = await fixture.CreateTaskAsync(SundayMorningUtc);

 // 12:05 Riyadh — first checkpoint passed → exactly one reminder emitted.
        fixture.Time.Now = SundayMorningUtc.AddHours(3).AddMinutes(5);
        Assert.Equal(1, await fixture.Commands.ProcessDueAutoRemindersAsync());

 // Sweep again inside the same window (2-minute hosted-service ticks) → nothing re-fires.
        fixture.Time.Now = fixture.Time.Now.AddMinutes(4);
        Assert.Equal(0, await fixture.Commands.ProcessDueAutoRemindersAsync());

 // 17:10 Riyadh — next checkpoint → cadence fires again…
        fixture.Time.Now = SundayMorningUtc.AddHours(8).AddMinutes(10);
        Assert.Equal(1, await fixture.Commands.ProcessDueAutoRemindersAsync());

 // …but the feed still shows one unread reminder per user, not a stack of duplicates.
        var rows = await fixture.ReminderRowsAsync();
        Assert.Equal(2, rows.Count);
        var assigneeRow = Assert.Single(rows, r => r.UserId == AssigneeUserId);
        var creatorRow = Assert.Single(rows, r => r.UserId == CreatorUserId);
        Assert.Equal($"ops-task-remind:{task.Id}:assignee", assigneeRow.SourceEvent);
        Assert.Equal($"ops-task-remind:{task.Id}:creator", creatorRow.SourceEvent);
 // The surviving row was refreshed by the second emit (NotificationService stamps wall
 // clock), so it is not a stale leftover of the first checkpoint.
        Assert.Equal(DateTime.UtcNow, assigneeRow.CreatedAtUtc, TimeSpan.FromMinutes(1));
    }

    [Fact]
    public async Task Read_reminder_allows_next_cadence_tick_to_surface_a_new_row()
    {
        var fixture = await FixtureAsync();
        await fixture.CreateTaskAsync(SundayMorningUtc);

        fixture.Time.Now = SundayMorningUtc.AddHours(3).AddMinutes(5);
        Assert.Equal(1, await fixture.Commands.ProcessDueAutoRemindersAsync());

        var firstRow = Assert.Single(
            await fixture.ReminderRowsAsync(),
            r => r.UserId == AssigneeUserId);
        Assert.True(await fixture.Notifications.MarkReadAsync(AssigneeUserId, firstRow.Id));

 // Next workday noon (Monday 12:05 Riyadh) → the read row stays, a new unread row appears.
        fixture.Time.Now = SundayMorningUtc.AddDays(1).AddHours(3).AddMinutes(5);
        Assert.Equal(1, await fixture.Commands.ProcessDueAutoRemindersAsync());

        var assigneeRows = (await fixture.ReminderRowsAsync())
            .Where(r => r.UserId == AssigneeUserId)
            .ToList();
        Assert.Equal(2, assigneeRows.Count);
        Assert.Single(assigneeRows, r => r.ReadAtUtc != null);
        Assert.Single(assigneeRows, r => r.ReadAtUtc == null);
    }

    [Fact]
    public async Task Pause_over_limit_re_emits_coalesce_into_single_unread_row_per_user()
    {
        var fixture = await FixtureAsync();
        var task = await fixture.CreateTaskAsync(SundayMorningUtc);
        var entity = await fixture.Ops.OperationsTasks.SingleAsync(t => t.Id == Guid.Parse(task.Id));

        await fixture.Notifier.NotifyPauseOverLimitAsync(entity, CancellationToken.None);
        await fixture.Notifier.NotifyPauseOverLimitAsync(entity, CancellationToken.None);

        var rows = await fixture.Messaging.UserNotifications.AsNoTracking()
            .Where(n => n.Title == "تجاوز حد الإيقاف المؤقت")
            .ToListAsync();
        Assert.Equal(2, rows.Count);
        Assert.Single(rows, r => r.SourceEvent == $"ops-task-pause-limit:{task.Id}:assignee");
        Assert.Single(rows, r => r.SourceEvent == $"ops-task-pause-limit:{task.Id}:creator");
    }

    private static async Task<Fixture> FixtureAsync()
    {
        var name = $"ops-reminder-dedup-{Guid.NewGuid():N}";
        var root = new Microsoft.EntityFrameworkCore.Storage.InMemoryDatabaseRoot();
        var identity = new IdentityDbContext(new DbContextOptionsBuilder<IdentityDbContext>()
            .UseInMemoryDatabase(name, root)
            .ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        var ops = new OperationsDbContext(new DbContextOptionsBuilder<OperationsDbContext>()
            .UseInMemoryDatabase(name, root)
            .ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        var messaging = TestMessagingContexts.CreateMessaging();
        var notifications = TestMessagingContexts.CreateNotificationService(messaging);

        identity.UserProfiles.Add(new UserProfile
        {
            UserId = AssigneeUserId,
            DistributionAssigneeId = "a1",
            RoleId = "government-reviewer",
            JobTitle = "مراجع حكومي",
            Status = UserStatus.Active,
            CreatedAtUtc = DateTime.UtcNow,
        });
        await identity.SaveChangesAsync();

        var time = new FakeTime(SundayMorningUtc);
        var financial = TestInspectorFeeServiceFactory.ShareFinancial(identity);
        var notifier = new OperationsTaskNotifier(
            ops,
            new IdentityDirectory(identity),
            notifications,
            new UserLabelLookup(identity));
        var charges = new CourtVisitFeeChargeService(financial);
        var commands = new OperationsTaskCommands(
            ops,
            new OperationsTaskQueryService(ops, charges, new UserLabelLookup(identity)),
            notifier,
            new OperationsTaskVisitFeeHelper(
                ops,
                charges,
                new IdentityDirectory(identity),
                TestPricing.Create(financial)),
            time);

        return new Fixture(ops, messaging, notifications, notifier, commands, time);
    }

    private sealed record Fixture(
        OperationsDbContext Ops,
        MessagingDbContext Messaging,
        NotificationService Notifications,
        OperationsTaskNotifier Notifier,
        OperationsTaskCommands Commands,
        FakeTime Time)
    {
        public async Task<OperationsTaskDto> CreateTaskAsync(DateTimeOffset nowUtc)
        {
            Time.Now = nowUtc;
            var (task, error) = await Commands.CreateAsync(
                new CreateOperationsTaskRequest
                {
                    Type = "general",
                    Title = "استفسار",
                    Scope = "general",
                    AssigneeId = "a1",
                    AssigneeName = "منفّذ اختبار",
                    Priority = "medium",
                },
                CreatorUserId,
                "منشئ اختبار");
            Assert.Null(error);
            Assert.NotNull(task);
            return task!;
        }

        public async Task<List<UserNotification>> ReminderRowsAsync() =>
            await Messaging.UserNotifications.AsNoTracking()
                .Where(n => n.Title == ReminderTitle)
                .ToListAsync();
    }

    private sealed class FakeTime : TimeProvider
    {
        public FakeTime(DateTimeOffset start) => Now = start;

        public DateTimeOffset Now { get; set; }

        public override DateTimeOffset GetUtcNow() => Now;
    }
}
