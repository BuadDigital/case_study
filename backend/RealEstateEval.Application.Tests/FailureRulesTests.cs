using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Application.Rules;
using RealEstateEval.Failures.Domain;

namespace RealEstateEval.Application.Tests;

public class FailureRulesTests
{
    private static readonly DateTime Now = new(2026, 5, 4, 12, 0, 0, DateTimeKind.Utc);

    private static PermissionsDto Actor(
        string? role = null,
        string userId = "u-1",
        string? assigneeId = null,
        params string[] capabilities) => new()
        {
            UserId = userId,
            PrototypeRole = role,
            DistributionAssigneeId = assigneeId,
            Capabilities = capabilities,
        };

    private static PropertyFailure Failure(
        string title = "عنوان",
        string internalNote = "ملاحظة",
        string finalNote = "") =>
        PropertyFailure.Reconstitute(
            Guid.NewGuid(),
            "PO-1",
            Guid.NewGuid().ToString(),
            "D-1",
            title,
            "deed-inactive",
            PropertyFailureSeverity.Internal,
            "الأخصائي",
            internalNote,
            finalNote,
            PropertyFailureStatus.Internal,
            "سالم",
            Now,
            Now);

    // ---- visibility ----

    [Fact]
    public void Failure_capabilities_open_up_every_work_order()
    {
        Assert.True(FailureRules.SeesEveryFailure(Actor(capabilities: "manage-failures")));
        Assert.True(FailureRules.SeesEveryFailure(Actor(capabilities: "MANAGE-WORK-ORDERS")));
        Assert.False(FailureRules.SeesEveryFailure(Actor(capabilities: "read-only")));
    }

    [Fact]
    public void An_actor_without_a_user_or_assignee_key_sees_nothing()
    {
        Assert.True(FailureRules.HasNoVisibilityKey(Actor(userId: "  ", assigneeId: "  ")));
        Assert.False(FailureRules.HasNoVisibilityKey(Actor(userId: "u-9")));
        Assert.Equal(["a-1", "u-9"], FailureRules.VisibilityAssigneeKeys(Actor(userId: "u-9", assigneeId: " a-1 ")));
    }

    // ---- create ----

    [Fact]
    public void Create_requires_po_property_and_specialist()
    {
        var errors = FailureRules.ValidateCreate(new CreateFailureRequest());
        Assert.Equal("رقم أمر العمل مطلوب", errors["poNumber"]);
        Assert.Equal("معرف العقار مطلوب", errors["propertyId"]);
        Assert.Equal("اسم الأخصائي مطلوب", errors["specialist"]);

        Assert.Empty(FailureRules.ValidateCreate(new CreateFailureRequest
        {
            PoNumber = "PO-1",
            PropertyId = "p",
            Specialist = "سالم",
        }));
    }

    [Theory]
    [InlineData("suspected", PropertyFailureSeverity.Suspected)]
    [InlineData("  SUSPECTED ", PropertyFailureSeverity.Suspected)]
    [InlineData("internal", PropertyFailureSeverity.Internal)]
    [InlineData("anything", PropertyFailureSeverity.Internal)]
    public void Severity_only_honours_suspected(string input, string expected)
    {
        Assert.Equal(expected, FailureRules.NormalizeSeverity(input));
    }

    [Fact]
    public void Title_prefers_the_custom_one_then_the_problem_type()
    {
        Assert.Equal("مخصص", FailureRules.ResolveTitle(new CreateFailureRequest { Title = " مخصص " }));
        Assert.Equal(
            FailureRules.DeedInactiveTitle,
            FailureRules.ResolveTitle(new CreateFailureRequest
            {
                ProblemTypeId = FailureRules.DeedInactiveProblemTypeId,
            }));
        Assert.Equal(
            "access-denied",
            FailureRules.ResolveTitle(new CreateFailureRequest { ProblemTypeId = " access-denied " }));
    }

    [Fact]
    public void Raiser_role_and_specialist_fall_back_to_known_labels()
    {
        Assert.Equal("الأخصائي", FailureRules.RaisedByRoleOrDefault("  "));
        Assert.Equal("مشرف", FailureRules.RaisedByRoleOrDefault(" مشرف "));
        Assert.Equal(FailureRules.SystemRaiserRole, FailureRules.SpecialistOrSystem("system"));
        Assert.Equal(FailureRules.SystemRaiserRole, FailureRules.SpecialistOrSystem(null));
        Assert.Equal("سالم", FailureRules.SpecialistOrSystem("سالم"));
        Assert.Equal(FailureRules.SystemRaiserRole, FailureRules.ActorOrSystem("   "));
        Assert.Equal("نورة", FailureRules.ActorOrSystem(" نورة "));
    }

    [Fact]
    public void A_new_failure_carries_the_normalized_title_severity_and_note()
    {
        var entity = FailureRules.NewFailure(
            new CreateFailureRequest
            {
                PoNumber = " PO-2 ",
                PropertyId = " p-2 ",
                DeedNumber = " D-2 ",
                ProblemTypeId = FailureRules.DeedInactiveProblemTypeId,
                Severity = "suspected",
                InternalNote = "  سبب  ",
            },
            "الأخصائي",
            "سالم",
            Now);

        Assert.Equal("PO-2", entity.PoNumber);
        Assert.Equal(FailureRules.DeedInactiveTitle, entity.Title);
        Assert.Equal(PropertyFailureSeverity.Suspected, entity.Severity);
        Assert.Equal("سبب", entity.InternalNote);
        Assert.Equal("سالم", entity.Specialist);
    }

    [Fact]
    public void A_bourse_obstruction_becomes_an_internal_deed_inactive_failure()
    {
        var request = FailureRules.BourseObstructionCreateRequest(new BourseObstructionRequest
        {
            PoNumber = "PO-3",
            PropertyId = "p-3",
            DeedNumber = "D-3",
            Reason = "  الصك موقوف  ",
            Specialist = "سالم",
        });

        Assert.Equal(FailureRules.DeedInactiveProblemTypeId, request.ProblemTypeId);
        Assert.Equal(FailureRules.DeedInactiveTitle, request.Title);
        Assert.Equal(PropertyFailureSeverity.Internal, request.Severity);
        Assert.Equal("الصك موقوف", request.InternalNote);
    }

    [Fact]
    public void A_system_internal_request_names_the_system_as_raiser()
    {
        var request = FailureRules.SystemInternalCreateRequest(
            "PO-4", "p-4", "D-4", "unknown-boundaries", "عنوان", "ملاحظة", "سالم");

        Assert.Equal(FailureRules.SystemRaiserRole, request.RaisedByRole);
        Assert.Equal(PropertyFailureSeverity.Internal, request.Severity);
        Assert.Equal("unknown-boundaries", request.ProblemTypeId);
    }

    [Fact]
    public void An_eviction_hold_is_born_suspended()
    {
        var hold = FailureRules.NewEvictionHold("PO-5", "p-5", "D-5", "سالم", Now);

        Assert.Equal(PropertyFailureStatus.Suspended, hold.Status);
        Assert.Equal(FailureRules.EvictionProblemTypeId, hold.ProblemTypeId);
        Assert.Equal(FailureRules.EvictionTitle, hold.Title);
        Assert.Equal(Now, hold.SuspendedAtUtc);
    }

    [Fact]
    public void An_unmatched_key_failure_is_internal_and_system_raised()
    {
        var failure = FailureRules.NewKeyUnmatchedFailure("PO-6", "p-6", "D-6", "سالم", Now);

        Assert.Equal(FailureRules.KeyUnmatchedProblemTypeId, failure.ProblemTypeId);
        Assert.Equal(FailureRules.KeyUnmatchedTitle, failure.Title);
        Assert.Equal(FailureRules.SystemRaiserRole, failure.RaisedByRole);
        Assert.Equal(PropertyFailureSeverity.Internal, failure.Severity);
    }

    [Fact]
    public void Lifting_an_eviction_hold_names_the_actor()
    {
        Assert.Equal("رُفع التعليق بواسطة نورة.", FailureRules.EvictionLiftedNote("نورة"));
    }

    // ---- downstream reasons ----

    [Fact]
    public void The_obstruction_reason_falls_back_to_the_internal_note()
    {
        Assert.Equal("عنوان", FailureRules.ObstructionReason(Failure()));
        Assert.Equal("ملاحظة", FailureRules.ObstructionReason(Failure(title: "   ")));
    }

    [Fact]
    public void The_approved_block_reason_prefers_the_final_note()
    {
        Assert.Equal("قرار", FailureRules.ApprovedBlockReason(Failure(finalNote: " قرار ")));
        Assert.Equal("عنوان", FailureRules.ApprovedBlockReason(Failure()));
        Assert.Equal("تعذر معتمد", FailureRules.ApprovedBlockReason(Failure(title: "  ")));
    }

    [Fact]
    public void Downstream_requests_carry_the_failure_keys()
    {
        var failure = Failure();

        Assert.Equal("سبب", FailureRules.EscalateRequest(failure, "سبب").Reason);
        Assert.Equal(failure.PoNumber, FailureRules.ResolveObstructionRequest(failure).PoNumber);
        Assert.Equal(failure.PropertyId, FailureRules.BlockTasksRequest(failure).PropertyId);

        var deedStatus = FailureRules.DeedStatusRequest(failure, "موقوف");
        Assert.Equal("موقوف", deedStatus.DeedStatus);
        Assert.Equal(failure.DeedNumber, deedStatus.DeedNumber);
    }

    // ---- timeline and notifications ----

    [Fact]
    public void The_created_timeline_entry_names_the_status()
    {
        var failure = Failure();
        var propertyId = Guid.NewGuid();
        var entry = FailureRules.CreatedTimelineEntry(failure, propertyId, Now);

        Assert.Equal($"failure:{failure.Id}:created", entry.EventKey);
        Assert.Equal(propertyId, entry.PropertyId);
        Assert.Contains(PropertyFailureStatus.LabelAr(failure.Status), entry.Detail);
        Assert.Equal(PropertyTimelineTones.Warn, entry.Tone);
    }

    [Fact]
    public void The_suspended_timeline_entry_uses_the_suspension_time()
    {
        var failure = FailureRules.NewEvictionHold("PO-7", "p-7", "D-7", "سالم", Now);

        var entry = FailureRules.SuspendedTimelineEntry(failure, Guid.NewGuid());
        Assert.Equal($"failure:{failure.Id}:suspended", entry.EventKey);
        Assert.Equal(failure.SuspendedAtUtc, entry.OccurredAtUtc);
    }

    [Fact]
    public void Submitted_and_approved_notifications_point_at_the_failure()
    {
        var failure = Failure();

        var submitted = FailureRules.SubmittedNotification(failure);
        Assert.Equal("تعذر بانتظار المراجعة", submitted.Title);
        Assert.Equal(failure.Id.ToString(), submitted.EntityId);
        Assert.Equal($"failure-submitted:{failure.Id}", submitted.SourceEvent);
        Assert.Equal(failure.Specialist, submitted.Actor);

        var approved = FailureRules.ApprovedNotification(failure);
        Assert.Equal("اعتماد تعذر", approved.Title);
        Assert.Equal($"failure-approved:{failure.Id}", approved.SourceEvent);
    }

    [Fact]
    public void Hold_notifications_deep_link_to_the_case_study_task()
    {
        var taskId = Guid.NewGuid();

        var blocked = FailureRules.CaseStudyBlockedNotification(taskId, "سبب التعليق");
        Assert.Equal("سبب التعليق", blocked.Body);
        Assert.Equal($"/case-study/{taskId}", blocked.Href);
        Assert.Equal($"case-study-blocked:{taskId}", blocked.SourceEvent);

        var unblocked = FailureRules.CaseStudyUnblockedNotification(taskId);
        Assert.Equal("success", unblocked.Tone);
        Assert.Equal($"case-study-unblocked:{taskId}", unblocked.SourceEvent);
    }
}
