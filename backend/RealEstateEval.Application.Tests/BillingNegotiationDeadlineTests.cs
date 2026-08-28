using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// E6 — مهلة التفاوض على التسعيرة (بنود البتّ 9–14): عشرة أيام عمل بتوقيت الرياض
/// من دخول «معترض»، تذكيران لا يتكرران، والمهلة تسقط عند أي خروج من الاعتراض.
/// </summary>
public class BillingNegotiationDeadlineTests
{
 // 2024-01-07 يوم أحد (2024-01-01 اثنين) — مرساة ثابتة لحساب أيام العمل.
    private static readonly DateTime SundayEntryUtc =
        new(2024, 1, 7, 5, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Deadline_is_ten_business_days_at_end_of_riyadh_business_day()
    {
        var deadline = BillingNegotiationDeadlines.DeadlineFromUtc(SundayEntryUtc);

 // أحد 7 → عشرة أيام عمل (الجمعة/السبت لا تُحسب) = الأحد 21 يناير، 17:00 الرياض.
        Assert.Equal(new DateTime(2024, 1, 21, 14, 0, 0, DateTimeKind.Utc), deadline);
        Assert.Equal(DayOfWeek.Sunday, deadline.AddHours(3).DayOfWeek);
    }

    [Fact]
    public void Reminders_fall_two_business_days_before_and_on_deadline_morning()
    {
        var deadline = BillingNegotiationDeadlines.DeadlineFromUtc(SundayEntryUtc);

 // يومان عمل قبل الأحد 21 = الأربعاء 17 (الخميس ثم الأربعاء)، 09:00 الرياض.
        Assert.Equal(
            new DateTime(2024, 1, 17, 6, 0, 0, DateTimeKind.Utc),
            BillingNegotiationDeadlines.ReminderTwoDaysUtc(deadline));
        Assert.Equal(
            new DateTime(2024, 1, 21, 6, 0, 0, DateTimeKind.Utc),
            BillingNegotiationDeadlines.ReminderDeadlineDayUtc(deadline));
    }

    [Fact]
    public void Due_stages_progress_without_repeats()
    {
        var deadline = BillingNegotiationDeadlines.DeadlineFromUtc(SundayEntryUtc);

 // قبل موعد التذكير الأول: لا شيء مستحق.
        Assert.Empty(BillingNegotiationDeadlines.DueStages(
            deadline, deadline.AddDays(-5), notifiedStagesCsv: null));

 // بعد التذكير الأول وقبل الثاني.
        var afterFirst = BillingNegotiationDeadlines.ReminderTwoDaysUtc(deadline).AddMinutes(5);
        Assert.Equal(
            [BillingNegotiationDeadlines.StageReminderTwoDays],
            BillingNegotiationDeadlines.DueStages(deadline, afterFirst, null));

 // المرحلة المرسلة لا تعود.
        var sent = BillingNegotiationDeadlines.AppendNotifiedStage(
            null, BillingNegotiationDeadlines.StageReminderTwoDays);
        Assert.Empty(BillingNegotiationDeadlines.DueStages(deadline, afterFirst, sent));

 // بعد الانقضاء: التصعيد وحده (التذكيرات لا تُرسل متأخرة).
        Assert.Equal(
            [BillingNegotiationDeadlines.StageEscalation],
            BillingNegotiationDeadlines.DueStages(
                deadline,
                deadline.AddHours(1),
                BillingNegotiationDeadlines.AppendNotifiedStage(
                    sent, BillingNegotiationDeadlines.StageReminderDeadlineDay)));
    }

    [Fact]
    public async Task Entering_disputed_stamps_the_deadline_and_resolving_clears_it()
    {
        await using var db = CreateDb();
        var taskId = SeedDiscountedLedger(db, InspectorFeeBillingStatus.OfficeReview);
        await db.CaseStudy.SaveChangesAsync();
        await db.Financial.SaveChangesAsync();
        var service = TestInspectorFeeServiceFactory.Create(db.CaseStudy);

        var (disputed, disputeError) = await service.TransitionAsync(
            taskId,
            new InspectorFeeTransitionRequest
            {
                Action = InspectorFeeActions.OfficeDispute,
                Reason = "الخصم غير متفق عليه",
            },
            "office-user",
            actorAssigneeId: "office-1",
            isOperationsManager: false,
            isFinancialOfficer: false);

        Assert.Null(disputeError);
        Assert.NotNull(disputed);
 // الكتابة جرت عبر سياق الخدمة — نظّف متتبع سياق الاختبار كي لا تعود نسخة البذر.
        db.Financial.ChangeTracker.Clear();
        var ledger = db.Financial.InspectorFeeLedgers.Single(x => x.WorkflowTaskId == taskId);
        Assert.NotNull(ledger.DisputeDeadlineUtc);
 // المهلة تنقضي 17:00 بتوقيت الرياض في يوم عمل.
        var deadlineRiyadh = ledger.DisputeDeadlineUtc!.Value.AddHours(3);
        Assert.Equal(17, deadlineRiyadh.Hour);
        Assert.NotEqual(DayOfWeek.Friday, deadlineRiyadh.DayOfWeek);
        Assert.NotEqual(DayOfWeek.Saturday, deadlineRiyadh.DayOfWeek);

        var (_, resolveError) = await service.TransitionAsync(
            taskId,
            new InspectorFeeTransitionRequest
            {
                Action = InspectorFeeActions.ResolveDispute,
                Reason = "اتُّفق على المبلغ",
            },
            "supervisor-1",
            actorAssigneeId: null,
            isOperationsManager: true,
            isFinancialOfficer: false,
            actorDepartment: SupervisingDepartments.Valuation);

        Assert.Null(resolveError);
        db.Financial.ChangeTracker.Clear();
        var resolved = db.Financial.InspectorFeeLedgers.Single(x => x.WorkflowTaskId == taskId);
 // بند 12: الخروج من الاعتراض يسقط المهلة وسجل مراحلها.
        Assert.Null(resolved.DisputeDeadlineUtc);
        Assert.Null(resolved.DisputeNotifiedStages);
    }

    private static Guid SeedDiscountedLedger(TestDatabases.ContextSet db, string status)
    {
        var taskId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        db.CaseStudy.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.EngineeringSurvey,
            "PO-NEGO",
            now,
            assigneeRole: "engineering-office",
            assigneeName: "مكتب",
            assigneeId: "office-1",
            id: taskId,
            status: WorkflowTaskStatus.Completed));
        db.Financial.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = taskId,
            PoNumber = "PO-NEGO",
            AssigneeId = "office-1",
            InspectorType = "متعاون شركة",
            SupervisingDepartment = SupervisingDepartments.Valuation,
            AgreedFeeSar = 1_000m,
            SupervisorDiscountSar = 100m,
            DiscountReason = "خصم اتفاق سابق",
            BillingStatus = status,
            AccruedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        return taskId;
    }

    private static TestDatabases.ContextSet CreateDb() =>
        TestDatabases.Create("billing-negotiation");
}
