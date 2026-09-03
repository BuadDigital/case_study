using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// E6 — Negotiation lead time for Pricing Quote (bit clauses 9–14): ten business days Riyadh time
/// From the entry of an “objector”, there are two reminders that will not be repeated, and the time limit falls upon any exit from the objection.
/// </summary>
public class BillingNegotiationDeadlineTests
{
 // 2024-01-07 Sunday (2024-01-01 Monday) — Fixed anchor for calculating working days.
    private static readonly DateTime SundayEntryUtc =
        new(2024, 1, 7, 5, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Deadline_is_ten_business_days_at_end_of_riyadh_business_day()
    {
        var deadline = BillingNegotiationDeadlines.DeadlineFromUtc(SundayEntryUtc);

 // Sun 7 → Ten working days (Fri/Sat not included) = Sunday 21 January, 17:00 Riyadh.
        Assert.Equal(new DateTime(2024, 1, 21, 14, 0, 0, DateTimeKind.Utc), deadline);
        Assert.Equal(DayOfWeek.Sunday, deadline.AddHours(3).DayOfWeek);
    }

    [Fact]
    public void Reminders_fall_two_business_days_before_and_on_deadline_morning()
    {
        var deadline = BillingNegotiationDeadlines.DeadlineFromUtc(SundayEntryUtc);

 // Two business days before Sunday 21 = Wednesday 17 (Thursday then Wednesday), 09:00 Riyadh.
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

 // Before the first reminder: Nothing is due.
        Assert.Empty(BillingNegotiationDeadlines.DueStages(
            deadline, deadline.AddDays(-5), notifiedStagesCsv: null));

 // After the first reminder and before the second.
        var afterFirst = BillingNegotiationDeadlines.ReminderTwoDaysUtc(deadline).AddMinutes(5);
        Assert.Equal(
            [BillingNegotiationDeadlines.StageReminderTwoDays],
            BillingNegotiationDeadlines.DueStages(deadline, afterFirst, null));

 // The sent stage does not return.
        var sent = BillingNegotiationDeadlines.AppendNotifiedStage(
            null, BillingNegotiationDeadlines.StageReminderTwoDays);
        Assert.Empty(BillingNegotiationDeadlines.DueStages(deadline, afterFirst, sent));

 // After expiration: Escalation alone (reminders are not sent late).
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
 // The write occurred via the service context — clean up the test context trace so that the seed copy does not return.
        db.Financial.ChangeTracker.Clear();
        var ledger = db.Financial.InspectorFeeLedgers.Single(x => x.WorkflowTaskId == taskId);
        Assert.NotNull(ledger.DisputeDeadlineUtc);
 // The deadline expires at 17:00 Riyadh time on a business day.
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
 // Clause 12: Exiting the objection waives the time limit and the record of its stages.
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
