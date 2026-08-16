using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class OperationsTaskServiceTests
{
    [Fact]
    public async Task CreateAsync_writes_system_comment_and_display_id()
    {
        var (ops, db) = CreateDbPair();
        var service = CreateService(ops, db);

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
        var (ops, db) = CreateDbPair();
        var service = CreateService(ops, db);
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
        var (ops, db) = CreateDbPair();
        var service = CreateService(ops, db);
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
        Assert.Equal("a1", result.OriginalAssigneeId);
        Assert.Equal("أحمد", result.OriginalAssigneeName);
        Assert.Contains(
            result.Comments,
            c => c.Kind == "update" && c.Text.Contains("أُعيد توجيه") && c.Text.Contains("انشغال"));
    }

    [Fact]
    public async Task PatchAsync_cancel_requires_reason_and_persists()
    {
        var (ops, db) = CreateDbPair();
        var service = CreateService(ops, db);
        var (created, _) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "general",
                Title = "إلغاء",
                Scope = "general",
                AssigneeId = "a1",
                AssigneeName = "منفّذ",
            },
            "creator-1",
            "منشئ");

        var (rejected, rejectError) = await service.PatchAsync(
            Guid.Parse(created!.Id),
            new PatchOperationsTaskRequest { Status = "cancelled" },
            "creator-1",
            "منشئ",
            "case-specialist",
            "creator-1");
        Assert.Null(rejected);
        Assert.Equal("سبب الإلغاء مطلوب", rejectError);

        var (cancelled, error) = await service.PatchAsync(
            Guid.Parse(created.Id),
            new PatchOperationsTaskRequest
            {
                Status = "cancelled",
                CancelReason = "لم تعد مطلوبة",
            },
            "creator-1",
            "منشئ",
            "case-specialist",
            "creator-1");

        Assert.Null(error);
        Assert.NotNull(cancelled);
        Assert.Equal("cancelled", cancelled!.Status);
        Assert.Equal("لم تعد مطلوبة", cancelled.CancelReason);
        Assert.Contains(cancelled.Comments, c => c.Text.Contains("لم تعد مطلوبة", StringComparison.Ordinal));
    }

    [Fact]
    public async Task PatchAsync_confirm_receipt_sets_receipt_confirmed_at()
    {
        var (ops, db) = CreateDbPair();
        var service = CreateService(ops, db);
        var (created, _) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "general",
                Title = "استلام",
                Scope = "general",
                AssigneeId = "a1",
                AssigneeName = "منفّذ",
            },
            "creator-1",
            "منشئ");

        Assert.Null(created!.ReceiptConfirmedAt);

        var (started, error) = await service.PatchAsync(
            Guid.Parse(created.Id),
            new PatchOperationsTaskRequest { Status = "in_progress" },
            "a1",
            "منفّذ",
            "government-reviewer",
            "user-a1");

        Assert.Null(error);
        Assert.NotNull(started);
        Assert.Equal("in_progress", started!.Status);
        Assert.False(string.IsNullOrWhiteSpace(started.ReceiptConfirmedAt));
        Assert.Contains(started.Comments, c => c.Text.Contains("أكّد الاستلام", StringComparison.Ordinal));
    }

    [Fact]
    public async Task PatchAsync_pause_requires_reason_and_persists()
    {
        var (ops, db) = CreateDbPair();
        var service = CreateService(ops, db);
        var (created, _) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "general",
                Title = "إيقاف",
                Scope = "general",
                AssigneeId = "a1",
                AssigneeName = "منفّذ",
            },
            "creator-1",
            "منشئ");

        var (rejected, rejectError) = await service.PatchAsync(
            Guid.Parse(created!.Id),
            new PatchOperationsTaskRequest { Status = "paused" },
            "creator-1",
            "منشئ",
            "case-specialist",
            "creator-1");
        Assert.Null(rejected);
        Assert.Equal("سبب الإيقاف المؤقت مطلوب", rejectError);

        var (paused, error) = await service.PatchAsync(
            Guid.Parse(created.Id),
            new PatchOperationsTaskRequest
            {
                Status = "paused",
                PauseReason = "ظرف طارئ",
            },
            "creator-1",
            "منشئ",
            "case-specialist",
            "creator-1");

        Assert.Null(error);
        Assert.NotNull(paused);
        Assert.Equal("paused", paused!.Status);
        Assert.Equal("ظرف طارئ", paused.PauseReason);
        Assert.False(string.IsNullOrWhiteSpace(paused.PausedAt));
        Assert.Contains(paused.Comments, c => c.Text.Contains("ظرف طارئ", StringComparison.Ordinal));
    }

    [Fact]
    public async Task PatchAsync_resume_after_pause_from_created_goes_in_progress()
    {
        var (ops, db) = CreateDbPair();
        var service = CreateService(ops, db);
        var (created, _) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "general",
                Title = "استئناف من منشأة",
                Scope = "general",
                AssigneeId = "a1",
                AssigneeName = "منفّذ",
            },
            "creator-1",
            "منشئ");

        var (paused, pauseError) = await service.PatchAsync(
            Guid.Parse(created!.Id),
            new PatchOperationsTaskRequest
            {
                Status = "paused",
                PauseReason = "ظرف طارئ",
            },
            "creator-1",
            "منشئ",
            "case-specialist",
            "creator-1");
        Assert.Null(pauseError);
        Assert.Equal("paused", paused!.Status);
        Assert.Equal("created", paused.PrevStatus);

        var (resumed, resumeError) = await service.PatchAsync(
            Guid.Parse(created.Id),
            new PatchOperationsTaskRequest { Status = "in_progress" },
            "creator-1",
            "منشئ",
            "case-specialist",
            "creator-1");

        Assert.Null(resumeError);
        Assert.NotNull(resumed);
        Assert.Equal("in_progress", resumed!.Status);
        Assert.False(string.IsNullOrWhiteSpace(resumed.ReceiptConfirmedAt));
        Assert.Null(resumed.PausedAt);
        Assert.Contains(resumed.Comments, c => c.Text.Contains("استأنف", StringComparison.Ordinal));
    }

    [Fact]
    public async Task PatchAsync_complete_after_reassign_records_execution_credit()
    {
        var (ops, db) = CreateDbPair();
        var service = CreateService(ops, db);
        var (created, _) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "general",
                Title = "ائتمان",
                Scope = "general",
                AssigneeId = "a1",
                AssigneeName = "الأول",
            },
            "creator-1",
            "منشئ");

        await service.ReassignAsync(
            Guid.Parse(created!.Id),
            new ReassignOperationsTaskRequest
            {
                AssigneeId = "a2",
                AssigneeName = "الثاني",
                Reason = "إعادة توجيه",
            },
            "creator-1",
            "منشئ",
            "case-specialist");

        await service.PatchAsync(
            Guid.Parse(created.Id),
            new PatchOperationsTaskRequest { Status = "in_progress" },
            "a2",
            "الثاني",
            "government-reviewer",
            "user-a2");

        var (done, error) = await service.PatchAsync(
            Guid.Parse(created.Id),
            new PatchOperationsTaskRequest
            {
                Status = "completed",
                CreditAssigneeId = "a2",
                CreditAssigneeName = "الثاني",
            },
            "creator-1",
            "منشئ",
            "case-specialist",
            "creator-1");

        Assert.Null(error);
        Assert.NotNull(done);
        Assert.Equal("a2", done!.CreditAssigneeId);
        Assert.Equal("الثاني", done.CreditAssigneeName);
        Assert.Contains(done.Comments, c => c.Text.Contains("مسؤولية التنفيذ", StringComparison.Ordinal));
    }

    [Fact]
    public async Task RemindAsync_appends_reminder_and_comment()
    {
        var (ops, db) = CreateDbPair();
        var service = CreateService(ops, db);
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
        var (ops, db) = CreateDbPair();
        var service = CreateService(ops, db);
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
        var next = OperationsTaskReminderCalculator.NextReminderUtc(
            OperationsTaskPriority.High, from);
        Assert.Equal(new DateTime(2026, 7, 20, 8, 0, 0, DateTimeKind.Utc), next);
    }

    [Fact]
    public void ReminderCalculator_medium_uses_noon_or_end_riyadh()
    {
 // 06:00 UTC = 09:00 Riyadh → noon checkpoint 12:00 Riyadh = 09:00 UTC
        var morning = new DateTime(2026, 7, 20, 6, 0, 0, DateTimeKind.Utc);
        var noon = OperationsTaskReminderCalculator.NextReminderUtc(
            OperationsTaskPriority.Medium, morning);
        Assert.Equal(new DateTime(2026, 7, 20, 9, 0, 0, DateTimeKind.Utc), noon);

 // 10:00 UTC = 13:00 Riyadh → end of day 17:00 Riyadh = 14:00 UTC
        var afternoon = new DateTime(2026, 7, 20, 10, 0, 0, DateTimeKind.Utc);
        var end = OperationsTaskReminderCalculator.NextReminderUtc(
            OperationsTaskPriority.Medium, afternoon);
        Assert.Equal(new DateTime(2026, 7, 20, 14, 0, 0, DateTimeKind.Utc), end);
    }

    [Fact]
    public async Task RemindAsync_rejects_non_manager()
    {
        var (ops, db) = CreateDbPair();
        var service = CreateService(ops, db);
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
        var (ops, db) = CreateDbPair();
        var service = CreateService(ops, db);
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
        var (ops, db) = CreateDbPair();
        await SeedCooperatorAsync(db, "a1");
        var pricingTableId = await SetVisitPriceAsync(db, 350m);
        var service = CreateService(ops, db);
        var (created, _) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "court_visit",
                Title = "زيارة محكمة",
                Scope = "work_order",
                PoNumber = "PO-1",
                AssigneeId = "a1",
                AssigneeName = "مراجع",
                VisitFeeAmountSar = 350m,
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
        Assert.Equal(350m, done.VisitFeeAmountSar);
        Assert.Single(db.CourtVisitFeeCharges);
        var visitCharge = await db.CourtVisitFeeCharges.SingleAsync();
        Assert.Equal(Guid.Parse(created.Id), visitCharge.OperationsTaskId);
        Assert.Equal("a1", visitCharge.CreditAssigneeId);
        Assert.Equal(350m, visitCharge.AmountSar);
 // The amount carries its source, so the rate behind a charge stays provable after a rate change.
        Assert.Equal(pricingTableId, visitCharge.PricingTableId);
        Assert.Equal(CourtVisitFeeStatuses.Open, visitCharge.Status);
        Assert.Empty(db.KeyReceiptFeeCharges);
    }

    [Fact]
    public async Task PatchAsync_complete_court_visit_is_idempotent_for_visit_fee()
    {
        var (ops, db) = CreateDbPair();
        await SeedCooperatorAsync(db, "a1");
        await SetVisitPriceAsync(db, 350m);
        var service = CreateService(ops, db);
        var (created, _) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "court_visit",
                Title = "زيارة محكمة",
                Scope = "work_order",
                PoNumber = "PO-2",
                AssigneeId = "a1",
                AssigneeName = "مراجع",
                VisitFeeAmountSar = 350m,
                LetterRows =
                [
                    new OperationsTaskLetterRowDto
                    {
                        Po = "PO-2",
                        Deed = "D-2",
                        Owner = "مالك",
                        Request = "REQ-2",
                        Court = "محكمة",
                        Circuit = "دائرة",
                    },
                ],
            },
            "creator-1",
            "منشئ");

        Assert.NotNull(created);

        await service.PatchAsync(
            Guid.Parse(created!.Id),
            new PatchOperationsTaskRequest { Status = "in_progress" },
            "a1",
            "مراجع",
            "government-reviewer",
            "user-1");

        await service.PatchAsync(
            Guid.Parse(created.Id),
            new PatchOperationsTaskRequest
            {
                Status = "completed",
                CourtVisitResult = new OperationsTaskCourtVisitResultDto
                {
                    Kind = "none",
                    Statement = "لا مفاتيح",
                },
            },
            "a1",
            "مراجع",
            "government-reviewer",
            "user-1");

        Assert.Single(db.CourtVisitFeeCharges);

 // Already completed — second patch with same status should not add another charge.
        await service.PatchAsync(
            Guid.Parse(created.Id),
            new PatchOperationsTaskRequest
            {
                Status = "completed",
                CourtVisitResult = new OperationsTaskCourtVisitResultDto
                {
                    Kind = "none",
                    Statement = "لا مفاتيح",
                },
            },
            "a1",
            "مراجع",
            "government-reviewer",
            "user-1");

        Assert.Single(db.CourtVisitFeeCharges);
    }

 /// <summary>
 /// A cooperator visit fee is decided at create. Without an amount and without a priced table,
 /// the task must not be created — otherwise complete would invent or skip money silently.
 /// </summary>
    [Fact]
    public async Task CreateAsync_refuses_cooperator_court_visit_without_a_price()
    {
        var (ops, db) = CreateDbPair();
        await SeedCooperatorAsync(db, "a1");
        var service = CreateService(ops, db);
        var (created, error) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "court_visit",
                Title = "زيارة محكمة",
                Scope = "work_order",
                PoNumber = "PO-9",
                AssigneeId = "a1",
                AssigneeName = "مراجع",
                LetterRows =
                [
                    new OperationsTaskLetterRowDto
                    {
                        Po = "PO-9",
                        Deed = "D-9",
                        Owner = "مالك",
                        Request = "REQ-9",
                        Court = "محكمة",
                        Circuit = "دائرة",
                    },
                ],
            },
            "creator-1",
            "منشئ");

        Assert.Null(created);
        Assert.Equal(PricingErrors.FeeUnresolved, error);
        Assert.Empty(db.OperationsTasks);
        Assert.Empty(db.CourtVisitFeeCharges);
    }

 /// <summary>
 /// If create left the stamp empty (legacy / API gap) but the cooperator is still priced,
 /// complete must recover the table amount, stamp it, and open a charge — never stay unpaid silently.
 /// </summary>
    [Fact]
    public async Task PatchAsync_complete_recovers_missing_stamp_from_pricing_table()
    {
        var (ops, db) = CreateDbPair();
        await SeedCooperatorAsync(db, "a1");
        var pricingTableId = await SetVisitPriceAsync(db, 350m);
        var service = CreateService(ops, db);
        var (created, createError) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "court_visit",
                Title = "زيارة محكمة",
                Scope = "work_order",
                PoNumber = "PO-RECOVER",
                AssigneeId = "a1",
                AssigneeName = "مراجع",
                VisitFeeAmountSar = 350m,
                LetterRows =
                [
                    new OperationsTaskLetterRowDto
                    {
                        Po = "PO-RECOVER",
                        Deed = "D-R",
                        Owner = "مالك",
                        Request = "REQ-R",
                        Court = "محكمة",
                        Circuit = "دائرة",
                    },
                ],
            },
            "creator-1",
            "منشئ");

        Assert.Null(createError);
        Assert.NotNull(created);

 // Simulate a legacy row: fee never stamped though the assignee is a cooperator.
        var row = await ops.OperationsTasks.SingleAsync(t => t.Id == Guid.Parse(created!.Id));
        typeof(OperationsTask)
            .GetProperty(nameof(OperationsTask.AgreedVisitFeeSar))!
            .SetValue(row, null);
        typeof(OperationsTask)
            .GetProperty(nameof(OperationsTask.VisitFeePricingTableId))!
            .SetValue(row, null);
        await ops.SaveChangesAsync();
        ops.ChangeTracker.Clear();

        await service.PatchAsync(
            Guid.Parse(created.Id),
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
                    Kind = "none",
                    Statement = "لا مفاتيح",
                },
            },
            "a1",
            "مراجع",
            "government-reviewer",
            "user-1");

        Assert.Null(error);
        Assert.Equal(350m, done!.VisitFeeAmountSar);
        Assert.Single(db.CourtVisitFeeCharges);
        var charge = await db.CourtVisitFeeCharges.SingleAsync();
        Assert.Equal(350m, charge.AmountSar);
        Assert.Equal(pricingTableId, charge.PricingTableId);
    }

    [Fact]
    public async Task Employee_court_visit_completes_without_a_visit_charge()
    {
        var (ops, db) = CreateDbPair();
        await SeedEmployeeAsync(db, "emp-1");
        var service = CreateService(ops, db);
        var (created, createError) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "court_visit",
                Title = "زيارة محكمة",
                Scope = "work_order",
                PoNumber = "PO-EMP",
                AssigneeId = "emp-1",
                AssigneeName = "موظف",
                LetterRows =
                [
                    new OperationsTaskLetterRowDto
                    {
                        Po = "PO-EMP",
                        Deed = "D-E",
                        Owner = "مالك",
                        Request = "REQ-E",
                        Court = "محكمة",
                        Circuit = "دائرة",
                    },
                ],
            },
            "creator-1",
            "منشئ");

        Assert.Null(createError);
        Assert.Null(created!.VisitFeeAmountSar);

        await service.PatchAsync(
            Guid.Parse(created.Id),
            new PatchOperationsTaskRequest { Status = "in_progress" },
            "emp-1",
            "موظف",
            "government-reviewer",
            "user-1");

        var (done, error) = await service.PatchAsync(
            Guid.Parse(created.Id),
            new PatchOperationsTaskRequest
            {
                Status = "completed",
                CourtVisitResult = new OperationsTaskCourtVisitResultDto
                {
                    Kind = "none",
                    Statement = "لا مفاتيح",
                },
            },
            "emp-1",
            "موظف",
            "government-reviewer",
            "user-1");

        Assert.Null(error);
        Assert.Equal("completed", done!.Status);
        Assert.Null(done.VisitFeeAmountSar);
        Assert.Empty(db.CourtVisitFeeCharges);
    }

    [Fact]
    public async Task CreateAsync_rejects_visit_fee_for_employee_reviewer()
    {
        var (ops, db) = CreateDbPair();
        await SeedEmployeeAsync(db, "emp-1");
        var service = CreateService(ops, db);
        var (created, error) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "court_visit",
                Title = "زيارة محكمة",
                Scope = "work_order",
                PoNumber = "PO-EMP-2",
                AssigneeId = "emp-1",
                AssigneeName = "موظف",
                VisitFeeAmountSar = 200m,
                LetterRows =
                [
                    new OperationsTaskLetterRowDto
                    {
                        Po = "PO-EMP-2",
                        Deed = "D-E2",
                        Owner = "مالك",
                        Request = "REQ-E2",
                        Court = "محكمة",
                        Circuit = "دائرة",
                    },
                ],
            },
            "creator-1",
            "منشئ");

        Assert.Null(created);
        Assert.Contains("المراجع الموظف", error);
    }

    [Fact]
    public async Task PatchAsync_complete_court_visit_credits_execution_assignee()
    {
        var (ops, db) = CreateDbPair();
        await SeedCooperatorAsync(db, "original-1");
        await SeedCooperatorAsync(db, "new-1");
        await SetVisitPriceAsync(db, 350m);
        var service = CreateService(ops, db);
        var (created, _) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "court_visit",
                Title = "زيارة محكمة",
                Scope = "work_order",
                PoNumber = "PO-3",
                AssigneeId = "original-1",
                AssigneeName = "أصلي",
                VisitFeeAmountSar = 350m,
                LetterRows =
                [
                    new OperationsTaskLetterRowDto
                    {
                        Po = "PO-3",
                        Deed = "D-3",
                        Owner = "مالك",
                        Request = "REQ-3",
                        Court = "محكمة",
                        Circuit = "دائرة",
                    },
                ],
            },
            "creator-1",
            "منشئ");

        Assert.NotNull(created);

        await service.ReassignAsync(
            Guid.Parse(created!.Id),
            new ReassignOperationsTaskRequest
            {
                AssigneeId = "new-1",
                AssigneeName = "جديد",
                Reason = "انشغال",
            },
            "creator-1",
            "منشئ",
            "case-specialist");

        await service.PatchAsync(
            Guid.Parse(created.Id),
            new PatchOperationsTaskRequest { Status = "in_progress" },
            "new-1",
            "جديد",
            "government-reviewer",
            "user-1");

        var (done, error) = await service.PatchAsync(
            Guid.Parse(created.Id),
            new PatchOperationsTaskRequest
            {
                Status = "completed",
                CourtVisitResult = new OperationsTaskCourtVisitResultDto
                {
                    Kind = "none",
                    Statement = "لا مفاتيح في الدائرة",
                },
                CreditAssigneeId = "new-1",
                CreditAssigneeName = "جديد",
            },
            "new-1",
            "جديد",
            "government-reviewer",
            "user-1");

        Assert.Null(error);
        Assert.NotNull(done);
        var charge = await db.CourtVisitFeeCharges.SingleAsync();
        Assert.Equal("new-1", charge.CreditAssigneeId);
        Assert.Equal("جديد", charge.CreditAssigneeName);
    }

    private static (OperationsDbContext Ops, ApplicationDbContext Db) CreateDbPair()
    {
        var name = $"ops-tasks-{Guid.NewGuid():N}";
        var root = new Microsoft.EntityFrameworkCore.Storage.InMemoryDatabaseRoot();
        var app = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(name, root)
            .ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        var ops = new OperationsDbContext(new DbContextOptionsBuilder<OperationsDbContext>()
            .UseInMemoryDatabase(name, root)
            .ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        return (ops, app);
    }

    private static OperationsTaskService CreateService(OperationsDbContext ops, ApplicationDbContext db) =>
        OperationsTaskService.Create(ops, db, new NullNotificationService(), new PartyFeePricingService(TestInspectorFeeServiceFactory.ShareFinancial(db)));

 /// <summary>
 /// Visit fees have no built-in rate any more, so a test that expects a charge has to put one in
 /// the table first — the same thing an administrator now has to do.
 /// </summary>
    private static async Task<Guid> SetVisitPriceAsync(ApplicationDbContext db, decimal amountSar)
    {
        var tableId = Guid.NewGuid();
        db.PartyFeePricingTables.Add(new PartyFeePricingTable
        {
            Id = tableId,
            Category = PartyFeePricingCategories.CourtVisit,
            Name = "اختبار",
            IsActive = true,
            CourtVisitFeeSar = amountSar,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
        return tableId;
    }

    private static async Task SeedCooperatorAsync(ApplicationDbContext db, string assigneeId)
    {
        db.UserProfiles.Add(new UserProfile
        {
            UserId = Guid.NewGuid().ToString("N"),
            DistributionAssigneeId = assigneeId,
            ContractType = ContractType.Freelance,
            RoleId = "government-reviewer",
            JobTitle = "مراجع حكومي",
            CreatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
    }

    private static async Task SeedEmployeeAsync(ApplicationDbContext db, string assigneeId)
    {
        db.UserProfiles.Add(new UserProfile
        {
            UserId = Guid.NewGuid().ToString("N"),
            DistributionAssigneeId = assigneeId,
            ContractType = ContractType.Internal,
            RoleId = "government-reviewer",
            JobTitle = "مراجع حكومي",
            HasCompensation = true,
            CreatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
    }

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
